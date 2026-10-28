import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.ts';
import { q, type Row } from './db/index.ts';
import { id } from './lib/http.ts';
import { notify } from './services/notify.ts';
import { getForecast } from './providers/weather.ts';
import { evaluate } from './services/agroRules.ts';
import { activeCycleContexts, upcomingTasks } from './routes/weather.ts';
import { offerEvent, orderEvent, refreshLotStatus, releaseDemand, releaseLot } from './services/trade.ts';
import { notifyT } from './services/messages.ts';

const log = (msg: string, extra: Record<string, unknown> = {}) => console.log(JSON.stringify({ level: 'info', job: true, msg, ...extra }));

/** Due/overdue task reminders, one per task per day. */
export function taskReminders() {
  const today = new Date().toISOString().slice(0, 10);
  const due = q.all<Row>(`SELECT t.id, t.user_id, t.title, t.due_date FROM tasks t JOIN users u ON u.id = t.user_id
    WHERE t.status = 'pending' AND t.due_date BETWEEN date('now', '-3 day') AND date('now') AND u.status = 'active' LIMIT 5000`);
  let n = 0;
  for (const t of due) {
    if (notify(t.user_id, 'task', t.due_date < today ? 'Overdue farm task' : 'Farm task due today', t.title, `task:${t.id}:${today}`, '/calendar')) n++;
  }
  return n;
}

/** Forecast-derived warnings for each located farm with active crops. Stored as farm-specific alerts. */
export async function weatherAlerts() {
  const farms = q.all<Row>(`SELECT DISTINCT f.* FROM farms f JOIN crop_cycles cc ON cc.farm_id = f.id
    WHERE cc.status = 'active' AND f.latitude IS NOT NULL LIMIT 2000`);
  let n = 0;
  for (const f of farms) {
    try {
      const w = await getForecast(f.latitude, f.longitude);
      const recs = evaluate(w.forecast, activeCycleContexts(f.user_id, f.id), upcomingTasks(f.user_id, f.id)).filter((r) => r.severity === 'warning');
      const day = new Date().toISOString().slice(0, 10);
      for (const r of recs) {
        const dedupe = `wx:${f.id}:${r.id}:${day}`;
        const exists = q.get('SELECT 1 FROM alerts WHERE dedupe_key = ?', dedupe);
        if (exists) continue;
        const category = r.type === 'heat' ? 'heat' : r.type === 'cold' ? 'cold' : r.type === 'wind' ? 'wind' : r.type === 'waterlogging' ? 'flood' : 'heavy_rain';
        q.run(`INSERT INTO alerts (id, category, severity, title, body, precautions, state, district, latitude, longitude, source, verified, dedupe_key, expires_at, user_id)
          VALUES (?, ?, 'warning', ?, ?, ?, ?, ?, ?, ?, 'Open-Meteo forecast (model-derived, not an official IMD warning)', 0, ?, datetime('now', '+2 day'), ?)`,
          id(), category, `${f.name}: ${r.title}`, r.basis, r.detail, f.state, f.district, f.latitude, f.longitude, dedupe, f.user_id);
        notify(f.user_id, 'weather', r.title, `${f.name}: ${r.detail}`, dedupe, '/alerts');
        n++;
      }
    } catch { /* provider issues are logged by the adapter */ }
  }
  return n;
}

/** Notify watchlist users when the latest modal price moves by their threshold. */
export function priceWatch() {
  const items = q.all<Row>('SELECT * FROM market_watchlist WHERE alert_change_pct IS NOT NULL');
  let n = 0;
  for (const w of items) {
    const latest = q.get<Row>(`SELECT * FROM market_prices WHERE commodity = ? ${w.state ? 'AND state = ?' : ''} ${w.market ? 'AND market = ?' : ''}
      AND modal_price IS NOT NULL ORDER BY arrival_date DESC LIMIT 1`, ...[w.commodity, ...(w.state ? [w.state] : []), ...(w.market ? [w.market] : [])]);
    if (!latest) continue;
    if (w.last_notified_price == null) {
      q.run('UPDATE market_watchlist SET last_notified_price = ? WHERE id = ?', latest.modal_price, w.id);
      continue;
    }
    const pct = ((latest.modal_price - w.last_notified_price) / w.last_notified_price) * 100;
    if (Math.abs(pct) >= w.alert_change_pct) {
      notify(w.user_id, 'price', `${w.commodity} price ${pct > 0 ? 'up' : 'down'} ${Math.abs(pct).toFixed(1)}%`,
        `${latest.market}: ₹${latest.modal_price}/quintal on ${latest.arrival_date} (Agmarknet)`, `price:${w.id}:${latest.arrival_date}`, '/mandi');
      q.run('UPDATE market_watchlist SET last_notified_price = ? WHERE id = ?', latest.modal_price, w.id);
      n++;
    }
  }
  return n;
}

/** Retention and housekeeping. */
export function cleanup() {
  q.run(`DELETE FROM sessions WHERE expires_at < datetime('now')`);
  q.run(`DELETE FROM otp_codes WHERE created_at < datetime('now', '-1 day')`);
  q.run(`DELETE FROM alerts WHERE expires_at < datetime('now', '-30 day')`);
  q.run(`DELETE FROM notifications WHERE created_at < datetime('now', '-180 day')`);
  q.run(`DELETE FROM api_events WHERE created_at < datetime('now', '-30 day')`);
  q.run(`DELETE FROM verification_attempts WHERE created_at < datetime('now', '-365 day')`);
  // Diagnoses the user chose not to keep are removed after 24 hours, including images.
  const transient = q.all<Row>(`SELECT id, image_path FROM diagnoses WHERE saved = 0 AND created_at < datetime('now', '-1 day')`);
  for (const d of transient) {
    if (d.image_path) fs.rm(path.join(config.uploadDir, d.image_path), { force: true }, () => {});
    q.run('DELETE FROM diagnoses WHERE id = ?', d.id);
  }
}

/**
 * Marketplace housekeeping: expire offers and listings, release reservations of
 * orders nobody confirmed, release lapsed storage holds, and remind farmers
 * before their storage period ends.
 */
export function marketplaceExpiry() {
  const now = new Date().toISOString();
  const stats = { offers: 0, lots: 0, orders: 0, holds: 0, reminders: 0 };
  // Offers
  const offers = q.all<Row>(`SELECT id, thread_id, lot_id FROM offers WHERE status = 'pending' AND expires_at < ?`, now);
  for (const o of offers) {
    q.run(`UPDATE offers SET status = 'expired' WHERE id = ? AND status = 'pending'`, o.id);
    offerEvent(o.thread_id, o.id, null, 'expired');
    if (o.lot_id) refreshLotStatus(o.lot_id);
    stats.offers++;
  }
  // Unconfirmed orders → release the reserved quantity
  const orders = q.all<Row>(`SELECT * FROM orders WHERE status = 'pending_confirmation' AND reservation_expires_at < ?`, now);
  for (const o of orders) {
    q.tx(() => {
      const r = q.run(`UPDATE orders SET status = 'cancelled', cancelled_at = datetime('now'), cancel_reason = 'Not confirmed by both parties in time', updated_at = datetime('now') WHERE id = ? AND status = 'pending_confirmation'`, o.id);
      if (r.changes) { releaseLot(o.lot_id, o.quantity); releaseDemand(o.demand_id, o.quantity, o.unit); orderEvent(o.id, null, 'expired'); }
    });
    for (const uid of [o.farmer_id, o.buyer_id]) notifyT(uid, 'order', 'order_update', { ref: o.order_no, status: 'expired – not confirmed in time' }, `order-expired:${o.id}`, `/trade/orders/${o.id}`);
    stats.orders++;
  }
  // Listings
  const lots = q.all<Row>(`SELECT id, farmer_id, commodity FROM produce_lots WHERE status IN ('published','offer_received','negotiation') AND quantity_reserved = 0 AND expires_at < ?`, now);
  for (const l of lots) {
    q.run(`UPDATE produce_lots SET status = 'expired', updated_at = datetime('now') WHERE id = ?`, l.id);
    q.run(`UPDATE offers SET status = 'expired' WHERE lot_id = ? AND status = 'pending'`, l.id);
    notifyT(l.farmer_id, 'order', 'listing_expired', { commodity: l.commodity }, `lot-expired:${l.id}:${now.slice(0, 10)}`, '/sell');
    stats.lots++;
  }
  // Storage requests the facility never answered
  const holds = q.all<Row>(`SELECT * FROM storage_bookings WHERE status = 'availability_requested' AND hold_expires_at < ?`, now);
  for (const b of holds) {
    q.run(`UPDATE storage_bookings SET status = 'cancelled', cancel_reason = 'Facility did not respond in time; capacity released', updated_at = datetime('now') WHERE id = ? AND status = 'availability_requested'`, b.id);
    q.run(`INSERT INTO inventory_movements (booking_id, kind, note) VALUES (?, 'status', 'Hold expired – capacity released')`, b.id);
    notifyT(b.farmer_id, 'order', 'booking_update', { ref: b.booking_ref, status: 'expired – facility did not respond. Try another facility' }, `booking-expired:${b.id}`, `/storage/bookings/${b.id}`);
    stats.holds++;
  }
  // Storage ending in ≤ 3 days
  const ending = q.all<Row>(`SELECT * FROM storage_bookings WHERE status IN ('in_storage','received','confirmed','check_in_scheduled') AND end_date BETWEEN date('now') AND date('now', '+3 day')`);
  for (const b of ending) if (notifyT(b.farmer_id, 'order', 'storage_expiry', { ref: b.booking_ref, date: b.end_date }, `storage-expiry:${b.id}:${b.end_date}`, `/storage/bookings/${b.id}`)) stats.reminders++;
  return stats;
}

export function startJobs() {
  const safe = (name: string, fn: () => unknown) => async () => {
    try { const r = await fn(); log(`${name} done`, { result: r as any }); } catch (e: any) { console.error(JSON.stringify({ level: 'error', job: name, err: e?.message })); }
  };
  const every = (ms: number, name: string, fn: () => unknown) => {
    setTimeout(safe(name, fn), 10_000).unref();
    setInterval(safe(name, fn), ms).unref();
  };
  every(30 * 60_000, 'taskReminders', taskReminders);
  every(3 * 60 * 60_000, 'weatherAlerts', weatherAlerts);
  every(60 * 60_000, 'priceWatch', priceWatch);
  every(6 * 60 * 60_000, 'cleanup', cleanup);
  every(15 * 60_000, 'marketplaceExpiry', marketplaceExpiry);
}

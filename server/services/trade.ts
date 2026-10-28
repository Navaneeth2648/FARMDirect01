import crypto from 'node:crypto';
import { q, insert, type Row } from '../db/index.ts';
import { HttpError, id } from '../lib/http.ts';
import { breakdown, type Charge } from './pricing.ts';
import { getSetting } from './settings.ts';
import { toQtl } from './fraud.ts';

export const ACTIVE_LOT_STATUSES = ['published', 'offer_received', 'negotiation', 'reserved', 'partially_sold'];

export const ref = (prefix: string) => `${prefix}-${new Date().getFullYear()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

export function orderEvent(orderId: string, actorId: string | null, event: string, details?: unknown) {
  q.run('INSERT INTO order_events (order_id, actor_id, event, details) VALUES (?, ?, ?, ?)', orderId, actorId, event, details === undefined ? null : JSON.stringify(details));
}

export function offerEvent(threadId: string, offerId: string | null, actorId: string | null, action: string, details?: unknown) {
  q.run('INSERT INTO offer_events (thread_id, offer_id, actor_id, action, details) VALUES (?, ?, ?, ?, ?)', threadId, offerId, actorId, action, details === undefined ? null : JSON.stringify(details));
}

/** Derive a lot's marketplace status from its quantities and open negotiations. */
export function refreshLotStatus(lotId: string) {
  const l = q.get<Row>('SELECT * FROM produce_lots WHERE id = ?', lotId);
  if (!l || ['draft', 'withdrawn', 'expired', 'disputed'].includes(l.status)) return;
  let status: string;
  if (l.quantity_available <= 1e-9 && l.quantity_reserved <= 1e-9 && l.quantity_sold > 0) status = 'sold';
  else if (l.quantity_available <= 1e-9 && l.quantity_reserved > 0) status = 'reserved';
  else if (l.quantity_sold > 0) status = 'partially_sold';
  else {
    const open = q.all<Row>(`SELECT status, (SELECT COUNT(*) FROM offers o2 WHERE o2.thread_id = o.thread_id) n FROM offers o WHERE lot_id = ? AND status = 'pending'`, lotId);
    // Part reserved but some still available: the lot stays open for buyers.
    status = open.some((o) => o.n > 1) ? 'negotiation' : open.length ? 'offer_received' : 'published';
  }
  if (status !== l.status) q.run(`UPDATE produce_lots SET status = ?, updated_at = datetime('now') WHERE id = ?`, status, lotId);
}

/** Atomically reserve lot quantity. Throws if not enough remains (prevents overselling). */
export function reserveLot(lotId: string, qty: number) {
  const r = q.run(
    `UPDATE produce_lots SET quantity_available = quantity_available - ?, quantity_reserved = quantity_reserved + ?, updated_at = datetime('now')
     WHERE id = ? AND quantity_available >= ? - 1e-9`, qty, qty, lotId, qty);
  if (r.changes !== 1) throw new HttpError(409, 'That quantity is no longer available. Someone else may have bought it.', 'insufficient_quantity');
}

export function releaseLot(lotId: string | null, qty: number) {
  if (!lotId) return;
  q.run(`UPDATE produce_lots SET quantity_available = quantity_available + ?, quantity_reserved = MAX(quantity_reserved - ?, 0), updated_at = datetime('now') WHERE id = ?`, qty, qty, lotId);
  refreshLotStatus(lotId);
}

export function releaseDemand(demandId: string | null, qty: number, unit: string) {
  if (!demandId) return;
  const d = q.get<Row>('SELECT unit FROM demand_requests WHERE id = ?', demandId);
  if (!d) return;
  const inDemandUnit = toQtl(qty, unit) / toQtl(1, d.unit);
  q.run(`UPDATE demand_requests SET quantity_committed = MAX(quantity_committed - ?, 0),
         status = CASE WHEN status IN ('filled','partially_filled') THEN (CASE WHEN quantity_committed - ? <= 0 THEN 'open' ELSE 'partially_filled' END) ELSE status END,
         updated_at = datetime('now') WHERE id = ?`, inDemandUnit, inDemandUnit, demandId);
}

/** Creates the transaction record for an accepted offer. Must run inside q.tx(). */
export function createOrderFromOffer(offer: Row, actorId: string) {
  const lot = q.get<Row>('SELECT * FROM produce_lots WHERE id = ?', offer.lot_id);
  if (!lot) throw new HttpError(409, 'The produce lot is no longer available', 'lot_gone');
  reserveLot(lot.id, offer.quantity);
  if (offer.demand_id) {
    const d = q.get<Row>('SELECT * FROM demand_requests WHERE id = ?', offer.demand_id)!;
    const inDemandUnit = toQtl(offer.quantity, offer.unit) / toQtl(1, d.unit);
    const r = q.run(`UPDATE demand_requests SET quantity_committed = quantity_committed + ?,
        status = CASE WHEN quantity_committed + ? >= quantity - 1e-9 THEN 'filled' ELSE 'partially_filled' END, updated_at = datetime('now')
        WHERE id = ? AND status IN ('open','partially_filled') AND quantity_committed + ? <= quantity + 1e-9`, inDemandUnit, inDemandUnit, d.id, inDemandUnit);
    if (r.changes !== 1) throw new HttpError(409, 'This buyer requirement is already filled', 'demand_filled');
  }
  const charges: Charge[] = JSON.parse(offer.charges || '[]');
  const b = breakdown(offer.quantity, offer.price_per_unit, charges);
  const orderId = id();
  const orderNo = ref('ORD');
  insert('orders', {
    id: orderId, order_no: orderNo, offer_id: offer.id, lot_id: lot.id, demand_id: offer.demand_id, farmer_id: lot.farmer_id, buyer_id: offer.buyer_id,
    commodity: lot.commodity, variety: lot.variety, quantity: offer.quantity, unit: offer.unit, price_per_unit: offer.price_per_unit,
    delivery_mode: offer.delivery_mode, pickup_location: [lot.pickup_village, lot.district, lot.state].filter(Boolean).join(', '),
    delivery_location: offer.demand_id ? q.get<Row>('SELECT delivery_location FROM demand_requests WHERE id = ?', offer.demand_id)?.delivery_location : null,
    payment_terms: offer.payment_terms, advance_pct: offer.advance_pct, payment_due_days: offer.payment_due_days,
    charges, breakdown: b, product_value: b.product_value, buyer_payable: b.buyer_payable, farmer_net: b.farmer_net,
    reservation_expires_at: new Date(Date.now() + Number(getSetting('order_confirm_hours')) * 3600_000).toISOString(),
  });
  insert('order_items', {
    id: id(), order_id: orderId, lot_id: lot.id, commodity: lot.commodity, variety: lot.variety, quantity: offer.quantity, unit: offer.unit,
    price_per_unit: offer.price_per_unit, line_value: b.product_value,
  });
  orderEvent(orderId, actorId, 'created', { from_offer: offer.id, terms: { quantity: offer.quantity, unit: offer.unit, price_per_unit: offer.price_per_unit } });
  refreshLotStatus(lot.id);
  return { orderId, orderNo };
}

/** Payment schedule created when both sides confirm the order. */
export function schedulePayments(order: Row) {
  const total = order.buyer_payable;
  const due = (days: number) => new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10);
  const add = (kind: string, amount: number, dueDate: string | null) =>
    insert('payment_records', { id: id(), ref: ref('PAY'), order_id: order.id, kind, payer_id: order.buyer_id, payee_id: order.farmer_id, amount: Math.round(amount * 100) / 100, status: 'required', due_date: dueDate });
  if (order.payment_terms === 'advance_and_balance' && order.advance_pct) {
    const adv = (total * order.advance_pct) / 100;
    add('advance', adv, due(1));
    add('balance', total - adv, null); // due on delivery
  } else if (order.payment_terms === 'within_days') {
    add('full', total, null); // due date set at delivery + N days
  } else {
    add('full', total, null); // on delivery
  }
}

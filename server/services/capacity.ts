import { q, type Row } from '../db/index.ts';

/**
 * Storage capacity is tracked per day. A booking occupies capacity on every day
 * from start_date to end_date (inclusive) while it is in a holding status.
 * Requests awaiting the facility's answer hold capacity until hold_expires_at.
 */
export const HOLDING_STATUSES = ['availability_requested', 'temporarily_reserved', 'awaiting_payment', 'confirmed', 'check_in_scheduled', 'received', 'in_storage', 'release_requested'];

const days = (start: string, end: string) => {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  while (d <= e && out.length <= 400) { out.push(d.toISOString().slice(0, 10)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
};

export function dayCount(start: string, end: string) {
  return Math.round((Date.parse(end) - Date.parse(start)) / 86400_000) + 1;
}

/** Minimum free capacity (quintal) across the date range, plus per-day detail. */
export function availability(facilityId: string, start: string, end: string, excludeBookingId?: string) {
  const f = q.get<Row>('SELECT total_capacity_qtl FROM storage_facilities WHERE id = ?', facilityId);
  if (!f) return null;
  const bookings = q.all<Row>(
    `SELECT start_date, end_date, quantity_qtl FROM storage_bookings
     WHERE facility_id = ? AND id != ? AND status IN (${HOLDING_STATUSES.map(() => '?').join(',')})
       AND NOT (status = 'availability_requested' AND hold_expires_at IS NOT NULL AND hold_expires_at < ?)
       AND start_date <= ? AND end_date >= ?`,
    facilityId, excludeBookingId ?? '', ...HOLDING_STATUSES, new Date().toISOString(), end, start);
  const blackouts = q.all<Row>('SELECT start_date, end_date, capacity_reduction_qtl FROM facility_blackouts WHERE facility_id = ? AND start_date <= ? AND end_date >= ?', facilityId, end, start);
  let minFree = Infinity;
  let occupiedPeak = 0;
  for (const day of days(start, end)) {
    const used = bookings.filter((b) => b.start_date <= day && b.end_date >= day).reduce((s, b) => s + b.quantity_qtl, 0);
    const blocked = blackouts.filter((b) => b.start_date <= day && b.end_date >= day).reduce((s, b) => s + b.capacity_reduction_qtl, 0);
    const free = Math.max(0, f.total_capacity_qtl - used - blocked);
    if (free < minFree) minFree = free;
    if (used > occupiedPeak) occupiedPeak = used;
  }
  return { total_qtl: f.total_capacity_qtl, available_qtl: minFree === Infinity ? f.total_capacity_qtl : Math.round(minFree * 100) / 100, peak_occupied_qtl: occupiedPeak };
}

/** Snapshot of occupancy today: stored (received) vs reserved (booked, not yet in). */
export function occupancyToday(facilityId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const r = q.get<Row>(
    `SELECT
       COALESCE(SUM(CASE WHEN status IN ('received','in_storage','release_requested') THEN COALESCE(received_qty_qtl, quantity_qtl) END), 0) AS occupied,
       COALESCE(SUM(CASE WHEN status IN ('availability_requested','temporarily_reserved','awaiting_payment','confirmed','check_in_scheduled') THEN quantity_qtl END), 0) AS reserved
     FROM storage_bookings WHERE facility_id = ? AND start_date <= ? AND end_date >= ?
       AND NOT (status = 'availability_requested' AND hold_expires_at < ?)`, facilityId, today, today, new Date().toISOString())!;
  return { occupied_qtl: r.occupied, reserved_qtl: r.reserved };
}

const PERIOD_DAYS: Record<string, number> = { day: 1, week: 7, month: 30 };

/** Transparent storage cost estimate using the facility's published rate card. */
export function storageEstimate(f: Row, cropCategory: string | null, quantityQtl: number, start: string, end: string) {
  const rates = q.all<Row>('SELECT * FROM storage_rates WHERE facility_id = ?', f.id);
  const rate = rates.find((r) => r.commodity_category === cropCategory) ?? rates.find((r) => r.commodity_category == null);
  if (!rate) return null;
  const nDays = dayCount(start, end);
  const periods = Math.ceil(nDays / PERIOD_DAYS[rate.period]);
  const unitQty = rate.unit === 'tonne' ? quantityQtl / 10 : quantityQtl;
  const storage = unitQty * rate.price * periods;
  const lines = [
    { label: 'Booking fee', amount: f.booking_fee },
    { label: `Storage: ${unitQty.toFixed(2)} ${rate.unit} × ₹${rate.price}/${rate.unit}/${rate.period} × ${periods} ${rate.period}(s)`, amount: storage },
    { label: `Loading (₹${f.loading_per_qtl}/qtl)`, amount: f.loading_per_qtl * quantityQtl },
    { label: `Unloading (₹${f.unloading_per_qtl}/qtl)`, amount: f.unloading_per_qtl * quantityQtl },
    { label: `Handling (₹${f.handling_per_qtl}/qtl)`, amount: f.handling_per_qtl * quantityQtl },
  ].filter((l) => l.amount > 0).map((l) => ({ ...l, amount: Math.round(l.amount * 100) / 100 }));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const tax = Math.round(subtotal * (f.tax_pct || 0)) / 100;
  return {
    rate: { price: rate.price, unit: rate.unit, period: rate.period, category: rate.commodity_category },
    days: nDays, periods, lines, subtotal: Math.round(subtotal * 100) / 100, tax_pct: f.tax_pct, tax,
    total: Math.round((subtotal + tax) * 100) / 100,
    note: 'Estimate from the facility\'s published rate card. Final charges are based on actual days stored and quantity received.',
  };
}

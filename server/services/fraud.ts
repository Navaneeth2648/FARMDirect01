import { q, type Row } from '../db/index.ts';
import { HttpError, id } from '../lib/http.ts';

/**
 * Fraud and abuse safeguards. Rules raise review flags for staff; they never
 * label anyone a fraudster automatically. Only clear-cut abuse (exact
 * duplicates, request floods, active restrictions) is blocked outright.
 */

export function flag(subjectType: string, subjectId: string, userId: string | null, rule: string, severity: 'low' | 'medium' | 'high', evidence: Record<string, unknown>, dedupeKey?: string) {
  q.run(
    `INSERT OR IGNORE INTO fraud_flags (id, subject_type, subject_id, user_id, rule, severity, evidence, dedupe_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    id(), subjectType, subjectId, userId, rule, severity, JSON.stringify(evidence), dedupeKey ?? `${rule}:${subjectType}:${subjectId}`,
  );
}

const count = (sql: string, ...p: unknown[]) => q.get<Row>(sql, ...p)!.n as number;

export function checkRegistrationBurst(ipHash: string, userId: string) {
  const n = count(`SELECT COUNT(*) n FROM audit_logs WHERE action = 'user.register' AND ip_hash = ? AND created_at > datetime('now', '-1 hour')`, ipHash);
  if (n >= 5) flag('user', userId, userId, 'registration_burst', 'medium', { registrationsFromSameNetworkLastHour: n }, `registration_burst:${ipHash}:${new Date().toISOString().slice(0, 13)}`);
}

export function checkListingBurst(userId: string) {
  const n = count(`SELECT COUNT(*) n FROM produce_lots WHERE farmer_id = ? AND created_at > datetime('now', '-1 day')`, userId);
  if (n > 10) flag('user', userId, userId, 'listing_burst', 'medium', { lotsLast24h: n }, `listing_burst:${userId}:${new Date().toISOString().slice(0, 10)}`);
}

/** Exact duplicates of an active lot are refused; the caller can edit the existing lot instead. */
export function assertNotDuplicateLot(userId: string, l: { commodity: string; variety?: string | null; quantity_total: number; price_per_unit?: number | null }, excludeId?: string) {
  const dup = q.get<Row>(
    `SELECT id FROM produce_lots WHERE farmer_id = ? AND lower(commodity) = lower(?) AND COALESCE(lower(variety), '') = COALESCE(lower(?), '')
       AND quantity_total = ? AND COALESCE(price_per_unit, -1) = COALESCE(?, -1)
       AND status IN ('draft','published','offer_received','negotiation','reserved','partially_sold') AND id != ?`,
    userId, l.commodity, l.variety ?? null, l.quantity_total, l.price_per_unit ?? null, excludeId ?? '');
  if (dup) {
    flag('lot', dup.id, userId, 'duplicate_listing_attempt', 'low', { commodity: l.commodity, quantity: l.quantity_total });
    throw new HttpError(409, 'You already have an identical lot. Edit that lot instead of creating a copy.', 'duplicate_lot', { existingLotId: dup.id });
  }
}

export const toQtl = (qty: number, unit: string) => (unit === 'kg' ? qty / 100 : unit === 'tonne' ? qty * 10 : qty);
export const perQtl = (price: number, unit: string) => (unit === 'kg' ? price * 100 : unit === 'tonne' ? price / 10 : price);

/** Flags prices far from recent official mandi modal prices (does not block: quality and variety vary). */
export function checkPriceOutlier(subjectType: string, subjectId: string, userId: string, agmarknetName: string | null | undefined, state: string | null | undefined, pricePerUnit: number, unit: string) {
  if (!agmarknetName) return;
  const rows = q.all<Row>(
    `SELECT modal_price FROM market_prices WHERE commodity = ? ${state ? 'AND state = ?' : ''} AND modal_price IS NOT NULL
     AND arrival_date >= date('now', '-30 day') ORDER BY modal_price`, ...(state ? [agmarknetName, state] : [agmarknetName]));
  if (rows.length < 3) return; // not enough reference data
  const median = rows[Math.floor(rows.length / 2)].modal_price as number;
  const p = perQtl(pricePerUnit, unit);
  if (p > median * 3 || p < median * 0.3) {
    flag(subjectType, subjectId, userId, 'price_outlier', 'low', { pricePerQuintal: p, mandiMedianModal30d: median, referenceRecords: rows.length });
  }
}

export function assertOfferRate(userId: string) {
  const n = count(`SELECT COUNT(*) n FROM offers WHERE created_by = ? AND created_at > datetime('now', '-1 hour')`, userId);
  if (n >= 20) {
    flag('user', userId, userId, 'offer_flood', 'medium', { offersLastHour: n }, `offer_flood:${userId}:${new Date().toISOString().slice(0, 13)}`);
    throw new HttpError(429, 'Too many offers in a short time. Please wait before sending more.', 'rate_limited');
  }
}

export function checkCancellations(userId: string) {
  const orders = count(`SELECT COUNT(*) n FROM orders WHERE cancelled_by = ? AND cancelled_at > datetime('now', '-30 day') AND confirmed_at IS NOT NULL`, userId);
  const bookings = count(`SELECT COUNT(*) n FROM storage_bookings WHERE farmer_id = ? AND status = 'cancelled' AND updated_at > datetime('now', '-30 day')`, userId);
  if (orders >= 3) flag('user', userId, userId, 'repeated_confirmed_cancellations', 'medium', { cancelledConfirmedOrders30d: orders }, `cancel_orders:${userId}:${new Date().toISOString().slice(0, 7)}`);
  if (bookings >= 3) flag('user', userId, userId, 'repeated_booking_cancellations', 'low', { cancelledBookings30d: bookings }, `cancel_bookings:${userId}:${new Date().toISOString().slice(0, 7)}`);
}

export function checkNonDelivery(userId: string) {
  const n = count(`SELECT COUNT(*) n FROM disputes WHERE against_id = ? AND category = 'non_delivery' AND created_at > datetime('now', '-90 day')`, userId);
  if (n >= 2) flag('user', userId, userId, 'repeated_non_delivery', 'high', { nonDeliveryDisputes90d: n }, `non_delivery:${userId}:${new Date().toISOString().slice(0, 7)}`);
}

export function checkBusinessIdentifierConflict(userId: string, field: 'gstin' | 'pan', value?: string | null) {
  if (!value) return;
  const others = q.all<Row>(`SELECT user_id FROM buyer_profiles WHERE ${field} = ? AND user_id != ?`, value, userId);
  if (others.length) {
    flag('user', userId, userId, `${field}_shared_across_accounts`, 'high', { otherAccounts: others.length }, `${field}_conflict:${userId}`);
  }
}

export function activeRestriction(userId: string, kind: 'no_offers' | 'no_listings' | 'no_bookings') {
  return q.get<Row>(`SELECT * FROM account_restrictions WHERE user_id = ? AND lifted_at IS NULL AND kind IN (?, 'full') ORDER BY created_at DESC LIMIT 1`, userId, kind);
}

export function assertNotRestricted(userId: string, kind: 'no_offers' | 'no_listings' | 'no_bookings') {
  const r = activeRestriction(userId, kind);
  if (r) throw new HttpError(403, `Your account is restricted from this action: ${r.reason}. You can appeal from your account page.`, 'restricted', { restrictionId: r.id });
}

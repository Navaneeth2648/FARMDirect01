import { Router, type Request } from 'express';
import { z } from 'zod';
import { q, out, insert, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, id, notFound, parse, zOptText, zText } from '../lib/http.ts';
import { hasRecentStepUp } from '../lib/auth.ts';
import { hasPerm } from '../lib/permissions.ts';
import { audit } from '../lib/security.ts';
import { farmerStanding } from '../services/standing.ts';
import { assertNotRestricted, assertOfferRate, checkCancellations, checkPriceOutlier, toQtl } from '../services/fraud.ts';
import { getSetting } from '../services/settings.ts';
import { breakdown, settlement, type Charge } from '../services/pricing.ts';
import { ACTIVE_LOT_STATUSES, createOrderFromOffer, offerEvent, orderEvent, ref, refreshLotStatus, releaseDemand, releaseLot, schedulePayments } from '../services/trade.ts';
import { notifyT } from '../services/messages.ts';
import { assertBuyerCanTransact } from './marketplace.ts';

export const offersRouter = Router();
export const ordersRouter = Router();

const ChargeSchema = z.object({
  label: z.string().trim().min(2).max(100), amount: z.number().min(0).max(1e8),
  payer: z.enum(['buyer', 'farmer']), kind: z.enum(['packaging', 'transport', 'storage', 'handling', 'other']),
});
const TermsSchema = z.object({
  quantity: z.number().positive().max(1e7),
  price_per_unit: z.number().min(0).max(1e8),
  delivery_mode: z.enum(['buyer_pickup', 'farmer_delivery', 'arranged_transport', 'from_storage']),
  charges: z.array(ChargeSchema).max(10).default([]),
  payment_terms: z.enum(['on_delivery', 'advance_and_balance', 'within_days']),
  advance_pct: z.number().min(1).max(100).optional().nullable(),
  payment_due_days: z.number().int().min(1).max(90).optional().nullable(),
  note: zOptText(1000),
  expires_hours: z.number().int().min(1).max(168).optional(),
}).superRefine((t, ctx) => {
  if (t.payment_terms === 'advance_and_balance' && !t.advance_pct) ctx.addIssue({ code: 'custom', path: ['advance_pct'], message: 'Enter the advance percentage' });
  if (t.payment_terms === 'within_days' && !t.payment_due_days) ctx.addIssue({ code: 'custom', path: ['payment_due_days'], message: 'Enter number of days' });
});

const isParty = (o: Row, userId: string) => o.buyer_id === userId || o.farmer_id === userId;

/** Farmers without identity verification have a per-order value cap. */
function assertWithinFarmerCap(farmerId: string, value: number) {
  const s = farmerStanding(farmerId)!;
  if (!s.transaction_eligible) throw new HttpError(403, 'The farmer\'s account is not yet eligible to transact', 'farmer_not_eligible', { next_step: s.next_step });
  if (s.max_order_value_inr != null && value > s.max_order_value_inr) {
    throw new HttpError(403, `Orders above ₹${s.max_order_value_inr.toLocaleString('en-IN')} need the farmer to complete identity verification.`, 'over_limit');
  }
}

function validateAgainstLot(lot: Row, qty: number) {
  if (!ACTIVE_LOT_STATUSES.includes(lot.status) || (lot.expires_at && lot.expires_at < new Date().toISOString())) throw new HttpError(409, 'This lot is not open for offers', 'lot_closed');
  if (qty > lot.quantity_available + 1e-9) throw new HttpError(409, `Only ${lot.quantity_available} ${lot.unit} is available`, 'insufficient_quantity');
  if (!lot.allow_partial && Math.abs(qty - lot.quantity_available) > 1e-9) throw new HttpError(400, 'This farmer sells the full lot only', 'full_lot_only');
  if (lot.min_order_qty && qty < lot.min_order_qty - 1e-9 && qty < lot.quantity_available) throw new HttpError(400, `Minimum order is ${lot.min_order_qty} ${lot.unit}`, 'below_minimum');
}

// ---------------- Offers ----------------
offersRouter.post('/', ah(async (req, res) => {
  const body = parse(TermsSchema.and(z.object({ lot_id: z.string(), demand_id: z.string().optional().nullable() })), req.body);
  const uid = req.user!.id;
  const lot = q.get<Row>('SELECT * FROM produce_lots WHERE id = ?', body.lot_id);
  if (!lot) throw notFound('Lot');
  let buyerId: string, farmerId: string;
  if (req.user!.role === 'buyer') {
    assertBuyerCanTransact(uid);
    if (body.demand_id) throw new HttpError(400, 'Buyers make offers on lots directly', 'validation_error');
    buyerId = uid; farmerId = lot.farmer_id;
    if (q.get(`SELECT 1 FROM offers WHERE lot_id = ? AND buyer_id = ? AND status = 'pending'`, lot.id, uid)) {
      throw new HttpError(409, 'You already have an open offer on this lot. Continue the negotiation there.', 'open_thread');
    }
  } else if (req.user!.role === 'farmer' || req.user!.role === 'fpo_manager') {
    // A farmer responds to a buyer requirement with one of their lots.
    if (lot.farmer_id !== uid) throw forbidden('You can only offer your own produce');
    if (!body.demand_id) throw new HttpError(400, 'Choose the buyer requirement you are responding to', 'validation_error');
    const d = q.get<Row>(`SELECT * FROM demand_requests WHERE id = ? AND status IN ('open','partially_filled')`, body.demand_id);
    if (!d) throw notFound('Open requirement');
    const remainingInLotUnit = toQtl(d.quantity - d.quantity_committed, d.unit) / toQtl(1, lot.unit);
    if (body.quantity > remainingInLotUnit + 1e-9) throw new HttpError(400, `The buyer needs only ${remainingInLotUnit.toFixed(2)} ${lot.unit} more`, 'over_demand');
    if (q.get(`SELECT 1 FROM offers WHERE demand_id = ? AND lot_id = ? AND status = 'pending'`, d.id, lot.id)) throw new HttpError(409, 'You already responded with this lot', 'open_thread');
    const s = farmerStanding(uid)!;
    if (!s.transaction_eligible) throw new HttpError(403, 'Complete your profile before making offers', 'not_eligible', { next_step: s.next_step });
    assertNotRestricted(uid, 'no_offers');
    buyerId = d.buyer_id; farmerId = uid;
  } else {
    throw forbidden('Only buyers and farmers can make offers');
  }
  validateAgainstLot(lot, body.quantity);
  assertOfferRate(uid);
  const oid = id();
  const hours = body.expires_hours ?? Number(getSetting('offer_expiry_hours'));
  insert('offers', {
    id: oid, thread_id: oid, lot_id: lot.id, demand_id: body.demand_id ?? null, buyer_id: buyerId, farmer_id: farmerId, created_by: uid,
    quantity: body.quantity, unit: lot.unit, price_per_unit: body.price_per_unit, delivery_mode: body.delivery_mode, charges: body.charges,
    payment_terms: body.payment_terms, advance_pct: body.advance_pct ?? null, payment_due_days: body.payment_due_days ?? null, note: body.note ?? null,
    expires_at: new Date(Date.now() + hours * 3600_000).toISOString(),
  });
  offerEvent(oid, oid, uid, 'offered', { quantity: body.quantity, price_per_unit: body.price_per_unit });
  const crop = lot.crop_id ? q.get<Row>('SELECT agmarknet_name FROM crops WHERE id = ?', lot.crop_id) : undefined;
  checkPriceOutlier('offer', oid, uid, crop?.agmarknet_name, lot.state, body.price_per_unit, lot.unit);
  refreshLotStatus(lot.id);
  notifyT(uid === buyerId ? farmerId : buyerId, 'order', 'offer_received', { commodity: lot.commodity }, `offer:${oid}`, `/trade/threads/${oid}`);
  audit(req, 'offer.create', 'offer', oid);
  res.status(201).json({ offer: out(q.get('SELECT * FROM offers WHERE id = ?', oid)), preview: breakdown(body.quantity, body.price_per_unit, body.charges as Charge[]) });
}));

/** Price breakdown preview before sending or accepting an offer. */
offersRouter.post('/preview', ah(async (req, res) => {
  const t = parse(z.object({ quantity: z.number().positive(), price_per_unit: z.number().min(0), charges: z.array(ChargeSchema).max(10).default([]) }), req.body);
  res.json(breakdown(t.quantity, t.price_per_unit, t.charges as Charge[]));
}));

offersRouter.get('/threads', ah(async (req, res) => {
  const uid = req.user!.id;
  const rows = q.all<Row>(
    `SELECT o.*, l.commodity, l.variety, l.district, l.state FROM offers o LEFT JOIN produce_lots l ON l.id = o.lot_id
     WHERE (o.buyer_id = ? OR o.farmer_id = ?) AND o.created_at = (SELECT MAX(created_at) FROM offers o2 WHERE o2.thread_id = o.thread_id)
     ORDER BY o.created_at DESC LIMIT 200`, uid, uid);
  res.json({ threads: rows.map((o) => ({ ...out(o), awaiting_me: o.status === 'pending' && o.created_by !== uid })) });
}));

offersRouter.get('/threads/:threadId', ah(async (req, res) => {
  const offers = q.all<Row>('SELECT * FROM offers WHERE thread_id = ? ORDER BY created_at', req.params.threadId);
  if (!offers.length || !isParty(offers[0], req.user!.id)) throw notFound('Negotiation');
  const lot = q.get<Row>('SELECT id, commodity, variety, unit, quantity_available, price_per_unit, district, state, quality_grade FROM produce_lots WHERE id = ?', offers[0].lot_id);
  const latest = offers[offers.length - 1];
  const order = q.get<Row>('SELECT id, order_no, status FROM orders WHERE offer_id IN (' + offers.map(() => '?').join(',') + ')', ...offers.map((o) => o.id));
  res.json({
    offers: offers.map((o) => ({ ...out(o), breakdown: breakdown(o.quantity, o.price_per_unit, JSON.parse(o.charges)) })),
    events: q.all('SELECT action, actor_id, details, created_at FROM offer_events WHERE thread_id = ? ORDER BY id', req.params.threadId),
    lot, order: order ?? null,
    can_respond: latest.status === 'pending' && latest.created_by !== req.user!.id && latest.expires_at > new Date().toISOString(),
    my_side: offers[0].buyer_id === req.user!.id ? 'buyer' : 'farmer',
  });
}));

offersRouter.post('/:id/respond', ah(async (req, res) => {
  const b = parse(z.object({ action: z.enum(['accept', 'reject', 'counter']), counter: TermsSchema.optional(), confirm: z.boolean().optional() }), req.body);
  const uid = req.user!.id;
  const o = q.get<Row>('SELECT * FROM offers WHERE id = ?', req.params.id);
  if (!o || !isParty(o, uid)) throw notFound('Offer');
  if (o.created_by === uid) throw forbidden('You cannot respond to your own offer');
  if (o.status !== 'pending') throw new HttpError(409, `This offer is already ${o.status}`, 'not_pending');
  if (o.expires_at < new Date().toISOString()) {
    q.run(`UPDATE offers SET status = 'expired' WHERE id = ?`, o.id);
    throw new HttpError(409, 'This offer has expired', 'expired');
  }
  const lot = q.get<Row>('SELECT * FROM produce_lots WHERE id = ?', o.lot_id)!;
  const other = uid === o.buyer_id ? o.farmer_id : o.buyer_id;

  if (b.action === 'reject') {
    q.run(`UPDATE offers SET status = 'rejected', responded_at = datetime('now') WHERE id = ? AND status = 'pending'`, o.id);
    offerEvent(o.thread_id, o.id, uid, 'rejected');
    refreshLotStatus(lot.id);
    notifyT(other, 'order', 'offer_rejected', { commodity: lot.commodity }, `offer-rejected:${o.id}`, `/trade/threads/${o.thread_id}`);
    return res.json({ ok: true });
  }

  if (b.action === 'counter') {
    if (!b.counter) throw new HttpError(400, 'Enter your counter-offer terms', 'validation_error');
    if (uid === o.buyer_id) assertBuyerCanTransact(uid);
    validateAgainstLot(lot, b.counter.quantity);
    assertOfferRate(uid);
    const nid = id();
    q.tx(() => {
      const r = q.run(`UPDATE offers SET status = 'countered', responded_at = datetime('now') WHERE id = ? AND status = 'pending'`, o.id);
      if (r.changes !== 1) throw new HttpError(409, 'This offer was just answered', 'not_pending');
      insert('offers', {
        id: nid, thread_id: o.thread_id, lot_id: o.lot_id, demand_id: o.demand_id, buyer_id: o.buyer_id, farmer_id: o.farmer_id, created_by: uid,
        quantity: b.counter!.quantity, unit: o.unit, price_per_unit: b.counter!.price_per_unit, delivery_mode: b.counter!.delivery_mode,
        charges: b.counter!.charges, payment_terms: b.counter!.payment_terms, advance_pct: b.counter!.advance_pct ?? null,
        payment_due_days: b.counter!.payment_due_days ?? null, note: b.counter!.note ?? null,
        expires_at: new Date(Date.now() + (b.counter!.expires_hours ?? Number(getSetting('offer_expiry_hours'))) * 3600_000).toISOString(),
      });
      offerEvent(o.thread_id, nid, uid, 'countered', { quantity: b.counter!.quantity, price_per_unit: b.counter!.price_per_unit });
    });
    refreshLotStatus(lot.id);
    notifyT(other, 'order', 'offer_countered', { commodity: lot.commodity }, `offer:${nid}`, `/trade/threads/${o.thread_id}`);
    return res.status(201).json({ offer: out(q.get('SELECT * FROM offers WHERE id = ?', nid)) });
  }

  // accept → creates the transaction record and reserves quantity atomically
  if (!b.confirm) throw new HttpError(400, 'Please confirm that you accept these terms', 'confirmation_required');
  if (uid === o.buyer_id) assertBuyerCanTransact(uid);
  else { assertNotRestricted(uid, 'no_offers'); if (q.get<Row>('SELECT role FROM users WHERE id = ?', o.buyer_id)?.role === 'buyer') assertBuyerCanTransact(o.buyer_id); }
  const value = o.quantity * o.price_per_unit;
  assertWithinFarmerCap(o.farmer_id, value);
  let result!: { orderId: string; orderNo: string };
  q.tx(() => {
    const r = q.run(`UPDATE offers SET status = 'accepted', responded_at = datetime('now') WHERE id = ? AND status = 'pending'`, o.id);
    if (r.changes !== 1) throw new HttpError(409, 'This offer was just answered', 'not_pending');
    result = createOrderFromOffer(o, uid);
    offerEvent(o.thread_id, o.id, uid, 'accepted', { order: result.orderNo });
  });
  notifyT(other, 'order', 'offer_accepted', { commodity: lot.commodity }, `offer-accepted:${o.id}`, `/trade/orders/${result.orderId}`);
  audit(req, 'offer.accept', 'offer', o.id, { order: result.orderNo });
  res.status(201).json({ orderId: result.orderId, orderNo: result.orderNo });
}));

offersRouter.post('/:id/withdraw', ah(async (req, res) => {
  const r = q.run(`UPDATE offers SET status = 'withdrawn', responded_at = datetime('now') WHERE id = ? AND created_by = ? AND status = 'pending'`, req.params.id, req.user!.id);
  if (!r.changes) throw notFound('Pending offer');
  const o = q.get<Row>('SELECT thread_id, lot_id FROM offers WHERE id = ?', req.params.id)!;
  offerEvent(o.thread_id, req.params.id, req.user!.id, 'withdrawn');
  refreshLotStatus(o.lot_id);
  res.json({ ok: true });
}));

// ---------------- Orders ----------------
function loadOrder(req: Request, orderId: string, opts: { partyOnly?: boolean } = {}) {
  const o = q.get<Row>('SELECT * FROM orders WHERE id = ?', orderId);
  if (!o) throw notFound('Order');
  const party = o.farmer_id === req.user!.id || o.buyer_id === req.user!.id;
  if (!party && (opts.partyOnly || !hasPerm(req.user!.role, 'orders.view'))) throw notFound('Order');
  return { o, party, side: o.farmer_id === req.user!.id ? 'farmer' : o.buyer_id === req.user!.id ? 'buyer' : 'staff' };
}

ordersRouter.get('/', ah(async (req, res) => {
  const uid = req.user!.id;
  const rows = q.all<Row>(`SELECT o.*, (SELECT COALESCE(SUM(amount),0) FROM payment_records p WHERE p.order_id = o.id AND p.status = 'confirmed' AND p.kind != 'refund') AS paid
    FROM orders o WHERE o.farmer_id = ? OR o.buyer_id = ? ORDER BY o.updated_at DESC LIMIT 200`, uid, uid);
  res.json({ orders: rows.map((o) => ({ ...out(o), my_side: o.farmer_id === uid ? 'farmer' : 'buyer' })) });
}));

ordersRouter.get('/:id', ah(async (req, res) => {
  const { o, side } = loadOrder(req, req.params.id);
  const confirmed = !!o.confirmed_at;
  // Contact details are shared only after both sides confirm.
  const contact = (uid: string | null) => {
    if (!uid) return null;
    const u = q.get<Row>('SELECT full_name, phone, village, district, state FROM users WHERE id = ?', uid);
    const bp = q.get<Row>('SELECT business_name FROM buyer_profiles WHERE user_id = ?', uid);
    return { name: u?.full_name, business_name: bp?.business_name ?? null, phone: confirmed || side === 'staff' ? u?.phone : null, district: u?.district, state: u?.state };
  };
  res.json({
    order: out(o), my_side: side,
    farmer: contact(o.farmer_id), buyer: contact(o.buyer_id),
    events: q.all('SELECT event, actor_id, details, created_at FROM order_events WHERE order_id = ? ORDER BY id', o.id),
    amendments: q.all('SELECT * FROM order_amendments WHERE order_id = ? ORDER BY created_at DESC', o.id).map(out),
    payments: q.all('SELECT * FROM payment_records WHERE order_id = ? ORDER BY created_at', o.id),
    transport: q.all('SELECT * FROM transport_requests WHERE order_id = ? ORDER BY created_at DESC', o.id),
    disputes: q.all('SELECT id, ref, status, category, created_at FROM disputes WHERE order_id = ?', o.id),
    stepup_required: o.buyer_payable >= Number(getSetting('stepup_threshold_inr')),
  });
}));

function requireStepUp(req: Request, reason: string) {
  if (!hasRecentStepUp(req)) throw new HttpError(403, `${reason} Please confirm with the one-time code sent to your phone.`, 'step_up_required');
}

ordersRouter.post('/:id/confirm', ah(async (req, res) => {
  const { o, side } = loadOrder(req, req.params.id, { partyOnly: true });
  if (o.status !== 'pending_confirmation') throw new HttpError(409, `Order is ${o.status}`, 'bad_state');
  if (o.reservation_expires_at && o.reservation_expires_at < new Date().toISOString()) throw new HttpError(409, 'The confirmation window has passed. The reservation was released.', 'expired');
  if (o.buyer_payable >= Number(getSetting('stepup_threshold_inr'))) requireStepUp(req, 'This is a high-value order.');
  if (side === 'buyer') assertBuyerCanTransact(req.user!.id);
  const col = side === 'farmer' ? 'farmer_confirmed_at' : 'buyer_confirmed_at';
  q.tx(() => {
    q.run(`UPDATE orders SET ${col} = COALESCE(${col}, datetime('now')), updated_at = datetime('now') WHERE id = ?`, o.id);
    orderEvent(o.id, req.user!.id, `${side}_confirmed`);
    const now = q.get<Row>('SELECT * FROM orders WHERE id = ?', o.id)!;
    if (now.farmer_confirmed_at && now.buyer_confirmed_at) {
      q.run(`UPDATE orders SET status = 'confirmed', confirmed_at = datetime('now'), reservation_expires_at = NULL WHERE id = ?`, o.id);
      orderEvent(o.id, null, 'confirmed');
      schedulePayments(now);
    }
  });
  const updated = q.get<Row>('SELECT * FROM orders WHERE id = ?', o.id)!;
  if (updated.status === 'confirmed') {
    for (const uid of [o.farmer_id, o.buyer_id]) notifyT(uid, 'order', 'order_confirmed', { ref: o.order_no }, `order-confirmed:${o.id}`, `/trade/orders/${o.id}`);
  }
  audit(req, 'order.confirm', 'order', o.id, { side });
  res.json({ order: out(updated) });
}));

ordersRouter.post('/:id/cancel', ah(async (req, res) => {
  const { reason, confirm } = parse(z.object({ reason: zText(500), confirm: z.literal(true) }), req.body);
  void confirm;
  const { o, side } = loadOrder(req, req.params.id, { partyOnly: true });
  if (!['pending_confirmation', 'confirmed', 'pickup_scheduled'].includes(o.status)) throw new HttpError(409, `An order that is ${o.status} cannot be cancelled. Open a dispute instead.`, 'bad_state');
  if (o.status !== 'pending_confirmation') requireStepUp(req, 'Cancelling a confirmed order is a serious action.');
  q.tx(() => {
    const r = q.run(`UPDATE orders SET status = 'cancelled', cancelled_at = datetime('now'), cancelled_by = ?, cancel_reason = ?, updated_at = datetime('now')
      WHERE id = ? AND status = ?`, req.user!.id, reason, o.id, o.status);
    if (r.changes !== 1) throw new HttpError(409, 'Order changed; reload and try again', 'conflict');
    releaseLot(o.lot_id, o.quantity);
    releaseDemand(o.demand_id, o.quantity, o.unit);
    // Money already confirmed must be refunded; pending items are voided.
    const paid = q.get<Row>(`SELECT COALESCE(SUM(amount),0) s FROM payment_records WHERE order_id = ? AND status = 'confirmed' AND kind != 'refund'`, o.id)!.s;
    q.run(`UPDATE payment_records SET status = 'failed', updated_at = datetime('now') WHERE order_id = ? AND status IN ('required','initiated','pending')`, o.id);
    if (paid > 0) insert('payment_records', { id: id(), ref: ref('REF'), order_id: o.id, kind: 'refund', payer_id: o.farmer_id, payee_id: o.buyer_id, amount: paid, status: 'refund_pending' });
    orderEvent(o.id, req.user!.id, 'cancelled', { by: side, reason });
  });
  if (o.status !== 'pending_confirmation') checkCancellations(req.user!.id);
  const other = side === 'farmer' ? o.buyer_id : o.farmer_id;
  notifyT(other, 'order', 'order_update', { ref: o.order_no, status: 'cancelled' }, `order-cancel:${o.id}`, `/trade/orders/${o.id}`);
  audit(req, 'order.cancel', 'order', o.id, { reason });
  res.json({ ok: true });
}));

ordersRouter.post('/:id/progress', ah(async (req, res) => {
  const { status, note } = parse(z.object({ status: z.enum(['pickup_scheduled', 'in_transit']), note: zOptText(500) }), req.body);
  const { o, side } = loadOrder(req, req.params.id, { partyOnly: true });
  const allowed: Record<string, string[]> = { pickup_scheduled: ['confirmed'], in_transit: ['confirmed', 'pickup_scheduled'] };
  if (!allowed[status].includes(o.status)) throw new HttpError(409, `Cannot move from ${o.status} to ${status}`, 'bad_state');
  q.run(`UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`, status, o.id);
  orderEvent(o.id, req.user!.id, status, { note, by: side });
  notifyT(side === 'farmer' ? o.buyer_id : o.farmer_id, 'order', 'order_update', { ref: o.order_no, status: status.replace('_', ' ') }, `order-${status}:${o.id}`, `/trade/orders/${o.id}`);
  res.json({ ok: true });
}));

/** Buyer records delivery and quality inspection; settlement is based on the accepted quantity. */
ordersRouter.post('/:id/deliver', ah(async (req, res) => {
  const b = parse(z.object({
    received_quantity: z.number().min(0), inspection_status: z.enum(['accepted', 'partially_accepted', 'rejected']), inspection_notes: zOptText(1000),
  }), req.body);
  const { o, side } = loadOrder(req, req.params.id, { partyOnly: true });
  if (side !== 'buyer') throw forbidden('The buyer confirms delivery and inspection');
  if (!['confirmed', 'pickup_scheduled', 'in_transit'].includes(o.status)) throw new HttpError(409, `Order is ${o.status}`, 'bad_state');
  if (b.received_quantity > o.quantity + 1e-9) throw new HttpError(400, `Received quantity cannot exceed the agreed ${o.quantity} ${o.unit}`, 'validation_error');
  const accepted = b.inspection_status === 'rejected' ? 0 : b.received_quantity;
  const charges: Charge[] = JSON.parse(o.charges);
  const finalNet = settlement(accepted, o.price_per_unit, charges);
  const finalBuyer = breakdown(accepted, o.price_per_unit, charges).buyer_payable;
  q.tx(() => {
    q.run(`UPDATE orders SET status = 'delivered', delivered_at = datetime('now'), received_quantity = ?, inspection_status = ?, inspection_notes = ?,
      final_settlement = ?, updated_at = datetime('now') WHERE id = ?`, accepted, b.inspection_status, b.inspection_notes ?? null, finalNet, o.id);
    if (o.lot_id) {
      q.run(`UPDATE produce_lots SET quantity_reserved = MAX(quantity_reserved - ?, 0), quantity_sold = quantity_sold + ?, quantity_available = quantity_available + ?, updated_at = datetime('now') WHERE id = ?`,
        o.quantity, accepted, o.quantity - accepted, o.lot_id);
      refreshLotStatus(o.lot_id);
    }
    // Re-base what is still due on the accepted quantity; set due dates that start at delivery.
    const paid = q.get<Row>(`SELECT COALESCE(SUM(amount),0) s FROM payment_records WHERE order_id = ? AND status = 'confirmed' AND kind != 'refund'`, o.id)!.s;
    const open = q.all<Row>(`SELECT * FROM payment_records WHERE order_id = ? AND status IN ('required','initiated') AND kind IN ('balance','full') ORDER BY created_at`, o.id);
    const due = Math.max(0, Math.round((finalBuyer - paid) * 100) / 100);
    const dueDate = new Date(Date.now() + (o.payment_terms === 'within_days' ? (o.payment_due_days ?? 0) : 0) * 86400_000).toISOString().slice(0, 10);
    if (open[0]) q.run(`UPDATE payment_records SET amount = ?, due_date = ?, updated_at = datetime('now') WHERE id = ?`, due, dueDate, open[0].id);
    if (paid > finalBuyer + 0.01) insert('payment_records', { id: id(), ref: ref('REF'), order_id: o.id, kind: 'refund', payer_id: o.farmer_id, payee_id: o.buyer_id, amount: Math.round((paid - finalBuyer) * 100) / 100, status: 'refund_pending' });
    orderEvent(o.id, req.user!.id, 'delivered', b);
  });
  notifyT(o.farmer_id, 'order', 'order_update', { ref: o.order_no, status: `delivered – ${b.inspection_status.replace('_', ' ')}` }, `order-delivered:${o.id}`, `/trade/orders/${o.id}`);
  audit(req, 'order.deliver', 'order', o.id, b);
  res.json({ order: out(q.get('SELECT * FROM orders WHERE id = ?', o.id)) });
}));

ordersRouter.post('/:id/complete', ah(async (req, res) => {
  const { o } = loadOrder(req, req.params.id, { partyOnly: true });
  if (o.status !== 'delivered') throw new HttpError(409, 'Only delivered orders can be completed', 'bad_state');
  const open = q.get<Row>(`SELECT COUNT(*) n FROM payment_records WHERE order_id = ? AND kind != 'refund' AND amount > 0 AND status NOT IN ('confirmed','settled','failed')`, o.id)!.n;
  if (open > 0) throw new HttpError(409, 'Payments for this order are not yet confirmed by the farmer or the payment provider', 'payments_open');
  if (q.get(`SELECT 1 FROM disputes WHERE order_id = ? AND status NOT IN ('resolved','rejected')`, o.id)) throw new HttpError(409, 'There is an open dispute on this order', 'disputed');
  q.run(`UPDATE orders SET status = 'completed', completed_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, o.id);
  orderEvent(o.id, req.user!.id, 'completed');
  for (const uid of [o.farmer_id, o.buyer_id]) notifyT(uid, 'order', 'order_update', { ref: o.order_no, status: 'completed' }, `order-completed:${o.id}`, `/trade/orders/${o.id}`);
  res.json({ ok: true });
}));

// ---------------- Amendments (confirmed terms change only with the other party's approval) ----------------
ordersRouter.post('/:id/amendments', ah(async (req, res) => {
  const b = parse(z.object({
    changes: z.object({
      quantity: z.number().positive().optional(), price_per_unit: z.number().min(0).optional(),
      delivery_mode: z.enum(['buyer_pickup', 'farmer_delivery', 'arranged_transport', 'from_storage']).optional(),
      delivery_location: z.string().max(300).optional(), charges: z.array(ChargeSchema).max(10).optional(),
    }).refine((c) => Object.keys(c).length > 0, 'Propose at least one change'),
    reason: zText(500),
  }), req.body);
  const { o } = loadOrder(req, req.params.id, { partyOnly: true });
  if (!['pending_confirmation', 'confirmed', 'pickup_scheduled'].includes(o.status)) throw new HttpError(409, 'Terms can no longer be amended', 'bad_state');
  if (q.get(`SELECT 1 FROM order_amendments WHERE order_id = ? AND status = 'pending'`, o.id)) throw new HttpError(409, 'An amendment is already awaiting approval', 'pending_exists');
  const aid = id();
  insert('order_amendments', { id: aid, order_id: o.id, proposed_by: req.user!.id, changes: b.changes, reason: b.reason });
  orderEvent(o.id, req.user!.id, 'amendment_proposed', b);
  notifyT(o.farmer_id === req.user!.id ? o.buyer_id : o.farmer_id, 'order', 'order_update', { ref: o.order_no, status: 'change to terms proposed' }, `amend:${aid}`, `/trade/orders/${o.id}`);
  res.status(201).json({ id: aid });
}));

ordersRouter.post('/:id/amendments/:aid/decide', ah(async (req, res) => {
  const { decision } = parse(z.object({ decision: z.enum(['approve', 'reject']) }), req.body);
  const { o } = loadOrder(req, req.params.id, { partyOnly: true });
  const a = q.get<Row>(`SELECT * FROM order_amendments WHERE id = ? AND order_id = ? AND status = 'pending'`, req.params.aid, o.id);
  if (!a) throw notFound('Pending amendment');
  if (a.proposed_by === req.user!.id) throw forbidden('The other party must approve your proposed change');
  q.tx(() => {
    if (decision === 'approve') {
      const c = JSON.parse(a.changes);
      const qty = c.quantity ?? o.quantity;
      if (c.quantity != null && c.quantity !== o.quantity && o.lot_id) {
        const diff = c.quantity - o.quantity;
        if (diff > 0) {
          const r = q.run(`UPDATE produce_lots SET quantity_available = quantity_available - ?, quantity_reserved = quantity_reserved + ? WHERE id = ? AND quantity_available >= ?`, diff, diff, o.lot_id, diff);
          if (r.changes !== 1) throw new HttpError(409, 'Not enough quantity left in the lot for this change', 'insufficient_quantity');
        } else releaseLot(o.lot_id, -diff);
      }
      const price = c.price_per_unit ?? o.price_per_unit;
      const charges = c.charges ?? JSON.parse(o.charges);
      const bd = breakdown(qty, price, charges);
      q.run(`UPDATE orders SET quantity = ?, price_per_unit = ?, delivery_mode = ?, delivery_location = ?, charges = ?, breakdown = ?, product_value = ?, buyer_payable = ?, farmer_net = ?, updated_at = datetime('now') WHERE id = ?`,
        qty, price, c.delivery_mode ?? o.delivery_mode, c.delivery_location ?? o.delivery_location, JSON.stringify(charges), JSON.stringify(bd), bd.product_value, bd.buyer_payable, bd.farmer_net, o.id);
      // Unpaid scheduled payments follow the new total.
      const open = q.all<Row>(`SELECT * FROM payment_records WHERE order_id = ? AND status = 'required' AND kind != 'refund' ORDER BY created_at`, o.id);
      if (open.length) {
        const paid = q.get<Row>(`SELECT COALESCE(SUM(amount),0) s FROM payment_records WHERE order_id = ? AND status = 'confirmed' AND kind != 'refund'`, o.id)!.s;
        const otherOpen = open.slice(0, -1).reduce((s, p) => s + p.amount, 0);
        q.run('UPDATE payment_records SET amount = ? WHERE id = ?', Math.max(0, Math.round((bd.buyer_payable - paid - otherOpen) * 100) / 100), open[open.length - 1].id);
      }
    }
    q.run(`UPDATE order_amendments SET status = ?, decided_by = ?, decided_at = datetime('now') WHERE id = ?`, decision === 'approve' ? 'approved' : 'rejected', req.user!.id, a.id);
    orderEvent(o.id, req.user!.id, `amendment_${decision === 'approve' ? 'approved' : 'rejected'}`, { amendment: a.id });
  });
  audit(req, `order.amendment_${decision}`, 'order', o.id);
  res.json({ order: out(q.get('SELECT * FROM orders WHERE id = ?', o.id)) });
}));

/** Data for a printable transaction statement. */
ordersRouter.get('/:id/statement', ah(async (req, res) => {
  const { o } = loadOrder(req, req.params.id);
  const f = q.get<Row>('SELECT full_name, district, state FROM users WHERE id = ?', o.farmer_id);
  const b = q.get<Row>('SELECT u.full_name, bp.business_name FROM users u LEFT JOIN buyer_profiles bp ON bp.user_id = u.id WHERE u.id = ?', o.buyer_id);
  res.json({
    order: out(o), farmer: f, buyer: b,
    payments: q.all('SELECT ref, kind, amount, status, method, provider, provider_payment_id, reference_note, due_date, paid_at FROM payment_records WHERE order_id = ? ORDER BY created_at', o.id),
    generated_at: new Date().toISOString(),
  });
}));

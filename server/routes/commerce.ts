import { Router, type Request } from 'express';
import { z } from 'zod';
import { q, out, insert, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, id, notFound, parse, zOptText, zText } from '../lib/http.ts';
import { requireRole } from '../lib/auth.ts';
import { audit, rateLimit } from '../lib/security.ts';
import { activeRestriction } from '../services/fraud.ts';
import { ref } from '../services/trade.ts';
import { notify } from '../services/notify.ts';

// ---------------- Buyer & business directory ----------------
export const directoryRouter = Router();

/** Only reviewer-verified, active buyers are listed. No phone numbers or documents are exposed. */
directoryRouter.get('/', ah(async (req, res) => {
  const { commodity, state, type } = req.query as Record<string, string | undefined>;
  const where = [`b.status = 'verified'`, `u.status = 'active'`];
  const p: unknown[] = [];
  if (commodity) { where.push('b.commodities LIKE ?'); p.push(`%${commodity}%`); }
  if (state) { where.push('(b.state = ? OR b.sourcing_regions LIKE ?)'); p.push(state, `%${state}%`); }
  if (type) { where.push('b.buyer_type = ?'); p.push(type); }
  const rows = q.all<Row>(`SELECT b.user_id, b.business_name, b.buyer_type, b.district, b.state, b.commodities, b.sourcing_regions, b.purchase_frequency, b.min_qty, b.max_qty, b.qty_unit, b.verified_at,
      (SELECT COUNT(*) FROM demand_requests d WHERE d.buyer_id = b.user_id AND d.status IN ('open','partially_filled')) AS open_requirements,
      (SELECT COUNT(*) FROM orders o WHERE o.buyer_id = b.user_id AND o.status = 'completed') AS completed_orders
    FROM buyer_profiles b JOIN users u ON u.id = b.user_id WHERE ${where.join(' AND ')} ORDER BY open_requirements DESC, b.verified_at DESC LIMIT 200`, ...p);
  res.json({ buyers: rows.map(out), note: 'Listed only after a FARMDirect reviewer verified the business. Completed orders count only orders on FARMDirect.' });
}));

const enquiryLimit = rateLimit({ name: 'enquiry', windowMs: 60 * 60_000, max: 10, key: (r) => r.user!.id });

directoryRouter.post('/:userId/enquiries', enquiryLimit, ah(async (req, res) => {
  const b = parse(z.object({ message: zText(1000), lot_id: z.string().optional().nullable(), share_phone: z.boolean().default(false) }), req.body);
  if (req.params.userId === req.user!.id) throw new HttpError(400, 'You cannot send an enquiry to yourself', 'validation_error');
  const target = q.get<Row>(`SELECT b.user_id FROM buyer_profiles b JOIN users u ON u.id = b.user_id WHERE b.user_id = ? AND b.status = 'verified' AND u.status = 'active'`, req.params.userId);
  if (!target) throw notFound('Verified buyer');
  if (activeRestriction(req.user!.id, 'no_offers')) throw forbidden('Your account is restricted from contacting buyers');
  if (b.lot_id && !q.get('SELECT 1 FROM produce_lots WHERE id = ? AND farmer_id = ?', b.lot_id, req.user!.id)) throw notFound('Lot');
  const eid = id();
  insert('business_enquiries', { id: eid, from_user: req.user!.id, to_user: target.user_id, lot_id: b.lot_id ?? null, message: b.message, share_phone: b.share_phone });
  notify(target.user_id, 'order', 'New enquiry from a farmer', b.message.slice(0, 140), `enquiry:${eid}`, '/businesses?tab=enquiries');
  audit(req, 'enquiry.create', 'user', target.user_id);
  res.status(201).json({ id: eid });
}));

directoryRouter.get('/enquiries', ah(async (req, res) => {
  const uid = req.user!.id;
  const mapRow = (e: Row) => ({ ...e, phone: e.share_phone ? e.phone : null });
  res.json({
    received: q.all<Row>(`SELECT e.*, u.full_name AS from_name, u.district AS from_district, u.phone, l.commodity, l.quantity_available, l.unit FROM business_enquiries e
      JOIN users u ON u.id = e.from_user LEFT JOIN produce_lots l ON l.id = e.lot_id WHERE e.to_user = ? ORDER BY e.created_at DESC LIMIT 200`, uid).map(mapRow),
    sent: q.all(`SELECT e.id, e.message, e.reply, e.status, e.created_at, e.replied_at, b.business_name FROM business_enquiries e LEFT JOIN buyer_profiles b ON b.user_id = e.to_user
      WHERE e.from_user = ? ORDER BY e.created_at DESC LIMIT 200`, uid),
  });
}));

directoryRouter.post('/enquiries/:id/reply', ah(async (req, res) => {
  const { reply } = parse(z.object({ reply: zText(1000) }), req.body);
  const e = q.get<Row>('SELECT * FROM business_enquiries WHERE id = ? AND to_user = ?', req.params.id, req.user!.id);
  if (!e) throw notFound('Enquiry');
  q.run(`UPDATE business_enquiries SET reply = ?, status = 'replied', replied_at = datetime('now') WHERE id = ?`, reply, e.id);
  notify(e.from_user, 'order', 'A buyer replied to your enquiry', reply.slice(0, 140), `enquiry-reply:${e.id}`, '/businesses?tab=enquiries');
  res.json({ ok: true });
}));

// ---------------- Farm inputs sold by verified dealers ----------------
export const inputsRouter = Router();

const verifiedDealer = (req: Request) => {
  const u = q.get<Row>('SELECT role, verification_status FROM users WHERE id = ?', req.user!.id);
  if (u?.role !== 'dealer' || u.verification_status !== 'verified') throw forbidden('Only verified input dealers can sell on FARMDirect');
};

inputsRouter.get('/offers', ah(async (req, res) => {
  const { product_id, category, state, district, q: s } = req.query as Record<string, string | undefined>;
  const where = [`o.status = 'active'`, `p.status = 'published'`, `u.role = 'dealer'`, `u.verification_status = 'verified'`, `u.status = 'active'`];
  const p: unknown[] = [];
  if (product_id) { where.push('o.product_id = ?'); p.push(product_id); }
  if (category) { where.push('p.category = ?'); p.push(category); }
  if (state) { where.push('o.state = ?'); p.push(state); }
  if (district) { where.push('o.district LIKE ?'); p.push(`%${district}%`); }
  if (s) { where.push('(p.name LIKE ? OR p.manufacturer LIKE ?)'); p.push(`%${s}%`, `%${s}%`); }
  res.json({
    offers: q.all(`SELECT o.*, p.name AS product_name, p.manufacturer, p.category, p.registration_no, u.full_name AS dealer_name FROM input_offers o
      JOIN products p ON p.id = o.product_id JOIN users u ON u.id = o.dealer_id WHERE ${where.join(' AND ')} ORDER BY p.name, o.price_inr LIMIT 300`, ...p),
    note: 'Sold by verified dealers. Stock is reserved when you place an order. Use products only as the label directs.',
  });
}));

const OfferSchema = z.object({
  product_id: z.string(), pack_size: zText(60), price_inr: z.number().min(0).max(1e7), stock: z.number().int().min(0).max(1e6),
  state: zText(80), district: zText(80), pickup_address: zOptText(300), delivery_available: z.boolean().default(false),
  status: z.enum(['active', 'paused']).default('active'),
});

inputsRouter.get('/offers/mine', requireRole('dealer'), ah(async (req, res) => {
  res.json({ offers: q.all(`SELECT o.*, p.name AS product_name FROM input_offers o JOIN products p ON p.id = o.product_id WHERE o.dealer_id = ? ORDER BY o.updated_at DESC`, req.user!.id) });
}));

inputsRouter.post('/offers', requireRole('dealer'), ah(async (req, res) => {
  verifiedDealer(req);
  const d = parse(OfferSchema, req.body);
  if (!q.get(`SELECT 1 FROM products WHERE id = ? AND status = 'published'`, d.product_id)) throw new HttpError(400, 'Only products published in the FARMDirect catalogue can be sold', 'bad_product');
  const oid = id();
  insert('input_offers', { id: oid, dealer_id: req.user!.id, ...d });
  audit(req, 'input_offer.create', 'input_offer', oid);
  res.status(201).json({ offer: q.get('SELECT * FROM input_offers WHERE id = ?', oid) });
}));

inputsRouter.patch('/offers/:id', requireRole('dealer'), ah(async (req, res) => {
  verifiedDealer(req);
  const d = parse(OfferSchema.partial().omit({ product_id: true }), req.body);
  const o = q.get<Row>('SELECT * FROM input_offers WHERE id = ? AND dealer_id = ?', req.params.id, req.user!.id);
  if (!o) throw notFound('Offer');
  const keys = Object.keys(d).filter((k) => (d as any)[k] !== undefined);
  if (keys.length) q.run(`UPDATE input_offers SET ${keys.map((k) => `${k} = ?`).join(', ')}, updated_at = datetime('now') WHERE id = ?`, ...keys.map((k) => { const v = (d as any)[k]; return typeof v === 'boolean' ? (v ? 1 : 0) : v; }), o.id);
  res.json({ offer: q.get('SELECT * FROM input_offers WHERE id = ?', o.id) });
}));

inputsRouter.post('/orders', requireRole('farmer', 'fpo_manager'), ah(async (req, res) => {
  const b = parse(z.object({ offer_id: z.string(), quantity: z.number().int().min(1).max(10000), fulfilment: z.enum(['pickup', 'delivery']).default('pickup'), note: zOptText(500), confirm: z.literal(true) }), req.body);
  const o = q.get<Row>(`SELECT o.*, p.name AS product_name, p.status AS product_status FROM input_offers o JOIN products p ON p.id = o.product_id WHERE o.id = ?`, b.offer_id);
  if (!o || o.status !== 'active' || o.product_status !== 'published') throw notFound('Available offer');
  if (b.fulfilment === 'delivery' && !o.delivery_available) throw new HttpError(400, 'This dealer offers pickup only', 'validation_error');
  const oid = id();
  const orderRef = ref('INP');
  q.tx(() => {
    // Reserve stock atomically so the last units cannot be sold twice.
    const r = q.run(`UPDATE input_offers SET stock = stock - ?, updated_at = datetime('now') WHERE id = ? AND stock >= ?`, b.quantity, o.id, b.quantity);
    if (r.changes !== 1) throw new HttpError(409, 'Not enough stock left', 'insufficient_stock');
    insert('input_orders', { id: oid, ref: orderRef, offer_id: o.id, farmer_id: req.user!.id, dealer_id: o.dealer_id, product_name: o.product_name, pack_size: o.pack_size,
      quantity: b.quantity, unit_price: o.price_inr, total: Math.round(o.price_inr * b.quantity * 100) / 100, fulfilment: b.fulfilment, note: b.note ?? null });
  });
  notify(o.dealer_id, 'order', 'New input order', `${b.quantity} × ${o.product_name} (${o.pack_size})`, `input-order:${oid}`, '/inputs?tab=sales');
  audit(req, 'input_order.create', 'input_order', oid);
  res.status(201).json({ order: q.get('SELECT * FROM input_orders WHERE id = ?', oid) });
}));

inputsRouter.get('/orders', ah(async (req, res) => {
  const uid = req.user!.id;
  res.json({
    orders: q.all(`SELECT io.*, f.full_name AS farmer_name, d.full_name AS dealer_name,
        (SELECT status FROM payment_records p WHERE p.input_order_id = io.id ORDER BY created_at DESC LIMIT 1) AS payment_status,
        (SELECT id FROM payment_records p WHERE p.input_order_id = io.id ORDER BY created_at DESC LIMIT 1) AS payment_id
      FROM input_orders io LEFT JOIN users f ON f.id = io.farmer_id LEFT JOIN users d ON d.id = io.dealer_id
      WHERE io.farmer_id = ? OR io.dealer_id = ? ORDER BY io.created_at DESC LIMIT 200`, uid, uid),
  });
}));

const TRANSITIONS: Record<string, string[]> = { requested: ['confirmed', 'rejected'], confirmed: ['ready'], ready: ['fulfilled'] };

inputsRouter.post('/orders/:id/status', requireRole('dealer'), ah(async (req, res) => {
  const { status, note } = parse(z.object({ status: z.enum(['confirmed', 'rejected', 'ready', 'fulfilled']), note: zOptText(500) }), req.body);
  const o = q.get<Row>('SELECT * FROM input_orders WHERE id = ? AND dealer_id = ?', req.params.id, req.user!.id);
  if (!o) throw notFound('Order');
  if (!TRANSITIONS[o.status]?.includes(status)) throw new HttpError(409, `Cannot change from ${o.status} to ${status}`, 'bad_state');
  if (status === 'rejected' && !note) throw new HttpError(400, 'Give a reason for rejecting', 'validation_error');
  q.tx(() => {
    q.run(`UPDATE input_orders SET status = ?, dealer_note = COALESCE(?, dealer_note), updated_at = datetime('now') WHERE id = ?`, status, note ?? null, o.id);
    if (status === 'rejected') q.run(`UPDATE input_offers SET stock = stock + ? WHERE id = ?`, o.quantity, o.offer_id);
    if (status === 'confirmed') insert('payment_records', { id: id(), ref: ref('PAY'), input_order_id: o.id, kind: 'full', payer_id: o.farmer_id, payee_id: o.dealer_id, amount: o.total, status: 'required', reference_note: `${o.product_name} ×${o.quantity}` });
  });
  notify(o.farmer_id, 'order', `Input order ${o.ref}: ${status}`, note ?? `${o.product_name} – ${status}`, `input-order:${o.id}:${status}`, '/inputs?tab=orders');
  audit(req, `input_order.${status}`, 'input_order', o.id);
  res.json({ ok: true });
}));

inputsRouter.post('/orders/:id/cancel', ah(async (req, res) => {
  const o = q.get<Row>('SELECT * FROM input_orders WHERE id = ? AND farmer_id = ?', req.params.id, req.user!.id);
  if (!o) throw notFound('Order');
  if (!['requested', 'confirmed'].includes(o.status)) throw new HttpError(409, `An order that is ${o.status} cannot be cancelled`, 'bad_state');
  q.tx(() => {
    q.run(`UPDATE input_orders SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`, o.id);
    q.run(`UPDATE input_offers SET stock = stock + ? WHERE id = ?`, o.quantity, o.offer_id);
    const paid = q.get<Row>(`SELECT COALESCE(SUM(amount),0) s FROM payment_records WHERE input_order_id = ? AND status = 'confirmed'`, o.id)!.s;
    q.run(`UPDATE payment_records SET status = 'failed' WHERE input_order_id = ? AND status IN ('required','initiated')`, o.id);
    if (paid > 0) insert('payment_records', { id: id(), ref: ref('REF'), input_order_id: o.id, kind: 'refund', payer_id: o.dealer_id, payee_id: o.farmer_id, amount: paid, status: 'refund_pending' });
  });
  notify(o.dealer_id, 'order', `Input order ${o.ref} cancelled`, 'The farmer cancelled the order. Stock was returned.', `input-order:${o.id}:cancelled`, '/inputs?tab=sales');
  res.json({ ok: true });
}));

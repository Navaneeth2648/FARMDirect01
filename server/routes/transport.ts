import { Router, type Request } from 'express';
import { z } from 'zod';
import { q, out, insert, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, id, notFound, parse, zDate, zOptText, zText } from '../lib/http.ts';
import { requireRole } from '../lib/auth.ts';
import { hasPerm } from '../lib/permissions.ts';
import { audit } from '../lib/security.ts';
import { docUpload, storeDocument } from '../lib/files.ts';
import { roadKm } from '../services/pricing.ts';
import { getSetting } from '../services/settings.ts';
import { notifyT } from '../services/messages.ts';
import { notify } from '../services/notify.ts';

export const transportRouter = Router();

/** Milestones are recorded events. There is no live GPS tracking, and none is simulated. */
const MILESTONES = ['scheduled', 'picked_up', 'in_transit', 'delivered', 'exception', 'damage'] as const;

function milestone(requestId: string, event: string, actorId: string, note?: string | null) {
  q.run('INSERT INTO transport_milestones (request_id, event, note, actor_id) VALUES (?, ?, ?, ?)', requestId, event, note ?? null, actorId);
}

transportRouter.get('/estimate', ah(async (req, res) => {
  const f = parse(z.object({ from_lat: z.coerce.number(), from_lon: z.coerce.number(), to_lat: z.coerce.number(), to_lon: z.coerce.number(), quantity_qtl: z.coerce.number().positive() }), req.query);
  const km = roadKm(f.from_lat, f.from_lon, f.to_lat, f.to_lon);
  const rates = q.all<Row>(`SELECT rate_per_km, min_charge FROM transport_providers WHERE status = 'verified' AND rate_per_km IS NOT NULL ORDER BY rate_per_km`);
  const median = rates.length ? rates[Math.floor(rates.length / 2)] : null;
  const platformRate = getSetting('transport_rate_per_qtl_km') as number | null;
  res.json({
    distance_km: km,
    distance_note: 'Straight-line distance × road factor. Actual route may differ.',
    estimate: median ? Math.max(median.min_charge ?? 0, Math.round(km * median.rate_per_km)) : platformRate ? Math.round(km * platformRate * f.quantity_qtl) : null,
    basis: median ? `Median vehicle rate of ${rates.length} verified transporter(s): ₹${median.rate_per_km}/km` : platformRate ? `Platform default ₹${platformRate}/qtl/km` : 'No rates available – request quotes',
  });
}));

// ---------------- Requester side ----------------
transportRouter.post('/requests', ah(async (req, res) => {
  const b = parse(z.object({
    order_id: z.string().optional().nullable(), booking_id: z.string().optional().nullable(),
    pickup_address: zText(300), pickup_lat: z.number().optional().nullable(), pickup_lon: z.number().optional().nullable(),
    drop_address: zText(300), drop_lat: z.number().optional().nullable(), drop_lon: z.number().optional().nullable(),
    quantity_qtl: z.number().positive().max(1e5), packaging: zOptText(200), preferred_date: zDate, payer: z.enum(['buyer', 'farmer']),
  }), req.body);
  const uid = req.user!.id;
  if (b.order_id) {
    const o = q.get<Row>('SELECT * FROM orders WHERE id = ?', b.order_id);
    if (!o || (o.farmer_id !== uid && o.buyer_id !== uid)) throw notFound('Order');
    if (!['confirmed', 'pickup_scheduled'].includes(o.status)) throw new HttpError(409, 'Transport can be arranged once the order is confirmed', 'bad_state');
  }
  if (b.booking_id && !q.get('SELECT 1 FROM storage_bookings WHERE id = ? AND farmer_id = ?', b.booking_id, uid)) throw notFound('Booking');
  const km = b.pickup_lat != null && b.pickup_lon != null && b.drop_lat != null && b.drop_lon != null ? roadKm(b.pickup_lat, b.pickup_lon, b.drop_lat, b.drop_lon) : null;
  const rid = id();
  insert('transport_requests', { id: rid, requester_id: uid, ...b, distance_km: km });
  // Tell verified transporters who serve this area.
  const order = b.order_id ? q.get<Row>('SELECT l.state FROM orders o JOIN produce_lots l ON l.id = o.lot_id WHERE o.id = ?', b.order_id) : undefined;
  const providers = q.all<Row>(`SELECT * FROM transport_providers WHERE status = 'verified'`)
    .filter((p) => !order?.state || JSON.parse(p.service_states).length === 0 || JSON.parse(p.service_states).includes(order.state));
  for (const p of providers) notify(p.user_id, 'order', 'New transport request', `${b.quantity_qtl} quintal, ${b.pickup_address} → ${b.drop_address} on ${b.preferred_date}`, `transport-req:${rid}`, '/transport/provider');
  audit(req, 'transport.request', 'transport', rid);
  res.status(201).json({ request: q.get('SELECT * FROM transport_requests WHERE id = ?', rid), providers_notified: providers.length });
}));

function loadRequest(req: Request, rid: string) {
  const r = q.get<Row>('SELECT * FROM transport_requests WHERE id = ?', rid);
  if (!r) throw notFound('Transport request');
  const uid = req.user!.id;
  const order = r.order_id ? q.get<Row>('SELECT farmer_id, buyer_id FROM orders WHERE id = ?', r.order_id) : undefined;
  const provider = q.get<Row>('SELECT * FROM transport_providers WHERE user_id = ?', uid);
  const side = r.requester_id === uid ? 'requester'
    : order && (order.farmer_id === uid || order.buyer_id === uid) ? 'party'
    : provider && provider.status === 'verified' ? 'provider'
    : hasPerm(req.user!.role, 'orders.view') ? 'staff' : null;
  if (!side) throw notFound('Transport request');
  return { r, side, provider };
}

transportRouter.get('/requests', ah(async (req, res) => {
  const uid = req.user!.id;
  res.json({ requests: q.all(`SELECT t.* FROM transport_requests t LEFT JOIN orders o ON o.id = t.order_id
    WHERE t.requester_id = ? OR o.farmer_id = ? OR o.buyer_id = ? ORDER BY t.created_at DESC`, uid, uid, uid) });
}));

transportRouter.get('/requests/:id', ah(async (req, res) => {
  const { r, side, provider } = loadRequest(req, req.params.id);
  const quotes = q.all<Row>(`SELECT tq.*, tp.name AS provider_name, tp.vehicle_types FROM transport_quotes tq JOIN transport_providers tp ON tp.id = tq.provider_id WHERE request_id = ? ORDER BY amount`, r.id);
  res.json({
    request: r, my_side: side,
    quotes: side === 'provider' ? quotes.filter((x) => x.provider_id === provider!.id).map(out) : quotes.map(out),
    milestones: q.all('SELECT event, note, created_at FROM transport_milestones WHERE request_id = ? ORDER BY id', r.id),
    tracking_note: 'Status updates are recorded milestones. Live vehicle tracking is not available.',
  });
}));

transportRouter.post('/requests/:id/accept-quote', ah(async (req, res) => {
  const { quote_id } = parse(z.object({ quote_id: z.string(), confirm: z.literal(true) }), req.body);
  const { r, side } = loadRequest(req, req.params.id);
  if (side !== 'requester') throw forbidden();
  if (!['requested', 'quoted'].includes(r.status)) throw new HttpError(409, `Request is ${r.status}`, 'bad_state');
  const quote = q.get<Row>(`SELECT * FROM transport_quotes WHERE id = ? AND request_id = ? AND status = 'offered'`, quote_id, r.id);
  if (!quote) throw notFound('Quote');
  if (quote.valid_until && quote.valid_until < new Date().toISOString()) throw new HttpError(409, 'This quote has expired', 'expired');
  q.tx(() => {
    q.run(`UPDATE transport_quotes SET status = CASE WHEN id = ? THEN 'accepted' ELSE 'declined' END WHERE request_id = ? AND status = 'offered'`, quote.id, r.id);
    q.run(`UPDATE transport_requests SET status = 'accepted', accepted_quote_id = ?, cost = ?, updated_at = datetime('now') WHERE id = ?`, quote.id, quote.amount, r.id);
    milestone(r.id, 'scheduled', req.user!.id, `Quote accepted: ₹${quote.amount}${quote.eta_date ? `, pickup ${quote.eta_date}` : ''}`);
    if (r.order_id) q.run('INSERT INTO order_events (order_id, actor_id, event, details) VALUES (?, ?, ?, ?)', r.order_id, req.user!.id, 'transport_arranged', JSON.stringify({ cost: quote.amount, payer: r.payer }));
  });
  const p = q.get<Row>('SELECT user_id FROM transport_providers WHERE id = ?', quote.provider_id)!;
  notifyT(p.user_id, 'order', 'transport_update', { status: 'your quote was accepted' }, `transport-accept:${r.id}`, '/transport/provider');
  res.json({ ok: true });
}));

transportRouter.post('/requests/:id/confirm-delivery', ah(async (req, res) => {
  const b = parse(z.object({ note: zOptText(500), damage: z.boolean().default(false) }), req.body);
  const { r, side } = loadRequest(req, req.params.id);
  if (side !== 'requester' && side !== 'party') throw forbidden();
  if (!['accepted', 'picked_up', 'in_transit'].includes(r.status)) throw new HttpError(409, `Request is ${r.status}`, 'bad_state');
  q.run(`UPDATE transport_requests SET status = ?, updated_at = datetime('now') WHERE id = ?`, b.damage ? 'exception' : 'delivered', r.id);
  milestone(r.id, b.damage ? 'damage' : 'delivered', req.user!.id, b.note ?? (b.damage ? 'Delivered with damage reported' : 'Delivery confirmed by receiver'));
  res.json({ ok: true });
}));

transportRouter.post('/requests/:id/cancel', ah(async (req, res) => {
  const { r, side } = loadRequest(req, req.params.id);
  if (side !== 'requester') throw forbidden();
  if (['delivered', 'cancelled'].includes(r.status)) throw new HttpError(409, `Request is ${r.status}`, 'bad_state');
  q.run(`UPDATE transport_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`, r.id);
  milestone(r.id, 'exception', req.user!.id, 'Cancelled by requester');
  res.json({ ok: true });
}));

// ---------------- Transport provider side ----------------
const prov = Router();
prov.use(requireRole('transport_provider'));

prov.get('/profile', ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM transport_providers WHERE user_id = ?', req.user!.id);
  res.json({ provider: p ? out(p) : null, documents: p ? q.all(`SELECT id, doc_type, created_at FROM documents WHERE subject_type = 'transport' AND subject_id = ? AND deleted_at IS NULL`, p.id) : [] });
}));

prov.put('/profile', ah(async (req, res) => {
  const b = parse(z.object({
    name: zText(200), phone: z.string().regex(/^\+?\d[\d\s-]{7,15}$/).optional().nullable(),
    vehicle_types: z.array(z.enum(['mini_truck', 'pickup', 'tractor_trolley', 'truck', 'reefer_truck', 'other'])).min(1),
    capacity_tonnes: z.number().positive().max(100), service_states: z.array(z.string().max(80)).max(40).default([]),
    service_districts: z.array(z.string().max(80)).max(100).default([]),
    rate_per_km: z.number().positive().max(1000).optional().nullable(), min_charge: z.number().min(0).max(1e6).optional().nullable(),
    license_info: zOptText(500),
  }), req.body);
  const existing = q.get<Row>('SELECT * FROM transport_providers WHERE user_id = ?', req.user!.id);
  if (existing) {
    // Identity details changed → re-verification.
    const reverify = existing.status === 'verified' && (b.name !== existing.name || (b.license_info ?? null) !== existing.license_info);
    q.run(`UPDATE transport_providers SET name = ?, phone = ?, vehicle_types = ?, capacity_tonnes = ?, service_states = ?, service_districts = ?, rate_per_km = ?, min_charge = ?, license_info = ?
      ${reverify ? `, status = 'pending_review'` : ''} WHERE id = ?`,
      b.name, b.phone ?? null, JSON.stringify(b.vehicle_types), b.capacity_tonnes, JSON.stringify(b.service_states), JSON.stringify(b.service_districts),
      b.rate_per_km ?? null, b.min_charge ?? null, b.license_info ?? null, existing.id);
  } else {
    insert('transport_providers', { id: id(), user_id: req.user!.id, ...b, status: 'pending_review' });
  }
  res.json({ provider: out(q.get('SELECT * FROM transport_providers WHERE user_id = ?', req.user!.id)) });
}));

prov.post('/documents', docUpload.single('file'), ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM transport_providers WHERE user_id = ?', req.user!.id);
  if (!p) throw new HttpError(400, 'Create your transport profile first', 'no_profile');
  const { doc_type } = parse(z.object({ doc_type: z.enum(['vehicle_rc', 'driving_licence', 'permit', 'insurance', 'operator_id', 'other']) }), req.body);
  res.status(201).json({ document: storeDocument(req, 'transport', p.id, doc_type) });
}));

prov.post('/submit', ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM transport_providers WHERE user_id = ?', req.user!.id);
  if (!p) throw new HttpError(400, 'Create your transport profile first', 'no_profile');
  if (!q.get(`SELECT 1 FROM documents WHERE subject_type = 'transport' AND subject_id = ? AND doc_type IN ('vehicle_rc','driving_licence') AND deleted_at IS NULL`, p.id)) {
    throw new HttpError(400, 'Upload the vehicle RC or driving licence', 'incomplete');
  }
  if (q.get(`SELECT 1 FROM verification_applications WHERE kind = 'transport_provider' AND subject_id = ? AND status IN ('submitted','under_review')`, p.id)) throw new HttpError(409, 'Already under review', 'in_progress');
  const aid = id();
  insert('verification_applications', { id: aid, user_id: req.user!.id, kind: 'transport_provider', subject_id: p.id, submitted_data: out(p), checks: [{ check: 'Vehicle/licence document uploaded', result: 'pass' }] });
  q.run(`INSERT INTO verification_events (application_id, actor_id, action) VALUES (?, ?, 'submitted')`, aid, req.user!.id);
  res.status(201).json({ applicationId: aid });
}));

prov.get('/requests', ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM transport_providers WHERE user_id = ?', req.user!.id);
  if (!p || p.status !== 'verified') return res.json({ open: [], assigned: [], verified: false });
  res.json({
    verified: true,
    open: q.all(`SELECT t.*, (SELECT amount FROM transport_quotes WHERE request_id = t.id AND provider_id = ?) AS my_quote FROM transport_requests t
      WHERE t.status IN ('requested','quoted') AND t.preferred_date >= date('now', '-1 day') ORDER BY t.preferred_date LIMIT 100`, p.id),
    assigned: q.all(`SELECT t.* FROM transport_requests t JOIN transport_quotes tq ON tq.id = t.accepted_quote_id WHERE tq.provider_id = ? ORDER BY t.preferred_date DESC LIMIT 100`, p.id),
  });
}));

prov.post('/requests/:id/quotes', ah(async (req, res) => {
  const b = parse(z.object({ amount: z.number().positive().max(1e7), eta_date: zDate.optional().nullable(), note: zOptText(300), valid_hours: z.number().int().min(1).max(168).default(48) }), req.body);
  const p = q.get<Row>(`SELECT * FROM transport_providers WHERE user_id = ? AND status = 'verified'`, req.user!.id);
  if (!p) throw forbidden('Your transport profile must be verified before quoting');
  const r = q.get<Row>(`SELECT * FROM transport_requests WHERE id = ? AND status IN ('requested','quoted')`, req.params.id);
  if (!r) throw notFound('Open request');
  q.run(`INSERT INTO transport_quotes (id, request_id, provider_id, amount, eta_date, note, valid_until) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(request_id, provider_id) DO UPDATE SET amount = excluded.amount, eta_date = excluded.eta_date, note = excluded.note, valid_until = excluded.valid_until, status = 'offered'`,
    id(), r.id, p.id, b.amount, b.eta_date ?? null, b.note ?? null, new Date(Date.now() + b.valid_hours * 3600_000).toISOString());
  q.run(`UPDATE transport_requests SET status = 'quoted', updated_at = datetime('now') WHERE id = ?`, r.id);
  notifyT(r.requester_id, 'order', 'transport_update', { status: 'new quote received' }, `transport-quote:${r.id}:${p.id}`, `/trade/transport/${r.id}`);
  res.status(201).json({ ok: true });
}));

prov.post('/requests/:id/milestones', ah(async (req, res) => {
  const b = parse(z.object({ event: z.enum(MILESTONES), note: zOptText(500) }), req.body);
  const p = q.get<Row>('SELECT * FROM transport_providers WHERE user_id = ?', req.user!.id);
  const r = q.get<Row>(`SELECT t.* FROM transport_requests t JOIN transport_quotes tq ON tq.id = t.accepted_quote_id WHERE t.id = ? AND tq.provider_id = ?`, req.params.id, p?.id ?? '');
  if (!r) throw notFound('Assigned request');
  if (['delivered', 'cancelled'].includes(r.status)) throw new HttpError(409, `Request is ${r.status}`, 'bad_state');
  const status = b.event === 'picked_up' ? 'picked_up' : b.event === 'in_transit' ? 'in_transit' : b.event === 'exception' || b.event === 'damage' ? 'exception' : r.status;
  q.run(`UPDATE transport_requests SET status = ?, updated_at = datetime('now') WHERE id = ?`, status, r.id);
  milestone(r.id, b.event, req.user!.id, b.note);
  notifyT(r.requester_id, 'order', 'transport_update', { status: b.event.replace('_', ' ') }, `transport-ms:${r.id}:${b.event}`, `/trade/transport/${r.id}`);
  res.status(201).json({ ok: true });
}));

transportRouter.use('/provider', prov);

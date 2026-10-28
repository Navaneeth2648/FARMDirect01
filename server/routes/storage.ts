import { Router, type Request } from 'express';
import { z } from 'zod';
import { q, out, insert, updateSet, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, id, notFound, parse, zDate, zOptText, zText } from '../lib/http.ts';
import { requireRole } from '../lib/auth.ts';
import { hasPerm } from '../lib/permissions.ts';
import { audit } from '../lib/security.ts';
import { docUpload, storeDocument } from '../lib/files.ts';
import { availability, dayCount, occupancyToday, storageEstimate } from '../services/capacity.ts';
import { roadKm } from '../services/pricing.ts';
import { assertNotRestricted, checkCancellations, toQtl } from '../services/fraud.ts';
import { getSetting } from '../services/settings.ts';
import { ref } from '../services/trade.ts';
import { notifyT } from '../services/messages.ts';
import { notify } from '../services/notify.ts';

export const storageRouter = Router();
export const providerRouter = Router();

const FACILITY_TYPES = ['warehouse', 'grain', 'general', 'cold_storage', 'pre_cooling', 'fpo', 'other'] as const;
const CATEGORIES = ['cereal', 'pulse', 'oilseed', 'vegetable', 'fruit', 'cash', 'spice'] as const;
const today = () => new Date().toISOString().slice(0, 10);

function bookingEvent(bookingId: string, kind: string, actorId: string | null, note?: string, qtyQtl?: number | null) {
  q.run('INSERT INTO inventory_movements (booking_id, kind, quantity_qtl, note, actor_id) VALUES (?, ?, ?, ?, ?)', bookingId, kind, qtyQtl ?? null, note ?? null, actorId);
}

function publicFacility(f: Row, opts: { lat?: number; lon?: number; start?: string; end?: string; qtyQtl?: number; category?: string | null } = {}) {
  const rates = q.all('SELECT commodity_category, price, unit, period FROM storage_rates WHERE facility_id = ? ORDER BY price', f.id);
  const start = opts.start ?? today();
  const end = opts.end ?? start;
  const photos = q.all<Row>(`SELECT id FROM documents WHERE subject_type = 'facility' AND subject_id = ? AND doc_type = 'photo' AND deleted_at IS NULL`, f.id).map((d) => d.id);
  return {
    id: f.id, name: f.name, operator_name: f.operator_name, facility_type: f.facility_type, verified: f.status === 'verified', status: f.status,
    address: f.address, village: f.village, district: f.district, state: f.state, pincode: f.pincode, latitude: f.latitude, longitude: f.longitude,
    distance_km: opts.lat != null && opts.lon != null ? roadKm(opts.lat, opts.lon, f.latitude, f.longitude) : null,
    phone: f.phone, operating_hours: f.operating_hours, commodities: JSON.parse(f.commodities || '[]'),
    temp_range_c: f.temp_min_c != null ? [f.temp_min_c, f.temp_max_c] : null,
    total_capacity_qtl: f.total_capacity_qtl, min_booking_qtl: f.min_booking_qtl,
    availability: availability(f.id, start, end), availability_range: { start, end },
    charges: { loading_per_qtl: f.loading_per_qtl, unloading_per_qtl: f.unloading_per_qtl, handling_per_qtl: f.handling_per_qtl, booking_fee: f.booking_fee, tax_pct: f.tax_pct },
    rates, insurance_available: !!f.insurance_available, insurance_details: f.insurance_details,
    cancellation_policy: f.cancellation_policy, booking_conditions: f.booking_conditions, safety_info: f.safety_info,
    documentation_status: q.get<Row>(`SELECT COUNT(*) n FROM documents WHERE subject_type = 'facility' AND subject_id = ? AND doc_type != 'photo' AND deleted_at IS NULL`, f.id)!.n > 0 ? 'Documents reviewed by FARMDirect' : 'No documents on file',
    photos,
    estimate: opts.qtyQtl ? storageEstimate(f, opts.category ?? null, opts.qtyQtl, start, end) : null,
  };
}

const compatible = (f: Row, category: string | null) => {
  const c: string[] = JSON.parse(f.commodities || '[]');
  return !category || c.length === 0 || c.includes(category) || c.includes('all');
};

// ---------------- Discovery (farmers and everyone signed in) ----------------
storageRouter.get('/facilities', ah(async (req, res) => {
  const f = parse(z.object({
    lat: z.coerce.number().min(-90).max(90).optional(), lon: z.coerce.number().min(-180).max(180).optional(),
    max_km: z.coerce.number().positive().max(1000).default(100), type: z.enum(FACILITY_TYPES).optional(),
    crop_id: z.string().max(40).optional(), min_available: z.coerce.number().min(0).optional(),
    start: zDate.optional(), end: zDate.optional(), quantity: z.coerce.number().positive().optional(), unit: z.enum(['kg', 'quintal', 'tonne']).default('quintal'),
    loading: z.enum(['1']).optional(), insurance: z.enum(['1']).optional(), max_price: z.coerce.number().min(0).optional(),
    state: z.string().max(80).optional(), district: z.string().max(80).optional(),
  }), req.query);
  if (f.start && f.end && f.end < f.start) throw new HttpError(400, 'End date must be after start date', 'validation_error');
  const category = f.crop_id ? q.get<Row>('SELECT category FROM crops WHERE id = ?', f.crop_id)?.category ?? null : null;
  const where = [`status = 'verified'`];
  const params: unknown[] = [];
  if (f.type) { where.push('facility_type = ?'); params.push(f.type); }
  if (f.state) { where.push('state = ?'); params.push(f.state); }
  if (f.district) { where.push('district LIKE ?'); params.push(`%${f.district}%`); }
  if (f.loading) where.push('loading_per_qtl >= 0');
  if (f.insurance) where.push('insurance_available = 1');
  const qtyQtl = f.quantity ? toQtl(f.quantity, f.unit) : undefined;
  let list = q.all<Row>(`SELECT * FROM storage_facilities WHERE ${where.join(' AND ')} LIMIT 300`, ...params)
    .filter((x) => compatible(x, category))
    .map((x) => publicFacility(x, { lat: f.lat, lon: f.lon, start: f.start, end: f.end, qtyQtl, category }));
  if (f.lat != null) list = list.filter((x) => (x.distance_km ?? 0) <= f.max_km).sort((a, b) => (a.distance_km ?? 0) - (b.distance_km ?? 0));
  if (f.min_available != null) list = list.filter((x) => (x.availability?.available_qtl ?? 0) >= f.min_available!);
  if (qtyQtl) list = list.filter((x) => (x.availability?.available_qtl ?? 0) >= qtyQtl && x.min_booking_qtl <= qtyQtl);
  if (f.max_price != null) list = list.filter((x) => x.rates.some((r: any) => r.price <= f.max_price!));
  res.json({ facilities: list, note: 'Only facilities verified by FARMDirect are shown as bookable.' });
}));

storageRouter.get('/facilities/:id', ah(async (req, res) => {
  const f = q.get<Row>('SELECT * FROM storage_facilities WHERE id = ?', req.params.id);
  if (!f || (f.status !== 'verified' && f.provider_id !== req.user!.id && !hasPerm(req.user!.role, 'verify.storage'))) throw notFound('Facility');
  const p = parse(z.object({ start: zDate.optional(), end: zDate.optional(), lat: z.coerce.number().optional(), lon: z.coerce.number().optional() }), req.query);
  res.json({
    facility: publicFacility(f, p),
    blackouts: q.all('SELECT start_date, end_date, capacity_reduction_qtl, reason FROM facility_blackouts WHERE facility_id = ? AND end_date >= ? ORDER BY start_date', f.id, today()),
  });
}));

const CheckSchema = z.object({
  facility_id: z.string(), crop_id: z.string().optional().nullable(), commodity: z.string().trim().min(2).max(100),
  quantity: z.number().positive().max(1e7), unit: z.enum(['kg', 'quintal', 'tonne']), start_date: zDate, end_date: zDate,
  lot_id: z.string().optional().nullable(),
});

function evaluateBooking(b: z.infer<typeof CheckSchema>) {
  const f = q.get<Row>('SELECT * FROM storage_facilities WHERE id = ?', b.facility_id);
  if (!f || f.status !== 'verified') throw new HttpError(409, 'This facility is not currently accepting bookings', 'not_bookable');
  if (b.end_date < b.start_date) throw new HttpError(400, 'End date must be on or after the start date', 'validation_error');
  if (b.start_date < today()) throw new HttpError(400, 'Start date cannot be in the past', 'validation_error');
  if (dayCount(b.start_date, b.end_date) > 365) throw new HttpError(400, 'Bookings can be up to 365 days; extend later if needed', 'validation_error');
  const category = b.crop_id ? q.get<Row>('SELECT category FROM crops WHERE id = ?', b.crop_id)?.category ?? null : null;
  const qtyQtl = toQtl(b.quantity, b.unit);
  const avail = availability(f.id, b.start_date, b.end_date)!;
  const est = storageEstimate(f, category, qtyQtl, b.start_date, b.end_date);
  const issues: string[] = [];
  if (!compatible(f, category)) issues.push('This facility does not store this type of produce.');
  if (qtyQtl < f.min_booking_qtl) issues.push(`Minimum booking is ${f.min_booking_qtl} quintal.`);
  if (avail.available_qtl < qtyQtl) issues.push(`Only ${avail.available_qtl} quintal is free for all of those dates.`);
  if (!est) issues.push('The facility has not published a rate for this produce.');
  return { f, category, qtyQtl, avail, est, issues, ok: issues.length === 0 };
}

storageRouter.post('/check', ah(async (req, res) => {
  const b = parse(CheckSchema, req.body);
  const r = evaluateBooking(b);
  res.json({
    ok: r.ok, issues: r.issues, quantity_qtl: r.qtyQtl, availability: r.avail, estimate: r.est,
    cancellation_policy: r.f.cancellation_policy, booking_conditions: r.f.booking_conditions,
    hold_hours: getSetting('storage_hold_hours'),
  });
}));

storageRouter.post('/bookings', requireRole('farmer', 'fpo_manager'), ah(async (req, res) => {
  const b = parse(CheckSchema.extend({ confirm: z.literal(true) }), req.body);
  assertNotRestricted(req.user!.id, 'no_bookings');
  if (b.lot_id && !q.get('SELECT 1 FROM produce_lots WHERE id = ? AND farmer_id = ?', b.lot_id, req.user!.id)) throw notFound('Lot');
  const bid = id();
  const bookingRef = ref('SB');
  q.tx(() => {
    // Re-evaluate inside the transaction so two requests cannot both take the last capacity.
    const r = evaluateBooking(b);
    if (!r.ok) throw new HttpError(409, r.issues.join(' '), 'not_available', { issues: r.issues });
    insert('storage_bookings', {
      id: bid, booking_ref: bookingRef, farmer_id: req.user!.id, facility_id: r.f.id, lot_id: b.lot_id ?? null, commodity: b.commodity, crop_id: b.crop_id ?? null,
      quantity: b.quantity, unit: b.unit, quantity_qtl: r.qtyQtl, start_date: b.start_date, end_date: b.end_date, status: 'availability_requested',
      hold_expires_at: new Date(Date.now() + Number(getSetting('storage_hold_hours')) * 3600_000).toISOString(), estimate: r.est,
    });
    bookingEvent(bid, 'status', req.user!.id, 'Booking requested; capacity held pending facility confirmation', r.qtyQtl);
  });
  const f = q.get<Row>('SELECT provider_id, name FROM storage_facilities WHERE id = ?', b.facility_id)!;
  notify(f.provider_id, 'order', 'New storage booking request', `${b.quantity} ${b.unit} of ${b.commodity} from ${b.start_date} to ${b.end_date}`, `booking-req:${bid}`, '/storage/provider');
  audit(req, 'storage.booking_request', 'booking', bid);
  res.status(201).json({ booking: out(q.get('SELECT * FROM storage_bookings WHERE id = ?', bid)) });
}));

function loadBooking(req: Request, bookingId: string) {
  const b = q.get<Row>('SELECT * FROM storage_bookings WHERE id = ?', bookingId);
  if (!b) throw notFound('Booking');
  const f = q.get<Row>('SELECT * FROM storage_facilities WHERE id = ?', b.facility_id)!;
  const side = b.farmer_id === req.user!.id ? 'farmer' : f.provider_id === req.user!.id ? 'provider' : hasPerm(req.user!.role, 'bookings.view') ? 'staff' : null;
  if (!side) throw notFound('Booking');
  return { b, f, side };
}

storageRouter.get('/bookings', ah(async (req, res) => {
  res.json({
    bookings: q.all<Row>(`SELECT b.*, f.name AS facility_name, f.district AS facility_district, f.phone AS facility_phone FROM storage_bookings b
      JOIN storage_facilities f ON f.id = b.facility_id WHERE b.farmer_id = ? ORDER BY b.created_at DESC`, req.user!.id).map(out),
  });
}));

storageRouter.get('/bookings/:id', ah(async (req, res) => {
  const { b, f, side } = loadBooking(req, req.params.id);
  const receipt = q.get<Row>('SELECT * FROM storage_receipts WHERE booking_id = ?', b.id);
  res.json({
    booking: out(b), my_side: side,
    facility: { id: f.id, name: f.name, operator_name: f.operator_name, address: f.address, district: f.district, state: f.state, phone: f.phone, latitude: f.latitude, longitude: f.longitude, cancellation_policy: f.cancellation_policy },
    farmer: side !== 'farmer' ? q.get('SELECT full_name, phone, village, district FROM users WHERE id = ?', b.farmer_id) : undefined,
    receipt: receipt ? { ...receipt, photos: q.all(`SELECT id FROM documents WHERE subject_type = 'receipt' AND subject_id = ? AND deleted_at IS NULL`, receipt.id) } : null,
    movements: q.all('SELECT kind, quantity_qtl, note, created_at, (SELECT full_name FROM users WHERE id = actor_id) AS actor FROM inventory_movements WHERE booking_id = ? ORDER BY id', b.id),
    payments: q.all('SELECT * FROM payment_records WHERE booking_id = ? ORDER BY created_at', b.id),
  });
}));

storageRouter.post('/bookings/:id/cancel', ah(async (req, res) => {
  const { reason } = parse(z.object({ reason: zText(500), confirm: z.literal(true) }), req.body);
  const { b, f, side } = loadBooking(req, req.params.id);
  if (side !== 'farmer') throw forbidden();
  if (!['availability_requested', 'temporarily_reserved', 'awaiting_payment', 'confirmed', 'check_in_scheduled'].includes(b.status)) {
    throw new HttpError(409, 'Produce is already in storage. Request release instead.', 'bad_state');
  }
  q.run(`UPDATE storage_bookings SET status = 'cancelled', cancel_reason = ?, updated_at = datetime('now') WHERE id = ?`, reason, b.id);
  q.run(`UPDATE payment_records SET status = 'failed', updated_at = datetime('now') WHERE booking_id = ? AND status IN ('required','initiated')`, b.id);
  bookingEvent(b.id, 'status', req.user!.id, `Cancelled by farmer: ${reason}`);
  checkCancellations(req.user!.id);
  notify(f.provider_id, 'order', 'Storage booking cancelled', `Booking ${b.booking_ref} was cancelled by the farmer.`, `booking-cancel:${b.id}`, '/storage/provider');
  res.json({ ok: true, cancellation_policy: f.cancellation_policy });
}));

storageRouter.post('/bookings/:id/extend', ah(async (req, res) => {
  const { end_date } = parse(z.object({ end_date: zDate, confirm: z.literal(true) }), req.body);
  const { b, f, side } = loadBooking(req, req.params.id);
  if (side !== 'farmer') throw forbidden();
  if (!['confirmed', 'check_in_scheduled', 'received', 'in_storage'].includes(b.status)) throw new HttpError(409, 'Only active bookings can be extended', 'bad_state');
  if (end_date <= b.end_date) throw new HttpError(400, 'Choose a later end date', 'validation_error');
  q.tx(() => {
    const extra = availability(f.id, b.end_date, end_date, b.id)!;
    if (extra.available_qtl < b.quantity_qtl) throw new HttpError(409, `Only ${extra.available_qtl} quintal is free for the extra days`, 'not_available');
    const category = b.crop_id ? q.get<Row>('SELECT category FROM crops WHERE id = ?', b.crop_id)?.category ?? null : null;
    const est = storageEstimate(f, category, b.quantity_qtl, b.start_date, end_date);
    q.run(`UPDATE storage_bookings SET end_date = ?, estimate = ?, updated_at = datetime('now') WHERE id = ?`, end_date, JSON.stringify(est), b.id);
    bookingEvent(b.id, 'status', req.user!.id, `Extended from ${b.end_date} to ${end_date}. New estimate ₹${est?.total ?? '—'}`);
  });
  notify(f.provider_id, 'order', 'Storage booking extended', `Booking ${b.booking_ref} now ends on ${end_date}.`, `booking-extend:${b.id}:${end_date}`, '/storage/provider');
  res.json({ booking: out(q.get('SELECT * FROM storage_bookings WHERE id = ?', b.id)) });
}));

storageRouter.post('/bookings/:id/release-request', ah(async (req, res) => {
  const { note } = parse(z.object({ note: zOptText(500) }), req.body);
  const { b, f, side } = loadBooking(req, req.params.id);
  if (side !== 'farmer') throw forbidden();
  if (!['received', 'in_storage'].includes(b.status)) throw new HttpError(409, 'Nothing is in storage for this booking yet', 'bad_state');
  q.run(`UPDATE storage_bookings SET status = 'release_requested', updated_at = datetime('now') WHERE id = ?`, b.id);
  bookingEvent(b.id, 'status', req.user!.id, `Release requested${note ? `: ${note}` : ''}`);
  notify(f.provider_id, 'order', 'Release requested', `Farmer requested release for booking ${b.booking_ref}.`, `booking-release-req:${b.id}`, '/storage/provider');
  res.json({ ok: true });
}));

storageRouter.post('/facilities/:id/enquiries', ah(async (req, res) => {
  const { message } = parse(z.object({ message: zText(1000) }), req.body);
  const f = q.get<Row>(`SELECT * FROM storage_facilities WHERE id = ? AND status = 'verified'`, req.params.id);
  if (!f) throw notFound('Facility');
  q.run('INSERT INTO storage_enquiries (id, facility_id, user_id, message) VALUES (?, ?, ?, ?)', id(), f.id, req.user!.id, message);
  notify(f.provider_id, 'system', 'New storage enquiry', message.slice(0, 140), `enquiry:${f.id}:${Date.now()}`, '/storage/provider');
  res.status(201).json({ ok: true });
}));

storageRouter.get('/enquiries', ah(async (req, res) => {
  res.json({ enquiries: q.all(`SELECT e.*, f.name AS facility_name FROM storage_enquiries e JOIN storage_facilities f ON f.id = e.facility_id WHERE e.user_id = ? ORDER BY e.created_at DESC`, req.user!.id) });
}));

// ---------------- Storage provider workspace ----------------
providerRouter.use(requireRole('storage_provider'));

const FacilitySchema = z.object({
  name: zText(200), operator_name: zText(200), facility_type: z.enum(FACILITY_TYPES),
  address: zText(500), village: zOptText(100), district: zText(80), state: zText(80),
  pincode: z.string().regex(/^\d{6}$/).optional().nullable().or(z.literal('').transform(() => null)),
  latitude: z.number().min(-90).max(90), longitude: z.number().min(-180).max(180),
  phone: z.string().regex(/^\+?\d[\d\s-]{7,15}$/).optional().nullable(), operating_hours: zOptText(200),
  commodities: z.array(z.enum([...CATEGORIES, 'all'])).min(1),
  temp_min_c: z.number().min(-40).max(60).optional().nullable(), temp_max_c: z.number().min(-40).max(60).optional().nullable(),
  total_capacity_qtl: z.number().positive().max(1e7), min_booking_qtl: z.number().positive().max(1e6).default(1),
  loading_per_qtl: z.number().min(0).max(1e5).default(0), unloading_per_qtl: z.number().min(0).max(1e5).default(0),
  handling_per_qtl: z.number().min(0).max(1e5).default(0), booking_fee: z.number().min(0).max(1e6).default(0),
  tax_pct: z.number().min(0).max(28).default(0),
  insurance_available: z.boolean().default(false), insurance_details: zOptText(1000),
  cancellation_policy: zText(2000), booking_conditions: zOptText(2000),
  authorization_type: z.enum(['owned', 'leased', 'authorised_operator']), license_info: zOptText(1000), safety_info: zOptText(1000),
});
const SENSITIVE_FACILITY = ['name', 'operator_name', 'facility_type', 'address', 'district', 'state', 'latitude', 'longitude', 'total_capacity_qtl', 'authorization_type', 'license_info'];

function ownFacility(req: Request, facilityId: string) {
  const f = q.get<Row>('SELECT * FROM storage_facilities WHERE id = ? AND provider_id = ?', facilityId, req.user!.id);
  if (!f) throw notFound('Facility');
  return f;
}

providerRouter.get('/facilities', ah(async (req, res) => {
  const list = q.all<Row>('SELECT * FROM storage_facilities WHERE provider_id = ? ORDER BY created_at', req.user!.id);
  res.json({
    facilities: list.map((f) => ({
      ...out(f), occupancy: occupancyToday(f.id), rates: q.all('SELECT * FROM storage_rates WHERE facility_id = ?', f.id),
      documents: q.all(`SELECT id, doc_type, mime, original_name, created_at FROM documents WHERE subject_type = 'facility' AND subject_id = ? AND deleted_at IS NULL`, f.id),
      blackouts: q.all('SELECT * FROM facility_blackouts WHERE facility_id = ? ORDER BY start_date', f.id),
      revenue_confirmed: q.get<Row>(`SELECT COALESCE(SUM(p.amount),0) s FROM payment_records p JOIN storage_bookings b ON b.id = p.booking_id WHERE b.facility_id = ? AND p.status = 'confirmed' AND p.kind = 'storage_fee'`, f.id)!.s,
      application: q.get(`SELECT id, status, decision_reason, submitted_at FROM verification_applications WHERE kind = 'storage_facility' AND subject_id = ? ORDER BY submitted_at DESC LIMIT 1`, f.id) ?? null,
    })),
  });
}));

providerRouter.post('/facilities', ah(async (req, res) => {
  const d = parse(FacilitySchema, req.body);
  const fid = id();
  insert('storage_facilities', { id: fid, provider_id: req.user!.id, ...d, status: 'draft' });
  audit(req, 'facility.create', 'facility', fid);
  res.status(201).json({ facility: out(q.get('SELECT * FROM storage_facilities WHERE id = ?', fid)) });
}));

providerRouter.patch('/facilities/:id', ah(async (req, res) => {
  const f = ownFacility(req, req.params.id);
  const d = parse(FacilitySchema.partial(), req.body);
  const sensitive = Object.fromEntries(Object.entries(d).filter(([k, v]) => SENSITIVE_FACILITY.includes(k) && v !== f[k]));
  const direct = Object.fromEntries(Object.entries(d).filter(([k]) => !SENSITIVE_FACILITY.includes(k)));
  if (d.total_capacity_qtl != null && d.total_capacity_qtl < f.total_capacity_qtl) {
    const peak = availability(f.id, today(), new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10))!;
    if (peak.peak_occupied_qtl > d.total_capacity_qtl) throw new HttpError(409, `Existing bookings use up to ${peak.peak_occupied_qtl} quintal; capacity cannot go below that`, 'capacity_in_use');
  }
  const set = updateSet(direct);
  if (!set.empty) q.run(`UPDATE storage_facilities SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, f.id);
  let pendingReview = false;
  if (Object.keys(sensitive).length) {
    if (['draft', 'rejected'].includes(f.status)) {
      const s2 = updateSet(sensitive);
      q.run(`UPDATE storage_facilities SET ${s2.sql}, updated_at = datetime('now') WHERE id = ?`, ...s2.values, f.id);
    } else {
      // Verification-sensitive details change only after staff approval.
      q.run(`UPDATE storage_facilities SET pending_changes = ?, updated_at = datetime('now') WHERE id = ?`, JSON.stringify({ ...(f.pending_changes ? JSON.parse(f.pending_changes) : {}), ...sensitive }), f.id);
      pendingReview = true;
    }
  }
  audit(req, 'facility.update', 'facility', f.id, { direct: Object.keys(direct), pending: Object.keys(sensitive) });
  res.json({ facility: out(q.get('SELECT * FROM storage_facilities WHERE id = ?', f.id)), pending_review: pendingReview });
}));

providerRouter.put('/facilities/:id/rates', ah(async (req, res) => {
  const f = ownFacility(req, req.params.id);
  const rates = parse(z.array(z.object({
    commodity_category: z.enum(CATEGORIES).optional().nullable(), price: z.number().min(0).max(1e6),
    unit: z.enum(['quintal', 'tonne']), period: z.enum(['day', 'week', 'month']),
  })).min(1).max(20), req.body);
  q.tx(() => {
    q.run('DELETE FROM storage_rates WHERE facility_id = ?', f.id);
    for (const r of rates) q.run('INSERT INTO storage_rates (id, facility_id, commodity_category, price, unit, period) VALUES (?, ?, ?, ?, ?, ?)', id(), f.id, r.commodity_category ?? null, r.price, r.unit, r.period);
  });
  audit(req, 'facility.rates_update', 'facility', f.id, rates);
  res.json({ rates: q.all('SELECT * FROM storage_rates WHERE facility_id = ?', f.id) });
}));

providerRouter.post('/facilities/:id/blackouts', ah(async (req, res) => {
  const f = ownFacility(req, req.params.id);
  const b = parse(z.object({ start_date: zDate, end_date: zDate, capacity_reduction_qtl: z.number().positive(), reason: zOptText(300) }), req.body);
  if (b.end_date < b.start_date) throw new HttpError(400, 'End date must be after start date', 'validation_error');
  const avail = availability(f.id, b.start_date, b.end_date)!;
  if (b.capacity_reduction_qtl > avail.available_qtl) throw new HttpError(409, `Only ${avail.available_qtl} quintal is unbooked in that period`, 'capacity_in_use');
  q.run('INSERT INTO facility_blackouts (id, facility_id, start_date, end_date, capacity_reduction_qtl, reason) VALUES (?, ?, ?, ?, ?, ?)', id(), f.id, b.start_date, b.end_date, b.capacity_reduction_qtl, b.reason ?? null);
  res.status(201).json({ ok: true });
}));

providerRouter.delete('/facilities/:id/blackouts/:bid', ah(async (req, res) => {
  const f = ownFacility(req, req.params.id);
  q.run('DELETE FROM facility_blackouts WHERE id = ? AND facility_id = ?', req.params.bid, f.id);
  res.json({ ok: true });
}));

providerRouter.post('/facilities/:id/documents', docUpload.single('file'), ah(async (req, res) => {
  const f = ownFacility(req, req.params.id);
  const { doc_type } = parse(z.object({ doc_type: z.enum(['authorization_proof', 'license', 'insurance', 'operator_id', 'photo', 'bank_proof', 'other']) }), req.body);
  res.status(201).json({ document: storeDocument(req, 'facility', f.id, doc_type, { imagesOnly: doc_type === 'photo' }) });
}));

providerRouter.post('/facilities/:id/submit', ah(async (req, res) => {
  const f = ownFacility(req, req.params.id);
  if (!['draft', 'rejected'].includes(f.status) && !f.pending_changes) throw new HttpError(409, 'Nothing to submit for review', 'bad_state');
  if (!q.get('SELECT 1 FROM storage_rates WHERE facility_id = ?', f.id)) throw new HttpError(400, 'Add at least one storage rate first', 'incomplete');
  if (!q.get(`SELECT 1 FROM documents WHERE subject_type = 'facility' AND subject_id = ? AND doc_type = 'authorization_proof' AND deleted_at IS NULL`, f.id)) {
    throw new HttpError(400, 'Upload proof of ownership, lease or authorisation to operate the facility', 'incomplete');
  }
  if (q.get(`SELECT 1 FROM verification_applications WHERE kind = 'storage_facility' AND subject_id = ? AND status IN ('submitted','under_review')`, f.id)) throw new HttpError(409, 'Already under review', 'in_progress');
  const aid = id();
  q.tx(() => {
    insert('verification_applications', {
      id: aid, user_id: req.user!.id, kind: 'storage_facility', subject_id: f.id, submitted_data: { ...out(f), pending_changes: f.pending_changes ? JSON.parse(f.pending_changes) : null },
      checks: [
        { check: 'Map location provided', result: 'pass' },
        { check: 'Authorisation document uploaded', result: 'pass' },
        { check: 'Rate card published', result: 'pass' },
        { check: 'Site inspection / licence check', result: 'reviewer to confirm' },
      ],
    });
    q.run(`INSERT INTO verification_events (application_id, actor_id, action) VALUES (?, ?, 'submitted')`, aid, req.user!.id);
    if (f.status !== 'verified') q.run(`UPDATE storage_facilities SET status = 'pending_review', updated_at = datetime('now') WHERE id = ?`, f.id);
  });
  audit(req, 'facility.submit', 'facility', f.id);
  res.status(201).json({ applicationId: aid });
}));

providerRouter.post('/facilities/:id/incidents', ah(async (req, res) => {
  const f = ownFacility(req, req.params.id);
  const b = parse(z.object({ severity: z.enum(['low', 'medium', 'high']), description: zText(2000) }), req.body);
  q.run('INSERT INTO facility_incidents (id, facility_id, reported_by, severity, description) VALUES (?, ?, ?, ?, ?)', id(), f.id, req.user!.id, b.severity, b.description);
  // Notify farmers with produce currently stored there.
  const affected = q.all<Row>(`SELECT DISTINCT farmer_id, booking_ref FROM storage_bookings WHERE facility_id = ? AND status IN ('received','in_storage','release_requested')`, f.id);
  for (const a of affected) notifyT(a.farmer_id, 'system', 'booking_update', { ref: a.booking_ref, status: 'facility reported an incident – contact the facility' }, `incident:${f.id}:${Date.now()}:${a.booking_ref}`, '/storage');
  audit(req, 'facility.incident', 'facility', f.id, b);
  res.status(201).json({ ok: true, farmers_notified: affected.length });
}));

providerRouter.get('/bookings', ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  res.json({
    bookings: q.all<Row>(`SELECT b.*, f.name AS facility_name, u.full_name AS farmer_name FROM storage_bookings b JOIN storage_facilities f ON f.id = b.facility_id
      LEFT JOIN users u ON u.id = b.farmer_id WHERE f.provider_id = ? ${status ? 'AND b.status = ?' : ''} ORDER BY b.start_date`, ...(status ? [req.user!.id, status] : [req.user!.id])).map(out),
  });
}));

function providerBooking(req: Request, bookingId: string) {
  const { b, f, side } = loadBooking(req, bookingId);
  if (side !== 'provider') throw forbidden();
  return { b, f };
}

providerRouter.post('/bookings/:id/decide', ah(async (req, res) => {
  const { decision, note } = parse(z.object({ decision: z.enum(['confirm', 'decline']), note: zOptText(500) }), req.body);
  const { b, f } = providerBooking(req, req.params.id);
  if (b.status !== 'availability_requested') throw new HttpError(409, `Booking is ${b.status}`, 'bad_state');
  if (decision === 'decline' && !note) throw new HttpError(400, 'Give a reason for declining', 'validation_error');
  q.tx(() => {
    if (decision === 'confirm') {
      if (b.hold_expires_at && b.hold_expires_at < new Date().toISOString()) {
        // Hold lapsed: confirm only if capacity is still free.
        const a = availability(f.id, b.start_date, b.end_date, b.id)!;
        if (a.available_qtl < b.quantity_qtl) throw new HttpError(409, 'The hold expired and the capacity is no longer free', 'not_available');
      }
      const status = f.booking_fee > 0 ? 'awaiting_payment' : 'confirmed';
      q.run(`UPDATE storage_bookings SET status = ?, hold_expires_at = NULL, provider_note = ?, updated_at = datetime('now') WHERE id = ?`, status, note ?? null, b.id);
      if (f.booking_fee > 0) insert('payment_records', { id: id(), ref: ref('PAY'), booking_id: b.id, kind: 'storage_fee', payer_id: b.farmer_id, payee_id: f.provider_id, amount: f.booking_fee, status: 'required', due_date: b.start_date, reference_note: 'Booking fee' });
      bookingEvent(b.id, 'status', req.user!.id, status === 'confirmed' ? 'Confirmed by facility' : 'Accepted by facility – booking fee due');
    } else {
      q.run(`UPDATE storage_bookings SET status = 'declined', hold_expires_at = NULL, provider_note = ?, updated_at = datetime('now') WHERE id = ?`, note, b.id);
      bookingEvent(b.id, 'status', req.user!.id, `Declined by facility: ${note}`);
    }
  });
  notifyT(b.farmer_id, 'order', 'booking_update', { ref: b.booking_ref, status: decision === 'confirm' ? (f.booking_fee > 0 ? 'accepted – pay booking fee' : 'confirmed') : 'declined' }, `booking-decide:${b.id}`, `/storage/bookings/${b.id}`);
  audit(req, `storage.booking_${decision}`, 'booking', b.id);
  res.json({ booking: out(q.get('SELECT * FROM storage_bookings WHERE id = ?', b.id)) });
}));

providerRouter.post('/bookings/:id/schedule-checkin', ah(async (req, res) => {
  const { check_in_date } = parse(z.object({ check_in_date: zDate }), req.body);
  const { b } = providerBooking(req, req.params.id);
  if (b.status !== 'confirmed') throw new HttpError(409, b.status === 'awaiting_payment' ? 'Booking fee is not yet confirmed' : `Booking is ${b.status}`, 'bad_state');
  q.run(`UPDATE storage_bookings SET status = 'check_in_scheduled', check_in_date = ?, updated_at = datetime('now') WHERE id = ?`, check_in_date, b.id);
  bookingEvent(b.id, 'status', req.user!.id, `Check-in scheduled for ${check_in_date}`);
  notifyT(b.farmer_id, 'order', 'booking_update', { ref: b.booking_ref, status: `check-in on ${check_in_date}` }, `booking-checkin:${b.id}`, `/storage/bookings/${b.id}`);
  res.json({ ok: true });
}));

/** Produce arrives: record a digital storage receipt (traceable, timestamped, signed by the operator account). */
providerRouter.post('/bookings/:id/receive', ah(async (req, res) => {
  const r = parse(z.object({
    received_qty_qtl: z.number().positive(), condition_notes: zText(1000), moisture_pct: z.number().min(0).max(100).optional().nullable(),
    quality_notes: zOptText(1000), bin_ref: zOptText(100),
  }), req.body);
  const { b } = providerBooking(req, req.params.id);
  if (!['confirmed', 'check_in_scheduled'].includes(b.status)) throw new HttpError(409, `Booking is ${b.status}`, 'bad_state');
  if (r.received_qty_qtl > b.quantity_qtl + 1e-9) throw new HttpError(400, `Received quantity exceeds the booked ${b.quantity_qtl} quintal. Ask the farmer to extend the booking first.`, 'over_booked');
  const rid = id();
  const receiptNo = ref('SR');
  q.tx(() => {
    insert('storage_receipts', { id: rid, booking_id: b.id, receipt_no: receiptNo, ...r, expected_release_date: b.end_date, issued_by: req.user!.id });
    q.run(`UPDATE storage_bookings SET status = 'in_storage', check_in_at = datetime('now'), received_qty_qtl = ?, updated_at = datetime('now') WHERE id = ?`, r.received_qty_qtl, b.id);
    bookingEvent(b.id, 'in', req.user!.id, `Received. Condition: ${r.condition_notes}${r.moisture_pct != null ? `; moisture ${r.moisture_pct}%` : ''}`, r.received_qty_qtl);
  });
  notifyT(b.farmer_id, 'order', 'booking_update', { ref: b.booking_ref, status: `produce received – receipt ${receiptNo}` }, `booking-received:${b.id}`, `/storage/bookings/${b.id}`);
  audit(req, 'storage.receive', 'booking', b.id, r);
  res.status(201).json({ receipt: q.get('SELECT * FROM storage_receipts WHERE id = ?', rid) });
}));

providerRouter.post('/receipts/:id/photos', docUpload.single('file'), ah(async (req, res) => {
  const rc = q.get<Row>(`SELECT r.* FROM storage_receipts r JOIN storage_bookings b ON b.id = r.booking_id JOIN storage_facilities f ON f.id = b.facility_id WHERE r.id = ? AND f.provider_id = ?`, req.params.id, req.user!.id);
  if (!rc) throw notFound('Receipt');
  res.status(201).json({ document: storeDocument(req, 'receipt', rc.id, 'photo', { imagesOnly: true }) });
}));

providerRouter.post('/bookings/:id/movement', ah(async (req, res) => {
  const m = parse(z.object({ kind: z.enum(['condition', 'adjust']), quantity_qtl: z.number().min(0).optional().nullable(), note: zText(1000) }), req.body);
  const { b } = providerBooking(req, req.params.id);
  if (!['received', 'in_storage', 'release_requested'].includes(b.status)) throw new HttpError(409, 'Produce is not in storage', 'bad_state');
  if (m.kind === 'adjust') {
    if (m.quantity_qtl == null) throw new HttpError(400, 'Enter the corrected quantity', 'validation_error');
    q.run(`UPDATE storage_bookings SET received_qty_qtl = ?, updated_at = datetime('now') WHERE id = ?`, m.quantity_qtl, b.id);
  }
  bookingEvent(b.id, m.kind, req.user!.id, m.note, m.quantity_qtl ?? null);
  notifyT(b.farmer_id, 'order', 'booking_update', { ref: b.booking_ref, status: m.kind === 'adjust' ? 'quantity record corrected' : 'condition update recorded' }, `booking-move:${b.id}:${Date.now()}`, `/storage/bookings/${b.id}`);
  audit(req, `storage.${m.kind}`, 'booking', b.id, m);
  res.status(201).json({ ok: true });
}));

/** Release: compute final charges from actual days and quantity; collection confirmed by the operator. */
providerRouter.post('/bookings/:id/release', ah(async (req, res) => {
  const { note } = parse(z.object({ note: zOptText(500), confirm: z.literal(true) }), req.body);
  const { b, f } = providerBooking(req, req.params.id);
  if (!['in_storage', 'received', 'release_requested'].includes(b.status)) throw new HttpError(409, `Booking is ${b.status}`, 'bad_state');
  const end = today();
  const start = (b.check_in_at || b.start_date).slice(0, 10);
  const category = b.crop_id ? q.get<Row>('SELECT category FROM crops WHERE id = ?', b.crop_id)?.category ?? null : null;
  const est = storageEstimate(f, category, b.received_qty_qtl ?? b.quantity_qtl, start, end < start ? start : end);
  const total = est?.total ?? 0;
  const paid = q.get<Row>(`SELECT COALESCE(SUM(amount),0) s FROM payment_records WHERE booking_id = ? AND status = 'confirmed' AND kind = 'storage_fee'`, b.id)!.s;
  const outstanding = Math.max(0, Math.round((total - paid) * 100) / 100);
  q.tx(() => {
    q.run(`UPDATE storage_bookings SET status = 'released', check_out_at = datetime('now'), final_charges = ?, updated_at = datetime('now') WHERE id = ?`,
      JSON.stringify({ ...est, paid_before_release: paid, outstanding }), b.id);
    q.run(`UPDATE payment_records SET status = 'failed', updated_at = datetime('now') WHERE booking_id = ? AND status = 'required'`, b.id);
    if (outstanding > 0) insert('payment_records', { id: id(), ref: ref('PAY'), booking_id: b.id, kind: 'storage_fee', payer_id: b.farmer_id, payee_id: f.provider_id, amount: outstanding, status: 'required', due_date: end, reference_note: 'Final storage charges' });
    bookingEvent(b.id, 'out', req.user!.id, `Released/collected${note ? `: ${note}` : ''}. Final charges ₹${total}, outstanding ₹${outstanding}`, b.received_qty_qtl);
  });
  notifyT(b.farmer_id, 'order', 'booking_update', { ref: b.booking_ref, status: outstanding > 0 ? 'released – final charges due' : 'released' }, `booking-released:${b.id}`, `/storage/bookings/${b.id}`);
  audit(req, 'storage.release', 'booking', b.id, { total, outstanding });
  res.json({ final_charges: { ...est, paid_before_release: paid, outstanding } });
}));

providerRouter.post('/bookings/:id/complete', ah(async (req, res) => {
  const { b } = providerBooking(req, req.params.id);
  if (b.status !== 'released') throw new HttpError(409, 'Release the produce first', 'bad_state');
  const open = q.get<Row>(`SELECT COUNT(*) n FROM payment_records WHERE booking_id = ? AND status NOT IN ('confirmed','settled','failed') AND kind != 'refund'`, b.id)!.n;
  if (open) throw new HttpError(409, 'Storage charges are not yet confirmed as paid', 'payments_open');
  q.run(`UPDATE storage_bookings SET status = 'completed', updated_at = datetime('now') WHERE id = ?`, b.id);
  bookingEvent(b.id, 'status', req.user!.id, 'Completed – charges reconciled');
  res.json({ ok: true });
}));

providerRouter.get('/enquiries', ah(async (req, res) => {
  res.json({ enquiries: q.all(`SELECT e.*, f.name AS facility_name, u.full_name FROM storage_enquiries e JOIN storage_facilities f ON f.id = e.facility_id
    LEFT JOIN users u ON u.id = e.user_id WHERE f.provider_id = ? ORDER BY e.created_at DESC`, req.user!.id) });
}));

providerRouter.post('/enquiries/:id/reply', ah(async (req, res) => {
  const { reply } = parse(z.object({ reply: zText(1000) }), req.body);
  const e = q.get<Row>(`SELECT e.* FROM storage_enquiries e JOIN storage_facilities f ON f.id = e.facility_id WHERE e.id = ? AND f.provider_id = ?`, req.params.id, req.user!.id);
  if (!e) throw notFound('Enquiry');
  q.run(`UPDATE storage_enquiries SET reply = ?, status = 'answered', replied_at = datetime('now') WHERE id = ?`, reply, e.id);
  notify(e.user_id, 'system', 'Storage facility replied', reply.slice(0, 140), `enquiry-reply:${e.id}`, '/storage');
  res.json({ ok: true });
}));

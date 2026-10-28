import { Router } from 'express';
import { z } from 'zod';
import { q, out, insert, updateSet, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, id, notFound, parse, zDate, zOptText } from '../lib/http.ts';
import { requireRole } from '../lib/auth.ts';
import { audit } from '../lib/security.ts';
import { docUpload, storeDocument } from '../lib/files.ts';
import { farmerStanding, buyerStanding } from '../services/standing.ts';
import { assertNotDuplicateLot, assertNotRestricted, checkListingBurst, checkPriceOutlier, perQtl, toQtl } from '../services/fraud.ts';
import { getSetting, DEFAULT_SPOILAGE_PCT_PER_MONTH } from '../services/settings.ts';
import { ACTIVE_LOT_STATUSES, refreshLotStatus } from '../services/trade.ts';
import { breakdown, roadKm } from '../services/pricing.ts';
import { availability, storageEstimate } from '../services/capacity.ts';
import { latestGrade } from './grading.ts';

export const marketplaceRouter = Router();

const UNITS = ['kg', 'quintal', 'tonne'] as const;
const round1 = (n?: number | null) => (n == null ? null : Math.round(n * 10) / 10);

/** Public view of a lot: no phone numbers, documents or exact address; location rounded to ~10 km. */
function publicLot(l: Row, viewer?: { lat?: number; lon?: number; user?: { id: string; role: string; verification_status?: string } }) {
  const farmer = q.get<Row>('SELECT full_name FROM users WHERE id = ?', l.farmer_id);
  const standing = farmerStanding(l.farmer_id);
  const photos = q.all<Row>(`SELECT id FROM documents WHERE subject_type = 'lot' AND subject_id = ? AND deleted_at IS NULL`, l.id).map((d) => d.id);
  const rate = getSetting('transport_rate_per_qtl_km');
  let transport: Row | null = null;
  if (viewer?.lat != null && viewer?.lon != null && l.latitude != null) {
    const km = roadKm(viewer.lat, viewer.lon, l.latitude, l.longitude);
    transport = { distance_km: km, estimate_per_qtl: rate ? Math.round(km * Number(rate)) : null,
      note: rate ? 'Platform default estimate; request quotes for actual cost.' : 'Request a transport quote for actual cost.' };
  }
  return {
    id: l.id, commodity: l.commodity, crop_id: l.crop_id, variety: l.variety, unit: l.unit,
    quantity_total: l.quantity_total, quantity_available: l.quantity_available, quantity_sold: l.quantity_sold,
    price_per_unit: l.price_per_unit, negotiable: !!l.negotiable, allow_partial: !!l.allow_partial, min_order_qty: l.min_order_qty,
    harvest_date: l.harvest_date, preferred_sale_date: l.preferred_sale_date,
    location: { village: l.pickup_village, district: l.district, state: l.state, approx_lat: round1(l.latitude), approx_lon: round1(l.longitude) },
    // Data provenance: these values are entered by the farmer; inspected grades are reported separately.
    quality: { grade: l.quality_grade, moisture_pct: l.moisture_pct, packaging: l.packaging, production_method: l.production_method, notes: l.quality_notes, source: 'farmer_reported' },
    inspection: latestGrade(l.id, viewer?.user),
    storage_required: !!l.storage_required, notes: l.notes, status: l.status, published_at: l.published_at, expires_at: l.expires_at,
    photos,
    seller: { first_name: (farmer?.full_name || '').split(' ')[0], level: standing?.level ?? 1, identity_verified: (standing?.level ?? 0) >= 3 },
    transport,
    fees: { platform_fee_buyer_pct: getSetting('platform_fee_buyer_pct') },
  };
}

// ---------------- Lots ----------------
const LotSchema = z.object({
  crop_id: z.string().optional().nullable(),
  commodity: z.string().trim().min(2).max(100),
  variety: zOptText(100),
  unit: z.enum(UNITS).default('quintal'),
  quantity_total: z.number().positive().max(1e7),
  price_per_unit: z.number().min(0).max(1e8).optional().nullable(),
  negotiable: z.boolean().default(true),
  allow_partial: z.boolean().default(true),
  min_order_qty: z.number().positive().max(1e7).optional().nullable(),
  harvest_date: zDate.optional().nullable(),
  preferred_sale_date: zDate.optional().nullable(),
  farm_id: z.string().optional().nullable(),
  pickup_village: zOptText(100), district: zOptText(80), state: zOptText(80),
  pincode: z.string().regex(/^\d{6}$/).optional().nullable().or(z.literal('').transform(() => null)),
  latitude: z.number().min(-90).max(90).optional().nullable(), longitude: z.number().min(-180).max(180).optional().nullable(),
  quality_grade: zOptText(50), moisture_pct: z.number().min(0).max(100).optional().nullable(),
  packaging: zOptText(200), production_method: z.enum(['conventional', 'organic_certified', 'natural_farming', 'other']).optional().nullable(),
  quality_notes: zOptText(1000), notes: zOptText(1000), storage_required: z.boolean().default(false),
});

marketplaceRouter.get('/lots', ah(async (req, res) => {
  const f = parse(z.object({
    commodity: z.string().max(100).optional(), crop_id: z.string().max(40).optional(), variety: z.string().max(100).optional(),
    state: z.string().max(80).optional(), district: z.string().max(80).optional(), grade: z.string().max(50).optional(),
    min_qty: z.coerce.number().min(0).optional(), price_min: z.coerce.number().min(0).optional(), price_max: z.coerce.number().min(0).optional(),
    harvest_before: zDate.optional(), partial: z.enum(['1']).optional(), verified: z.enum(['1']).optional(), storage: z.enum(['1']).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(), lon: z.coerce.number().min(-180).max(180).optional(), max_km: z.coerce.number().positive().max(2000).optional(),
    sort: z.enum(['newest', 'price', 'distance']).default('newest'),
    limit: z.coerce.number().int().min(1).max(100).default(30), offset: z.coerce.number().int().min(0).default(0),
  }), req.query);
  const where = [`l.status IN (${ACTIVE_LOT_STATUSES.map(() => '?').join(',')})`, 'l.quantity_available > 0', `(l.expires_at IS NULL OR l.expires_at > datetime('now'))`];
  const params: unknown[] = [...ACTIVE_LOT_STATUSES];
  const like = (col: string, v?: string) => { if (v) { where.push(`${col} LIKE ?`); params.push(`%${v}%`); } };
  like('l.commodity', f.commodity); like('l.variety', f.variety); like('l.district', f.district); like('l.quality_grade', f.grade);
  if (f.crop_id) { where.push('l.crop_id = ?'); params.push(f.crop_id); }
  if (f.state) { where.push('l.state = ?'); params.push(f.state); }
  if (f.min_qty) { where.push('l.quantity_available >= ?'); params.push(f.min_qty); }
  if (f.price_min != null) { where.push('l.price_per_unit >= ?'); params.push(f.price_min); }
  if (f.price_max != null) { where.push('l.price_per_unit <= ?'); params.push(f.price_max); }
  if (f.harvest_before) { where.push('(l.harvest_date IS NULL OR l.harvest_date <= ?)'); params.push(f.harvest_before); }
  if (f.partial) where.push('l.allow_partial = 1');
  if (f.storage) where.push('l.storage_required = 1');
  if (f.verified) where.push('u.farmer_level >= 3');
  if (req.user!.role === 'farmer') { where.push('l.farmer_id != ?'); params.push(req.user!.id); }
  const rows = q.all<Row>(`SELECT l.* FROM produce_lots l JOIN users u ON u.id = l.farmer_id WHERE ${where.join(' AND ')}
    ORDER BY ${f.sort === 'price' ? 'l.price_per_unit IS NULL, l.price_per_unit' : 'l.published_at DESC'} LIMIT 500`, ...params);
  let lots = rows.map((l) => publicLot(l, { lat: f.lat, lon: f.lon, user: req.user }));
  if (f.max_km && f.lat != null) lots = lots.filter((l) => l.transport && l.transport.distance_km <= f.max_km!);
  if (f.sort === 'distance' && f.lat != null) lots.sort((a, b) => (a.transport?.distance_km ?? 1e9) - (b.transport?.distance_km ?? 1e9));
  res.json({ lots: lots.slice(f.offset, f.offset + f.limit), total: lots.length });
}));

marketplaceRouter.get('/lots/mine', requireRole('farmer', 'fpo_manager'), ah(async (req, res) => {
  const lots = q.all<Row>('SELECT * FROM produce_lots WHERE farmer_id = ? ORDER BY updated_at DESC', req.user!.id);
  res.json({
    lots: lots.map((l) => ({
      ...publicLot(l, { user: req.user }), pending_offers: q.get<Row>(`SELECT COUNT(*) n FROM offers WHERE lot_id = ? AND status = 'pending'`, l.id)!.n,
      quantity_reserved: l.quantity_reserved, updated_at: l.updated_at, latitude: l.latitude, longitude: l.longitude, farm_id: l.farm_id, pincode: l.pincode,
    })),
    standing: farmerStanding(req.user!.id),
  });
}));

marketplaceRouter.get('/lots/:id', ah(async (req, res) => {
  const l = q.get<Row>('SELECT * FROM produce_lots WHERE id = ?', req.params.id);
  const isOwner = l?.farmer_id === req.user!.id;
  if (!l || (!isOwner && !ACTIVE_LOT_STATUSES.includes(l.status) && l.status !== 'sold')) throw notFound('Lot');
  const lat = req.query.lat ? Number(req.query.lat) : undefined;
  const lon = req.query.lon ? Number(req.query.lon) : undefined;
  res.json({
    lot: { ...publicLot(l, { lat, lon, user: req.user }), ...(isOwner ? { quantity_reserved: l.quantity_reserved, latitude: l.latitude, longitude: l.longitude, pincode: l.pincode, farm_id: l.farm_id, updated_at: l.updated_at } : {}) },
    is_owner: isOwner,
    my_thread: !isOwner ? q.get<Row>(`SELECT thread_id FROM offers WHERE lot_id = ? AND buyer_id = ? ORDER BY created_at DESC LIMIT 1`, l.id, req.user!.id)?.thread_id ?? null : null,
    buyer_standing: req.user!.role === 'buyer' ? buyerStanding(req.user!.id) : undefined,
  });
}));

function lotPublishChecks(userId: string) {
  const standing = farmerStanding(userId)!;
  if (!standing.transaction_eligible) {
    throw new HttpError(403, standing.restriction ? `Your account is restricted: ${standing.restriction.reason}` : 'Complete your profile (state, district, village) before publishing a lot.', 'not_eligible', { next_step: standing.next_step });
  }
  assertNotRestricted(userId, 'no_listings');
}

marketplaceRouter.post('/lots', requireRole('farmer', 'fpo_manager'), ah(async (req, res) => {
  const body = parse(LotSchema.extend({ publish: z.boolean().default(false) }), req.body);
  const { publish, ...data } = body;
  if (data.farm_id && !q.get('SELECT 1 FROM farms WHERE id = ? AND user_id = ?', data.farm_id, req.user!.id)) throw notFound('Farm');
  if (data.min_order_qty && data.min_order_qty > data.quantity_total) throw new HttpError(400, 'Minimum order cannot be more than the lot quantity', 'validation_error');
  if (publish) lotPublishChecks(req.user!.id);
  assertNotDuplicateLot(req.user!.id, data);
  // Fill location from the farm or profile when not given.
  const farm = data.farm_id ? q.get<Row>('SELECT * FROM farms WHERE id = ?', data.farm_id) : undefined;
  const u = q.get<Row>('SELECT state, district, village, latitude, longitude FROM users WHERE id = ?', req.user!.id)!;
  const lid = id();
  insert('produce_lots', {
    id: lid, farmer_id: req.user!.id, ...data,
    state: data.state ?? farm?.state ?? u.state, district: data.district ?? farm?.district ?? u.district,
    pickup_village: data.pickup_village ?? farm?.village ?? u.village,
    latitude: data.latitude ?? farm?.latitude ?? u.latitude, longitude: data.longitude ?? farm?.longitude ?? u.longitude,
    quantity_available: data.quantity_total, status: publish ? 'published' : 'draft',
    published_at: publish ? new Date().toISOString() : null,
    expires_at: publish ? new Date(Date.now() + Number(getSetting('lot_expiry_days')) * 86400_000).toISOString() : null,
  });
  checkListingBurst(req.user!.id);
  if (data.price_per_unit != null) {
    const crop = data.crop_id ? q.get<Row>('SELECT agmarknet_name FROM crops WHERE id = ?', data.crop_id) : undefined;
    checkPriceOutlier('lot', lid, req.user!.id, crop?.agmarknet_name, data.state ?? farm?.state ?? u.state, data.price_per_unit, data.unit);
  }
  audit(req, publish ? 'lot.publish' : 'lot.create', 'lot', lid);
  res.status(201).json({ lot: publicLot(q.get<Row>('SELECT * FROM produce_lots WHERE id = ?', lid)!) });
}));

function ownLot(userId: string, lotId: string) {
  const l = q.get<Row>('SELECT * FROM produce_lots WHERE id = ? AND farmer_id = ?', lotId, userId);
  if (!l) throw notFound('Lot');
  return l;
}

marketplaceRouter.patch('/lots/:id', requireRole('farmer', 'fpo_manager'), ah(async (req, res) => {
  const l = ownLot(req.user!.id, req.params.id);
  if (['sold', 'withdrawn', 'disputed'].includes(l.status)) throw new HttpError(409, 'This lot can no longer be edited', 'bad_state');
  const data = parse(LotSchema.partial(), req.body);
  const extra: Row = {};
  if (data.quantity_total != null && data.quantity_total !== l.quantity_total) {
    if (l.quantity_reserved > 0 || l.quantity_sold > 0) throw new HttpError(409, 'Quantity cannot change while part of the lot is reserved or sold', 'has_reservations');
    extra.quantity_available = data.quantity_total;
  }
  assertNotDuplicateLot(req.user!.id, { ...l, ...data } as { commodity: string; quantity_total: number }, l.id);
  const set = updateSet({ ...data, ...extra });
  if (!set.empty) q.run(`UPDATE produce_lots SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, l.id);
  audit(req, 'lot.update', 'lot', l.id, Object.keys(data));
  res.json({ lot: publicLot(q.get<Row>('SELECT * FROM produce_lots WHERE id = ?', l.id)!) });
}));

marketplaceRouter.post('/lots/:id/publish', requireRole('farmer', 'fpo_manager'), ah(async (req, res) => {
  const l = ownLot(req.user!.id, req.params.id);
  if (!['draft', 'expired', 'withdrawn'].includes(l.status)) throw new HttpError(409, 'Lot is already published', 'bad_state');
  if (l.quantity_available <= 0) throw new HttpError(409, 'Nothing left to sell in this lot', 'empty');
  lotPublishChecks(req.user!.id);
  q.run(`UPDATE produce_lots SET status = 'published', published_at = datetime('now'), expires_at = ?, updated_at = datetime('now') WHERE id = ?`,
    new Date(Date.now() + Number(getSetting('lot_expiry_days')) * 86400_000).toISOString(), l.id);
  refreshLotStatus(l.id);
  audit(req, 'lot.publish', 'lot', l.id);
  res.json({ ok: true });
}));

marketplaceRouter.post('/lots/:id/withdraw', requireRole('farmer', 'fpo_manager'), ah(async (req, res) => {
  const l = ownLot(req.user!.id, req.params.id);
  if (l.quantity_reserved > 0) throw new HttpError(409, 'Part of this lot is reserved in an order. Cancel or complete the order first.', 'has_reservations');
  q.tx(() => {
    q.run(`UPDATE produce_lots SET status = 'withdrawn', updated_at = datetime('now') WHERE id = ?`, l.id);
    q.run(`UPDATE offers SET status = 'withdrawn', responded_at = datetime('now') WHERE lot_id = ? AND status = 'pending'`, l.id);
  });
  audit(req, 'lot.withdraw', 'lot', l.id);
  res.json({ ok: true });
}));

marketplaceRouter.post('/lots/:id/photos', requireRole('farmer', 'fpo_manager'), docUpload.single('file'), ah(async (req, res) => {
  const l = ownLot(req.user!.id, req.params.id);
  if (q.get<Row>(`SELECT COUNT(*) n FROM documents WHERE subject_type = 'lot' AND subject_id = ? AND deleted_at IS NULL`, l.id)!.n >= 6) throw new HttpError(400, 'Up to 6 photos per lot', 'too_many');
  const doc = storeDocument(req, 'lot', l.id, 'photo', { imagesOnly: true });
  res.status(201).json({ document: doc });
}));

/** Import listings the farmer created in the old browser-only marketplace on this device, as drafts to review. */
marketplaceRouter.post('/lots/import-legacy', requireRole('farmer'), ah(async (req, res) => {
  const { items } = parse(z.object({ items: z.array(z.object({
    id: z.string().max(100), cropName: z.string().trim().min(2).max(100), quantity: z.number().positive().max(1e6),
    pricePerKg: z.number().min(0).max(1e6), negotiable: z.boolean().optional(),
  })).max(50) }), req.body);
  let created = 0;
  for (const it of items) {
    const marker = `legacy_browser:${it.id}`;
    if (q.get('SELECT 1 FROM produce_lots WHERE farmer_id = ? AND imported_from = ?', req.user!.id, marker)) continue;
    insert('produce_lots', {
      id: id(), farmer_id: req.user!.id, commodity: it.cropName, unit: 'kg', quantity_total: it.quantity, quantity_available: it.quantity,
      price_per_unit: it.pricePerKg, negotiable: it.negotiable ?? true, status: 'draft', imported_from: marker,
      notes: 'Imported from the earlier marketplace on this device. Please check every detail before publishing.',
    });
    created++;
  }
  audit(req, 'lot.import_legacy', 'user', req.user!.id, { created });
  res.json({ created });
}));

// ---------------- Buyer demand ----------------
const DemandSchema = z.object({
  crop_id: z.string().optional().nullable(), commodity: z.string().trim().min(2).max(100), variety: zOptText(100),
  quantity: z.number().positive().max(1e7), unit: z.enum(UNITS).default('quintal'),
  quality_spec: zOptText(1000), price_min: z.number().min(0).max(1e8).optional().nullable(), price_max: z.number().min(0).max(1e8).optional().nullable(),
  delivery_location: zOptText(300), district: zOptText(80), state: zOptText(80),
  latitude: z.number().min(-90).max(90).optional().nullable(), longitude: z.number().min(-180).max(180).optional().nullable(),
  delivery_date: zDate.optional().nullable(), packaging: zOptText(300),
  frequency: z.enum(['one_time', 'weekly', 'monthly', 'seasonal']).optional().nullable(),
  payment_terms: z.enum(['on_delivery', 'advance_and_balance', 'within_days']).optional().nullable(),
  allow_aggregation: z.boolean().default(true),
  expires_days: z.number().int().min(1).max(90).default(30),
});

export function assertBuyerCanTransact(userId: string) {
  const s = buyerStanding(userId);
  if (!s?.can_transact) {
    throw new HttpError(403, 'Only verified buyers can make offers or post requirements. Complete your business verification first.', 'buyer_not_verified', { status: s?.status, next_steps: s?.next_steps });
  }
  assertNotRestricted(userId, 'no_offers');
}

marketplaceRouter.get('/demand', ah(async (req, res) => {
  const { commodity, state } = req.query as Record<string, string | undefined>;
  const where = [`d.status IN ('open','partially_filled')`, `(d.expires_at IS NULL OR d.expires_at > datetime('now'))`];
  const params: unknown[] = [];
  if (commodity) { where.push('d.commodity LIKE ?'); params.push(`%${commodity}%`); }
  if (state) { where.push('(d.state IS NULL OR d.state = ?)'); params.push(state); }
  const rows = q.all<Row>(`SELECT d.*, b.business_name, b.buyer_type FROM demand_requests d JOIN buyer_profiles b ON b.user_id = d.buyer_id
    WHERE ${where.join(' AND ')} ORDER BY d.created_at DESC LIMIT 100`, ...params);
  res.json({ demand: rows.map((d) => ({ ...d, latitude: round1(d.latitude), longitude: round1(d.longitude), buyer_verified: true, remaining: Math.max(0, d.quantity - d.quantity_committed) })) });
}));

marketplaceRouter.get('/demand/mine', requireRole('buyer'), ah(async (req, res) => {
  const rows = q.all<Row>('SELECT * FROM demand_requests WHERE buyer_id = ? ORDER BY created_at DESC', req.user!.id);
  res.json({ demand: rows.map((d) => ({ ...d, responses: q.get<Row>(`SELECT COUNT(DISTINCT thread_id) n FROM offers WHERE demand_id = ?`, d.id)!.n })) });
}));

marketplaceRouter.get('/demand/:id', ah(async (req, res) => {
  const d = q.get<Row>('SELECT d.*, b.business_name, b.buyer_type FROM demand_requests d JOIN buyer_profiles b ON b.user_id = d.buyer_id WHERE d.id = ?', req.params.id);
  if (!d) throw notFound('Requirement');
  const isOwner = d.buyer_id === req.user!.id;
  res.json({
    demand: { ...d, remaining: Math.max(0, d.quantity - d.quantity_committed) },
    is_owner: isOwner,
    // Owner sees responding lots so they can compare and aggregate supply from several farmers.
    responses: isOwner ? q.all(`SELECT o.thread_id, o.status, o.quantity, o.unit, o.price_per_unit, o.created_at, l.commodity, l.variety, l.quality_grade, l.district, l.state
      FROM offers o JOIN produce_lots l ON l.id = o.lot_id WHERE o.demand_id = ? AND o.id IN (SELECT id FROM offers o2 WHERE o2.thread_id = o.thread_id ORDER BY created_at DESC LIMIT 1)
      ORDER BY o.price_per_unit`, d.id) : [],
  });
}));

marketplaceRouter.post('/demand', requireRole('buyer'), ah(async (req, res) => {
  assertBuyerCanTransact(req.user!.id);
  const { expires_days, ...data } = parse(DemandSchema, req.body);
  if (data.price_min != null && data.price_max != null && data.price_min > data.price_max) throw new HttpError(400, 'Minimum price cannot exceed maximum', 'validation_error');
  const did = id();
  insert('demand_requests', { id: did, buyer_id: req.user!.id, ...data, expires_at: new Date(Date.now() + expires_days * 86400_000).toISOString() });
  audit(req, 'demand.create', 'demand', did);
  res.status(201).json({ demand: q.get('SELECT * FROM demand_requests WHERE id = ?', did) });
}));

marketplaceRouter.post('/demand/:id/close', requireRole('buyer'), ah(async (req, res) => {
  const r = q.run(`UPDATE demand_requests SET status = 'closed', updated_at = datetime('now') WHERE id = ? AND buyer_id = ? AND status IN ('open','partially_filled')`, req.params.id, req.user!.id);
  if (!r.changes) throw notFound('Open requirement');
  q.run(`UPDATE offers SET status = 'withdrawn', responded_at = datetime('now') WHERE demand_id = ? AND status = 'pending'`, req.params.id);
  res.json({ ok: true });
}));

// ---------------- Price intelligence ----------------
marketplaceRouter.get('/prices', ah(async (req, res) => {
  const f = parse(z.object({ crop_id: z.string().max(40), state: z.string().max(80).optional(), district: z.string().max(80).optional() }), req.query);
  const crop = q.get<Row>('SELECT * FROM crops WHERE id = ?', f.crop_id);
  if (!crop) throw notFound('Crop');
  const mandi = q.all<Row>(`SELECT market, district, state, variety, min_price, max_price, modal_price, arrival_date, fetched_at FROM market_prices
    WHERE commodity = ? ${f.state ? 'AND state = ?' : ''} ORDER BY arrival_date DESC, CASE WHEN district = ? THEN 0 ELSE 1 END, modal_price DESC LIMIT 15`,
    ...(f.state ? [crop.agmarknet_name, f.state] : [crop.agmarknet_name]), f.district ?? '');
  const history = q.all<Row>(`SELECT arrival_date AS date, AVG(modal_price) AS modal FROM market_prices WHERE commodity = ? ${f.state ? 'AND state = ?' : ''}
    AND arrival_date >= date('now', '-90 day') AND modal_price IS NOT NULL GROUP BY arrival_date ORDER BY arrival_date`, ...(f.state ? [crop.agmarknet_name, f.state] : [crop.agmarknet_name]));
  const perQ = (rows: Row[], priceCol: string) => rows.filter((r) => r[priceCol] != null).map((r) => perQtl(r[priceCol], r.unit));
  const stats = (v: number[]) => (v.length ? { count: v.length, min: Math.min(...v), max: Math.max(...v), avg: Math.round(v.reduce((a, b) => a + b, 0) / v.length) } : { count: 0 });
  const asks = q.all<Row>(`SELECT price_per_unit, unit FROM produce_lots WHERE crop_id = ? AND status IN (${ACTIVE_LOT_STATUSES.map(() => '?').join(',')}) ${f.state ? 'AND state = ?' : ''}`,
    f.crop_id, ...ACTIVE_LOT_STATUSES, ...(f.state ? [f.state] : []));
  const bids = q.all<Row>(`SELECT price_max, unit FROM demand_requests WHERE crop_id = ? AND status IN ('open','partially_filled') ${f.state ? 'AND (state IS NULL OR state = ?)' : ''}`, f.crop_id, ...(f.state ? [f.state] : []));
  const done = q.all<Row>(`SELECT price_per_unit, unit FROM orders o JOIN produce_lots l ON l.id = o.lot_id WHERE l.crop_id = ? AND o.status = 'completed' AND o.completed_at > datetime('now', '-90 day')`, f.crop_id);
  res.json({
    crop: { id: crop.id, name: crop.name, agmarknet_name: crop.agmarknet_name },
    unit: 'INR per quintal',
    official_mandi: { source: 'Agmarknet (data.gov.in) – official arrival prices, not live', records: mandi, last_fetched: mandi[0]?.fetched_at ?? null },
    history,
    marketplace_asking: { source: 'FARMDirect farmers\' asking prices (not completed sales)', ...stats(perQ(asks, 'price_per_unit')) },
    buyer_bids: { source: 'Verified buyers\' maximum prices in open requirements', ...stats(perQ(bids, 'price_max')) },
    completed_sales: { source: 'Completed FARMDirect transactions, last 90 days', ...stats(perQ(done, 'price_per_unit')) },
  });
}));

/**
 * Compares realistic selling options for a lot by estimated NET realization
 * (revenue minus disclosed costs). Missing inputs are reported, never guessed.
 */
marketplaceRouter.get('/lots/:id/sell-options', requireRole('farmer', 'fpo_manager'), ah(async (req, res) => {
  const l = ownLot(req.user!.id, req.params.id);
  const { months } = parse(z.object({ months: z.coerce.number().int().min(1).max(6).default(2) }), req.query);
  const crop = l.crop_id ? q.get<Row>('SELECT * FROM crops WHERE id = ?', l.crop_id) : undefined;
  const qty = l.quantity_available;
  const qtyQtl = toQtl(qty, l.unit);
  const rate = getSetting('transport_rate_per_qtl_km') as number | null;
  const now = new Date().toISOString();
  const options: Row[] = [];
  const transportCost = (lat?: number | null, lon?: number | null) => {
    if (l.latitude == null || lat == null || lon == null) return { amount: null, km: null, basis: 'Distance unknown – add locations or request a quote' };
    const km = roadKm(l.latitude, l.longitude, lat, lon);
    return rate ? { amount: Math.round(km * rate * qtyQtl), km, basis: `Estimated ${km} km road distance × ₹${rate}/qtl/km (platform default rate)` }
      : { amount: null, km, basis: `${km} km estimated; no transport rate configured – request a quote` };
  };
  const net = (revenue: number, costs: { amount: number | null }[]) => (costs.some((c) => c.amount == null) ? null : Math.round(revenue - costs.reduce((s, c) => s + (c.amount ?? 0), 0)));

  // A. Best pending offer on this lot
  const offers = q.all<Row>(`SELECT * FROM offers WHERE lot_id = ? AND status = 'pending' AND created_by != ? AND expires_at > ? ORDER BY price_per_unit DESC LIMIT 3`, l.id, req.user!.id, now);
  for (const o of offers) {
    const b = breakdown(o.quantity, o.price_per_unit, JSON.parse(o.charges));
    options.push({
      key: `offer:${o.id}`, type: 'buyer_offer', title: `Buyer offer: ₹${o.price_per_unit}/${l.unit} for ${o.quantity} ${l.unit}`,
      revenue: b.product_value, costs: [{ label: 'Charges you pay (from offer) and platform fee', amount: Math.round((b.product_value - b.farmer_net) * 100) / 100, source: 'Offer terms' }],
      net_realization: b.farmer_net, quantity: o.quantity, data_time: o.created_at, certainty: 'Firm offer – binding once both sides confirm', thread_id: o.thread_id,
    });
  }
  // B. Matching buyer requirements (verified buyers)
  if (crop) {
    const demands = q.all<Row>(`SELECT * FROM demand_requests WHERE crop_id = ? AND status IN ('open','partially_filled') AND price_max IS NOT NULL AND (expires_at IS NULL OR expires_at > ?) ORDER BY price_max DESC LIMIT 3`, crop.id, now);
    for (const d of demands) {
      const sellQtl = Math.min(qtyQtl, toQtl(d.quantity - d.quantity_committed, d.unit));
      const revenue = Math.round(perQtl(d.price_max, d.unit) * sellQtl);
      const t = l.storage_required ? { amount: null, km: null, basis: '' } : transportCost(d.latitude, d.longitude);
      options.push({
        key: `demand:${d.id}`, type: 'buyer_requirement', title: `Buyer requirement in ${d.district || d.state || 'India'} (up to ₹${d.price_max}/${d.unit})`,
        revenue, costs: [{ label: 'Transport to buyer', amount: t.amount, source: t.basis }], net_realization: net(revenue, [t]),
        quantity_qtl: sellQtl, data_time: d.created_at, certainty: 'Buyer\'s maximum price – actual price is negotiated', demand_id: d.id,
      });
    }
    // C. Nearby mandis (official prices)
    const mandis = q.all<Row>(`SELECT market, district, state, modal_price, arrival_date FROM market_prices WHERE commodity = ? ${l.state ? 'AND state = ?' : ''}
      AND arrival_date >= date('now', '-14 day') AND modal_price IS NOT NULL ORDER BY arrival_date DESC, modal_price DESC LIMIT 3`, ...(l.state ? [crop.agmarknet_name, l.state] : [crop.agmarknet_name]));
    for (const m of mandis) {
      const revenue = Math.round(m.modal_price * qtyQtl);
      options.push({
        key: `mandi:${m.market}`, type: 'mandi', title: `Sell at ${m.market} mandi (modal ₹${m.modal_price}/qtl on ${m.arrival_date})`,
        revenue, costs: [{ label: 'Transport to mandi', amount: null, source: 'Mandi location not mapped – request a quote' }, { label: 'Mandi commission/market fee', amount: null, source: 'Varies by state and mandi – check locally' }],
        net_realization: null, gross_only: true, data_time: m.arrival_date, certainty: 'Past official price; today\'s price can differ',
      });
    }
  }
  // D. Store now, sell later – break-even, not a price prediction
  const best = options.filter((o) => o.net_realization != null).sort((a, b) => b.net_realization - a.net_realization)[0];
  const facility = l.latitude != null ? q.all<Row>(`SELECT * FROM storage_facilities WHERE status = 'verified'`)
    .map((f) => ({ f, km: roadKm(l.latitude, l.longitude, f.latitude, f.longitude) })).filter((x) => x.km <= 100).sort((a, b) => a.km - b.km)[0] : undefined;
  if (facility) {
    const start = new Date().toISOString().slice(0, 10);
    const end = new Date(Date.now() + months * 30 * 86400_000).toISOString().slice(0, 10);
    const est = storageEstimate(facility.f, crop?.category ?? null, qtyQtl, start, end);
    const avail = availability(facility.f.id, start, end);
    const spoilPct = (DEFAULT_SPOILAGE_PCT_PER_MONTH[crop?.category ?? 'other'] ?? 2) * months;
    const t = transportCost(facility.f.latitude, facility.f.longitude);
    const storageCost = est?.total ?? null;
    const sellableQtl = qtyQtl * (1 - spoilPct / 100);
    const baseline = best?.net_realization ?? null;
    const breakEven = baseline != null && storageCost != null && t.amount != null && sellableQtl > 0
      ? Math.round((baseline + storageCost + t.amount) / sellableQtl) : null;
    options.push({
      key: `store:${facility.f.id}`, type: 'store_and_sell_later', title: `Store at ${facility.f.name} (${facility.km} km) for ${months} month(s), then sell`,
      revenue: null, costs: [
        { label: 'Storage charges (rate card)', amount: storageCost, source: est ? est.note : 'Facility has no rate for this crop' },
        { label: 'Transport to storage', amount: t.amount, source: t.basis },
        { label: `Assumed quality/weight loss ${spoilPct.toFixed(1)}%`, amount: null, source: 'Assumption by crop category; actual loss depends on storage and handling' },
      ],
      net_realization: null, break_even_price_per_qtl: breakEven,
      available_capacity_qtl: avail?.available_qtl, facility_id: facility.f.id,
      certainty: breakEven ? `Worth considering only if you expect the price after ${months} month(s) to exceed ₹${breakEven}/qtl. Future prices are not guaranteed.` : 'Needs a firm current option and transport cost to compute a break-even price.',
    });
  }
  const ranked = options.filter((o) => o.net_realization != null).sort((a, b) => b.net_realization - a.net_realization);
  res.json({
    lot: { id: l.id, commodity: l.commodity, quantity: qty, unit: l.unit },
    options,
    recommendation: ranked.length ? `"${ranked[0].title}" has the highest estimated net realization based on the information available now.` : 'Not enough firm data to rank options. Compare the gross figures and request quotes.',
    disclaimer: 'Estimates only. Prices and costs change; nothing here guarantees a future price or profit. Unknown costs are shown as missing rather than guessed.',
    generated_at: now,
  });
}));

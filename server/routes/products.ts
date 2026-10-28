import { Router } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { q, out, insert, updateSet, type Row } from '../db/index.ts';
import { ah, HttpError, id, notFound, parse, zOptText, zText } from '../lib/http.ts';
import { requireRole } from '../lib/auth.ts';
import { audit, hmac, ipHash, rateLimit } from '../lib/security.ts';

export const productsRouter = Router();

const CATEGORIES = ['seeds', 'fertilizer', 'crop_protection', 'biological', 'soil_health', 'irrigation', 'machinery', 'tools', 'other'] as const;

const ProductSchema = z.object({
  name: zText(200), manufacturer: zText(200), category: z.enum(CATEGORIES),
  registration_no: zOptText(100), registered_uses: zOptText(3000), crop_ids: z.array(z.string()).default([]),
  label_info: zOptText(10000), safety: zOptText(5000), pack_sizes: zOptText(300),
  documentation_url: z.string().url().optional().nullable(), image_url: z.string().url().optional().nullable(),
  data_source: zText(300), // e.g. "Manufacturer-supplied label, verified 2026-10-01"
});

productsRouter.get('/', ah(async (req, res) => {
  const { category, crop, q: search } = req.query as Record<string, string | undefined>;
  const where = [`status = 'published'`];
  const params: unknown[] = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (crop) { where.push('crop_ids LIKE ?'); params.push(`%"${crop}"%`); }
  if (search) { where.push('(name LIKE ? OR manufacturer LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  res.json({
    products: q.all(`SELECT id, name, manufacturer, category, crop_ids, pack_sizes, image_url FROM products WHERE ${where.join(' AND ')} ORDER BY name LIMIT 200`, ...params).map(out),
    disclaimer: 'Listing a product is not a recommendation. Use only products registered for your crop and follow the label. Consult your local agriculture officer before use.',
  });
}));

productsRouter.get('/manage', requireRole('admin', 'content_editor'), ah(async (_req, res) => {
  res.json({ products: q.all('SELECT * FROM products ORDER BY updated_at DESC').map(out) });
}));

productsRouter.get('/:id', ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM products WHERE id = ?', req.params.id);
  if (!p || (p.status !== 'published' && !['admin', 'super_admin', 'content_editor'].includes(req.user!.role))) throw notFound('Product');
  const dealers = q.all(`SELECT sp.id, sp.name, sp.district, sp.state, sp.phone FROM product_dealers pd JOIN service_providers sp ON sp.id = pd.provider_id
    WHERE pd.product_id = ? AND sp.verification_status = 'verified'`, p.id);
  res.json({ product: out(p), dealers });
}));

productsRouter.post('/', requireRole('admin', 'content_editor'), ah(async (req, res) => {
  const d = parse(ProductSchema, req.body);
  const pid = id();
  insert('products', { id: pid, ...d, created_by: req.user!.id, status: 'draft' });
  audit(req, 'product.create', 'product', pid);
  res.status(201).json({ product: out(q.get('SELECT * FROM products WHERE id = ?', pid)) });
}));

productsRouter.patch('/:id', requireRole('admin', 'content_editor'), ah(async (req, res) => {
  const d = parse(ProductSchema.partial().extend({ status: z.enum(['draft', 'published', 'withdrawn']).optional() }), req.body);
  const set = updateSet(d);
  if (!set.empty) q.run(`UPDATE products SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, req.params.id);
  audit(req, 'product.update', 'product', req.params.id, { status: d.status });
  res.json({ product: out(q.get('SELECT * FROM products WHERE id = ?', req.params.id)) });
}));

productsRouter.post('/:id/dealers', requireRole('admin'), ah(async (req, res) => {
  const { provider_id } = parse(z.object({ provider_id: z.string() }), req.body);
  const p = q.get<Row>(`SELECT 1 FROM service_providers WHERE id = ? AND verification_status = 'verified'`, provider_id);
  if (!p) throw new HttpError(400, 'Only verified dealers can be linked', 'not_verified');
  q.run('INSERT OR IGNORE INTO product_dealers (product_id, provider_id) VALUES (?, ?)', req.params.id, provider_id);
  res.json({ ok: true });
}));

// ---------------- Authenticity verification ----------------
/**
 * Code format: FD-XXXXXXXXXXXXXXXX-CCCC where X is 16 random base32 chars and
 * CCCC is a truncated HMAC of X. The checksum lets us reject forged/guessed
 * codes without touching the database (anti-enumeration), and the database
 * stores only an HMAC of the full code. Codes are issued per manufacturer
 * batch by an administrator acting on manufacturer-supplied records.
 */
const B32 = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeCode() {
  const bytes = crypto.randomBytes(16);
  const body = Array.from(bytes, (b) => B32[b % 32]).join('');
  return `FD-${body}-${checksum(body)}`;
}
const checksum = (body: string) => hmac(`chk:${body}`).slice(0, 4).toUpperCase();

export function normaliseCode(raw: string) {
  const s = raw.trim().toUpperCase().replace(/\s/g, '');
  // Accept a full verification URL from a QR code as well as the bare code.
  const m = s.match(/FD-([A-Z2-9]{16})-([0-9A-F]{4})/);
  if (!m) return null;
  if (checksum(m[1]) !== m[2]) return null;
  return `FD-${m[1]}-${m[2]}`;
}

export const verifyRouter = Router();

verifyRouter.post('/',
  rateLimit({ name: 'verify-user', windowMs: 60 * 60_000, max: 30, key: (r) => r.user!.id }),
  rateLimit({ name: 'verify-ip', windowMs: 60 * 60_000, max: 60 }),
  ah(async (req, res) => {
    const { code } = parse(z.object({ code: z.string().min(4).max(500) }), req.body);
    const norm = normaliseCode(code);
    const log = (result: string, codeHash: string | null) =>
      q.run('INSERT INTO verification_attempts (user_id, ip_hash, code_hash, result) VALUES (?, ?, ?, ?)', req.user!.id, ipHash(req), codeHash, result);
    if (!norm) {
      log('invalid_format', null);
      return res.json({ result: 'invalid', message: 'This code was not issued through FARMDirect verification. It may be counterfeit, or the QR is from another system.' });
    }
    const h = hmac(`code:${norm}`);
    const row = q.get<Row>(
      `SELECT vc.*, vb.batch_no, vb.mfg_date, vb.expiry_date, vb.issuer_name, p.id AS product_id, p.name AS product_name, p.manufacturer, p.category, p.registration_no
       FROM verification_codes vc JOIN verification_batches vb ON vb.id = vc.batch_id JOIN products p ON p.id = vb.product_id WHERE vc.code_hash = ?`, h);
    if (!row) {
      log('not_found', h);
      return res.json({ result: 'invalid', message: 'This code is not in the manufacturer records. Do not use the product; report it below.' });
    }
    if (row.status === 'revoked') {
      log('revoked', h);
      return res.json({ result: 'manual_review', message: 'This code has been revoked by the issuer. Please report the product so it can be reviewed.' });
    }
    const product = {
      name: row.product_name, manufacturer: row.manufacturer, category: row.category, registration_no: row.registration_no,
      batch_no: row.batch_no, mfg_date: row.mfg_date, expiry_date: row.expiry_date, issuer: row.issuer_name,
    };
    q.run(`UPDATE verification_codes SET verify_count = verify_count + 1, first_verified_at = COALESCE(first_verified_at, datetime('now')) WHERE code_hash = ?`, h);
    if (row.verify_count > 0) {
      log('already_verified', h);
      return res.json({
        result: 'already_used', product, firstVerifiedAt: row.first_verified_at, count: row.verify_count + 1,
        message: 'This code was already verified before. If you did not scan it earlier, the packaging may have been copied. Report it below.',
      });
    }
    log('genuine', h);
    const expired = row.expiry_date && row.expiry_date < new Date().toISOString().slice(0, 10);
    res.json({ result: 'valid', product, expired: !!expired, message: expired ? 'Genuine code, but the batch is past its expiry date.' : 'Genuine: this code matches the manufacturer record and is being verified for the first time.' });
  }));

verifyRouter.post('/report', ah(async (req, res) => {
  const b = parse(z.object({ code_text: zOptText(500), product_name: zOptText(200), where_bought: zOptText(300), description: zText(2000) }), req.body);
  const rid = id();
  q.run('INSERT INTO suspicious_reports (id, user_id, code_text, product_name, where_bought, description) VALUES (?, ?, ?, ?, ?, ?)',
    rid, req.user!.id, b.code_text ?? null, b.product_name ?? null, b.where_bought ?? null, b.description);
  res.status(201).json({ id: rid });
}));

/** Issue a batch of codes for a published product. Raw codes are returned once and never stored. */
verifyRouter.post('/batches', requireRole('admin'), ah(async (req, res) => {
  const b = parse(z.object({
    product_id: z.string(), batch_no: zText(100), mfg_date: z.string().optional().nullable(), expiry_date: z.string().optional().nullable(),
    issuer_name: zText(200), count: z.number().int().min(1).max(5000),
  }), req.body);
  if (!q.get(`SELECT 1 FROM products WHERE id = ? AND status = 'published'`, b.product_id)) throw new HttpError(400, 'Product must be published first', 'bad_product');
  const bid = id();
  const codes: string[] = [];
  q.tx(() => {
    insert('verification_batches', { id: bid, product_id: b.product_id, batch_no: b.batch_no, mfg_date: b.mfg_date, expiry_date: b.expiry_date,
      issuer_name: b.issuer_name, issued_by: req.user!.id, code_count: b.count });
    for (let i = 0; i < b.count; i++) {
      const c = makeCode();
      codes.push(c);
      q.run('INSERT INTO verification_codes (code_hash, batch_id) VALUES (?, ?)', hmac(`code:${c}`), bid);
    }
  });
  audit(req, 'verification.batch_issue', 'batch', bid, { count: b.count });
  res.status(201).json({ batchId: bid, codes, note: 'Store these codes securely and print them as QR codes. They cannot be retrieved again.' });
}));

verifyRouter.post('/batches/:id/revoke', requireRole('admin'), ah(async (req, res) => {
  q.run(`UPDATE verification_codes SET status = 'revoked' WHERE batch_id = ?`, req.params.id);
  audit(req, 'verification.batch_revoke', 'batch', req.params.id);
  res.json({ ok: true });
}));

// ---------------- Service providers ----------------
export const providersRouter = Router();
const PROVIDER_CATS = ['agronomist', 'soil_lab', 'input_dealer', 'irrigation', 'equipment_rental', 'custom_hiring', 'drone', 'training', 'warehouse'] as const;

const ProviderSchema = z.object({
  name: zText(200), category: z.enum(PROVIDER_CATS), description: zOptText(2000),
  phone: z.string().regex(/^\+?\d[\d\s-]{7,15}$/).optional().nullable(), email: z.string().email().optional().nullable(),
  website: z.string().url().optional().nullable(), address: zOptText(500), state: zText(80), district: zText(80),
  pincode: z.string().regex(/^\d{6}$/).optional().nullable(), latitude: z.number().min(-90).max(90).optional().nullable(),
  longitude: z.number().min(-180).max(180).optional().nullable(), availability: zOptText(300), license_no: zOptText(100),
});

const haversine = (a: number, b: number, c: number, d: number) => {
  const r = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};

providersRouter.get('/', ah(async (req, res) => {
  const { category, state, district, lat, lon } = req.query as Record<string, string | undefined>;
  const where = [`verification_status = 'verified'`];
  const params: unknown[] = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (state) { where.push('state = ?'); params.push(state); }
  if (district) { where.push('district = ?'); params.push(district); }
  let rows = q.all<Row>(`SELECT id, name, category, description, phone, email, website, address, state, district, pincode, latitude, longitude, availability, verified_at
    FROM service_providers WHERE ${where.join(' AND ')} LIMIT 300`, ...params);
  if (lat && lon) {
    rows = rows.map((r) => ({ ...r, distance_km: r.latitude != null ? Math.round(haversine(+lat, +lon, r.latitude, r.longitude) * 10) / 10 : null }))
      .sort((a, b) => (a.distance_km ?? 1e9) - (b.distance_km ?? 1e9));
  }
  res.json({ providers: rows });
}));

providersRouter.get('/mine', ah(async (req, res) => {
  res.json({ providers: q.all('SELECT * FROM service_providers WHERE owner_id = ?', req.user!.id) });
}));

/** Provider onboarding: any signed-in user may apply; listing appears only after admin verification. */
providersRouter.post('/', ah(async (req, res) => {
  const d = parse(ProviderSchema, req.body);
  const pid = id();
  insert('service_providers', { id: pid, ...d, owner_id: req.user!.id, verification_status: 'pending' });
  audit(req, 'provider.apply', 'provider', pid);
  res.status(201).json({ provider: q.get('SELECT * FROM service_providers WHERE id = ?', pid) });
}));

providersRouter.patch('/:id', ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM service_providers WHERE id = ? AND owner_id = ?', req.params.id, req.user!.id);
  if (!p) throw notFound('Provider');
  const set = updateSet(parse(ProviderSchema.partial(), req.body));
  // Changes to a verified listing require re-verification.
  if (!set.empty) q.run(`UPDATE service_providers SET ${set.sql}, verification_status = 'pending', updated_at = datetime('now') WHERE id = ?`, ...set.values, p.id);
  res.json({ provider: q.get('SELECT * FROM service_providers WHERE id = ?', p.id) });
}));

providersRouter.post('/:id/contact', rateLimit({ name: 'contact', windowMs: 60 * 60_000, max: 10, key: (r) => r.user!.id }), ah(async (req, res) => {
  const b = parse(z.object({ message: zText(1000), share_phone: z.boolean().default(false) }), req.body);
  const p = q.get<Row>(`SELECT * FROM service_providers WHERE id = ? AND verification_status = 'verified'`, req.params.id);
  if (!p) throw notFound('Provider');
  q.run('INSERT INTO contact_requests (id, provider_id, user_id, message, share_phone) VALUES (?, ?, ?, ?, ?)', id(), p.id, req.user!.id, b.message, b.share_phone ? 1 : 0);
  res.status(201).json({ ok: true });
}));

providersRouter.get('/:id/requests', ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM service_providers WHERE id = ? AND owner_id = ?', req.params.id, req.user!.id);
  if (!p) throw notFound('Provider');
  res.json({
    requests: q.all(`SELECT cr.id, cr.message, cr.status, cr.created_at, u.full_name, CASE WHEN cr.share_phone = 1 THEN u.phone END AS phone
      FROM contact_requests cr JOIN users u ON u.id = cr.user_id WHERE cr.provider_id = ? ORDER BY cr.created_at DESC`, p.id),
  });
}));

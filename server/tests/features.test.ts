import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, signUp, signUpAs } from './helpers.ts';
import { q, insert } from '../db/index.ts';
import { id } from '../lib/http.ts';
import { suggestActions } from '../services/medha.ts';

const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4c80000000049454e44ae426082', 'hex');

async function farmerWithLot() {
  const f = await signUp('farmer');
  await f.agent.patch('/api/v1/me').send({ state: 'Telangana', district: 'Warangal', village: 'Hanamkonda', location_consent: true, latitude: 17.98, longitude: 79.6 });
  const r = await f.agent.post('/api/v1/marketplace/lots').send({ crop_id: 'paddy', commodity: 'Paddy', variety: `V${Math.random()}`, quantity_total: 10, unit: 'quintal', price_per_unit: 2000, quality_grade: 'A', publish: true });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  return { f, lot: r.body.lot };
}

/** A buyer marked verified directly (the full verification flow is covered in marketplace.test.ts). */
async function verifiedBuyer(extra: Record<string, unknown> = {}) {
  const b = await signUp('buyer', { password: '' });
  q.run(`INSERT INTO buyer_profiles (user_id, business_name, buyer_type, state, district, commodities, status, verified_at)
    VALUES (?, ?, 'trader', 'Telangana', 'Warangal', '["Paddy"]', ?, datetime('now'))
    ON CONFLICT(user_id) DO UPDATE SET business_name = excluded.business_name, commodities = excluded.commodities, status = excluded.status, verified_at = excluded.verified_at`,
    b.user.id, `Trader ${Math.random()}`, (extra.status as string) ?? 'verified');
  return b;
}

describe('Quality grading workflow', () => {
  it('lets only verified inspectors grade, blocks self-inspection, keeps versions and farmer-reported values separate', async () => {
    const { f, lot } = await farmerWithLot();
    const req = await f.agent.post('/api/v1/grading/requests').send({ lot_id: lot.id });
    expect(req.status).toBe(201);
    expect((await f.agent.post('/api/v1/grading/requests').send({ lot_id: lot.id })).status).toBe(409);

    // Another farmer cannot request grading on someone else's lot or see the request.
    const other = await signUp('farmer');
    expect((await other.agent.post('/api/v1/grading/requests').send({ lot_id: lot.id })).status).toBe(404);
    expect((await other.agent.get(`/api/v1/grading/requests/${req.body.request.id}`)).status).toBe(404);

    // Farmer cannot inspect; unverified field agent cannot inspect.
    expect((await f.agent.post(`/api/v1/grading/requests/${req.body.request.id}/assign`)).status).toBe(403);
    const unverified = await signUp('field_agent');
    expect((await unverified.agent.post(`/api/v1/grading/requests/${req.body.request.id}/assign`)).status).toBe(403);

    const inspector = await signUpAs('field_agent');
    const rid = req.body.request.id;
    expect((await inspector.agent.post(`/api/v1/grading/requests/${rid}/results`).send({ grade: 'A', reasons: 'x', measurements: { moisture_pct: 12 } })).status).toBe(403); // not assigned yet
    expect((await inspector.agent.post(`/api/v1/grading/requests/${rid}/assign`)).status).toBe(200);
    const second = await signUpAs('expert');
    expect((await second.agent.post(`/api/v1/grading/requests/${rid}/assign`)).status).toBe(409);

    // Measurements must belong to the crop's criteria.
    expect((await inspector.agent.post(`/api/v1/grading/requests/${rid}/results`).send({ grade: 'A', reasons: 'ok', measurements: { sugar_brix: 5 } })).status).toBe(400);
    const res1 = await inspector.agent.post(`/api/v1/grading/requests/${rid}/results`).send({ grade: 'B', reasons: 'Moisture above contract limit', measurements: { moisture_pct: 16, foreign_matter_pct: 1 }, sample_method: '3 bags' });
    expect(res1.status).toBe(201);
    expect(res1.body.version).toBe(1);
    expect((await inspector.agent.post(`/api/v1/grading/results/${res1.body.result_id}/photos`).attach('file', PNG, 'p.png')).status).toBe(201);

    // Lot detail: farmer-reported grade untouched, inspection shown separately.
    const own = (await f.agent.get(`/api/v1/marketplace/lots/${lot.id}`)).body.lot;
    expect(own.quality.grade).toBe('A');
    expect(own.quality.source).toBe('farmer_reported');
    expect(own.inspection.grade).toBe('B');
    expect(own.inspection.measurements.moisture_pct).toBe(16);
    expect(own.inspection.photos).toHaveLength(1);
    expect(own.inspection.note).toMatch(/Not an official government certification/);

    // Unverified buyer sees grade but not evidence; verified buyer sees evidence.
    const pending = await verifiedBuyer({ status: 'under_review' });
    const pv = (await pending.agent.get(`/api/v1/marketplace/lots/${lot.id}`)).body.lot;
    if (pv?.inspection) { expect(pv.inspection.measurements).toBeUndefined(); expect(pv.inspection.photos).toBeUndefined(); }
    const vb = await verifiedBuyer();
    const vv = (await vb.agent.get(`/api/v1/marketplace/lots/${lot.id}`)).body.lot;
    expect(vv.inspection.measurements.moisture_pct).toBe(16);

    // A random buyer without an order cannot request a review; the farmer can, and a correction becomes version 2.
    expect((await vb.agent.post(`/api/v1/grading/requests/${rid}/review`).send({ reason: 'disagree' })).status).toBe(404);
    expect((await f.agent.post(`/api/v1/grading/requests/${rid}/review`).send({ reason: 'Sample was from the wet bags only' })).status).toBe(200);
    const res2 = await inspector.agent.post(`/api/v1/grading/requests/${rid}/results`).send({ grade: 'A', reasons: 'Re-sampled across all bags', measurements: { moisture_pct: 13 } });
    expect(res2.body.version).toBe(2);
    const detail = (await f.agent.get(`/api/v1/grading/requests/${rid}`)).body;
    expect(detail.results.map((r: any) => r.grade)).toEqual(['B', 'A']);
    expect((await f.agent.get(`/api/v1/marketplace/lots/${lot.id}`)).body.lot.inspection.version).toBe(2);
  });

  it('prevents an inspector from grading their own produce', async () => {
    const agent = await signUpAs('field_agent');
    // Give the inspector a lot directly (field agents cannot list through the API).
    const lotId = id();
    insert('produce_lots', { id: lotId, farmer_id: agent.user.id, crop_id: 'paddy', commodity: 'Paddy', quantity_total: 5, quantity_available: 5, unit: 'quintal', status: 'published' });
    const rid = id();
    insert('grading_requests', { id: rid, lot_id: lotId, farmer_id: agent.user.id });
    expect((await agent.agent.post(`/api/v1/grading/requests/${rid}/assign`)).status).toBe(403);
  });
});

describe('Buyer directory and enquiries', () => {
  it('lists only verified active buyers without contact details and rate-limits enquiries', async () => {
    const vb = await verifiedBuyer();
    const pending = await verifiedBuyer({ status: 'under_review' });
    const { f, lot } = await farmerWithLot();
    const list = (await f.agent.get('/api/v1/businesses')).body.buyers;
    const ids = list.map((b: any) => b.user_id);
    expect(ids).toContain(vb.user.id);
    expect(ids).not.toContain(pending.user.id);
    const entry = list.find((b: any) => b.user_id === vb.user.id);
    expect(entry.phone).toBeUndefined();
    expect(entry.gstin).toBeUndefined();

    expect((await f.agent.post(`/api/v1/businesses/${pending.user.id}/enquiries`).send({ message: 'hi' })).status).toBe(404);
    const e = await f.agent.post(`/api/v1/businesses/${vb.user.id}/enquiries`).send({ message: 'I have 10 qtl paddy', lot_id: lot.id, share_phone: false });
    expect(e.status).toBe(201);
    let rec = (await vb.agent.get('/api/v1/businesses/enquiries')).body.received;
    expect(rec[0].phone).toBeNull();
    expect((await vb.agent.post(`/api/v1/businesses/enquiries/${rec[0].id}/reply`).send({ reply: 'Send photos' })).status).toBe(200);
    expect((await f.agent.get('/api/v1/businesses/enquiries')).body.sent[0].reply).toBe('Send photos');
    // Someone else cannot reply to that enquiry.
    expect((await f.agent.post(`/api/v1/businesses/enquiries/${rec[0].id}/reply`).send({ reply: 'x' })).status).toBe(404);

    await f.agent.post(`/api/v1/businesses/${vb.user.id}/enquiries`).send({ message: 'call me', share_phone: true });
    rec = (await vb.agent.get('/api/v1/businesses/enquiries')).body.received;
    expect(rec.find((r: any) => r.message === 'call me').phone).toContain(f.phone);
    for (let i = 0; i < 10; i++) expect((await f.agent.post(`/api/v1/businesses/${vb.user.id}/enquiries`).set('x-test-rate-limit', '1').send({ message: `m${i}` })).status).toBe(201);
    expect((await f.agent.post(`/api/v1/businesses/${vb.user.id}/enquiries`).set('x-test-rate-limit', '1').send({ message: 'one too many' })).status).toBe(429);
  });
});

describe('Farm input orders', () => {
  it('requires verified dealers and published products, reserves stock atomically and returns it on cancel', async () => {
    const pid = id();
    insert('products', { id: pid, name: 'Test Seed', manufacturer: 'Seed Co', category: 'seeds', data_source: 'test', status: 'published' });
    const draft = id();
    insert('products', { id: draft, name: 'Draft Seed', manufacturer: 'Seed Co', category: 'seeds', data_source: 'test', status: 'draft' });

    const unverified = await signUp('dealer');
    const body = { product_id: pid, pack_size: '1 kg', price_inr: 450, stock: 3, state: 'Telangana', district: 'Warangal' };
    expect((await unverified.agent.post('/api/v1/inputs/offers').send(body)).status).toBe(403);
    const dealer = await signUpAs('dealer');
    expect((await dealer.agent.post('/api/v1/inputs/offers').send({ ...body, product_id: draft })).status).toBe(400);
    const off = await dealer.agent.post('/api/v1/inputs/offers').send(body);
    expect(off.status).toBe(201);
    const offerId = off.body.offer.id;

    const f1 = await signUp('farmer');
    const f2 = await signUp('farmer');
    expect((await f1.agent.post('/api/v1/inputs/orders').send({ offer_id: offerId, quantity: 1 })).status).toBe(400); // explicit confirmation required
    expect((await f1.agent.post('/api/v1/inputs/orders').send({ offer_id: offerId, quantity: 1, fulfilment: 'delivery', confirm: true })).status).toBe(400); // pickup only

    // Two farmers race for the last units: only one succeeds.
    const [a, b] = await Promise.all([
      f1.agent.post('/api/v1/inputs/orders').send({ offer_id: offerId, quantity: 2, confirm: true }),
      f2.agent.post('/api/v1/inputs/orders').send({ offer_id: offerId, quantity: 2, confirm: true }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect(q.get<any>('SELECT stock FROM input_offers WHERE id = ?', offerId).stock).toBe(1);
    const winner = a.status === 201 ? { s: f1, o: a.body.order } : { s: f2, o: b.body.order };
    expect(winner.o.total).toBe(900);

    // Farmers cannot change dealer status; dealer confirms which creates a payment requirement (not a payment).
    expect((await winner.s.agent.post(`/api/v1/inputs/orders/${winner.o.id}/status`).send({ status: 'confirmed' })).status).toBe(403);
    expect((await dealer.agent.post(`/api/v1/inputs/orders/${winner.o.id}/status`).send({ status: 'fulfilled' })).status).toBe(409);
    expect((await dealer.agent.post(`/api/v1/inputs/orders/${winner.o.id}/status`).send({ status: 'confirmed' })).status).toBe(200);
    const pay = q.get<any>('SELECT * FROM payment_records WHERE input_order_id = ?', winner.o.id);
    expect(pay.status).toBe('required');
    expect(pay.amount).toBe(900);

    expect((await winner.s.agent.post(`/api/v1/inputs/orders/${winner.o.id}/cancel`)).status).toBe(200);
    expect(q.get<any>('SELECT stock FROM input_offers WHERE id = ?', offerId).stock).toBe(3);
    expect(q.get<any>('SELECT status FROM payment_records WHERE id = ?', pay.id).status).toBe('failed');
  });
});

describe('Official statistics, field guides and e-crop boundary', () => {
  it('imports statistics only with source and valid units, by authorised staff', async () => {
    const f = await signUp('farmer');
    const empty = (await f.agent.get('/api/v1/statistics')).body;
    expect(Array.isArray(empty.rows)).toBe(true);
    const payload = {
      source_name: 'Area, production and yield – test publication', source_url: 'https://example.gov.in/apy.pdf', publication_date: '2026-01-15', data_status: 'advance_estimate',
      rows: [{ crop: 'Rice', state: 'Telangana', year: '2024-25', metric: 'production', value: 1500, unit: 'thousand tonne' }],
    };
    expect((await f.agent.post('/api/v1/statistics/import').send(payload)).status).toBe(403);
    const admin = await signUpAs('admin');
    expect((await admin.agent.post('/api/v1/statistics/import').send({ ...payload, rows: [{ ...payload.rows[0], unit: 'bags' }] })).status).toBe(400);
    expect((await admin.agent.post('/api/v1/statistics/import').send({ ...payload, source_url: 'http://insecure.example' })).status).toBe(400);
    const { source_name: _omit, ...noSource } = payload;
    expect((await admin.agent.post('/api/v1/statistics/import').send(noSource)).status).toBe(400);
    const ok = await admin.agent.post('/api/v1/statistics/import').send(payload);
    expect(ok.status).toBe(201);
    const rows = (await f.agent.get('/api/v1/statistics?crop=Rice')).body.rows;
    expect(rows[0]).toMatchObject({ value: 1500, unit: 'thousand tonne', data_status: 'advance_estimate', source_url: payload.source_url });
    expect(rows[0].retrieved_at).toBeTruthy();
  });

  it('serves seeded text-only guides marked for review and restricts editing', async () => {
    const f = await signUp('farmer');
    const g = (await f.agent.get('/api/v1/guides?category=pest')).body.guides;
    expect(g.length).toBeGreaterThan(0);
    expect(g.every((x: any) => x.review_status === 'needs_review' && !x.image_url)).toBe(true);
    expect((await f.agent.post('/api/v1/guides').send({ category: 'pest', name: 'X', symptoms: 'y', management: 'z' })).status).toBe(403);
    const editor = await signUpAs('content_editor');
    expect((await editor.agent.post('/api/v1/guides').send({ category: 'pest', name: 'Image guide', symptoms: 'y', management: 'z', image_url: 'https://example.org/a.jpg' })).status).toBe(400); // licence needed
    const created = await editor.agent.post('/api/v1/guides').send({ category: 'pest', name: 'Stem borer test', symptoms: 'Dead hearts', management: 'Remove egg masses', crops: ['paddy'] });
    expect(created.status).toBe(201);
    expect((await editor.agent.patch(`/api/v1/guides/${created.body.guide.id}`).send({ review_status: 'approved' })).status).toBe(403);
    const expert = await signUpAs('expert');
    expect((await expert.agent.patch(`/api/v1/guides/${created.body.guide.id}`).send({ review_status: 'approved' })).status).toBe(200);
  });

  it('reports government e-crop records as not connected instead of inventing data', async () => {
    const f = await signUp('farmer');
    const s = (await f.agent.get('/api/v1/ecrop/status')).body;
    expect(s.available).toBe(false);
    expect(s.requirements.length).toBeGreaterThan(0);
    const r = await f.agent.post('/api/v1/ecrop/fetch');
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('not_configured');
    expect((await request(app).get('/api/v1/ecrop/status')).status).toBe(401);
  });
});

describe('Medha AI', () => {
  it('suggests only navigation to relevant screens, respecting role', () => {
    expect(suggestActions('Will it rain this week?', 'farmer').map((a) => a.to)).toContain('/weather');
    expect(suggestActions('Where can I store my onions in cold storage?', 'farmer').map((a) => a.to)).toContain('/storage');
    const sell = suggestActions('I want to sell my harvest', 'farmer').map((a) => a.to);
    expect(sell).toContain('/sell/new');
    expect(suggestActions('I want to sell my harvest', 'buyer').map((a) => a.to)).not.toContain('/sell/new');
    expect(suggestActions('బియ్యం ధర ఎంత?', 'farmer').map((a) => a.to)).toContain('/mandi');
    expect(suggestActions('hello', 'farmer')).toEqual([]);
    for (const a of suggestActions('price storage weather pest scheme sell offer', 'farmer')) expect(a.to.startsWith('/')).toBe(true);
    expect(suggestActions('price storage weather pest scheme sell offer grade', 'farmer').length).toBeLessThanOrEqual(4);
  });

  it('returns a clear configuration error with navigation suggestions when Gemini is not configured', async () => {
    const f = await signUp('farmer');
    const st = (await f.agent.get('/api/v1/assistant/status')).body;
    if (st.configured) return; // only meaningful without a key
    expect(st.setup).toMatch(/GEMINI_API_KEY/);
    const r = await f.agent.post('/api/v1/assistant/messages').send({ message: 'Will it rain tomorrow?' });
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('not_configured');
    expect(r.body.details.actions.map((a: any) => a.to)).toContain('/weather');
  });

  it('reports platform fees only to authorised staff', async () => {
    const f = await signUp('farmer');
    expect((await f.agent.get('/api/v1/ops/revenue')).status).toBe(403);
    const admin = await signUpAs('admin');
    const r = await admin.agent.get('/api/v1/ops/revenue');
    expect(r.status).toBe(200);
    expect(r.body.current_rates).toHaveProperty('buyer_pct');
  });
});

describe('Demo mode data', () => {
  it('loads demo accounts and listings once, and the demo logins work', async () => {
    const { seedDemo, DEMO_ACCOUNTS } = await import('../db/demo.ts');
    seedDemo();
    seedDemo(); // safe to run on every start
    for (const a of DEMO_ACCOUNTS) expect(q.get<any>('SELECT COUNT(*) n FROM users WHERE phone = ?', a.phone).n).toBe(1);
    const farmerId = q.get<any>('SELECT id FROM users WHERE phone = ?', '+919000000001').id;
    expect(q.get<any>(`SELECT COUNT(*) n FROM produce_lots WHERE farmer_id = ? AND status = 'published'`, farmerId).n).toBe(2);
    const login = await request(app).post('/api/auth/login').send({ phone: '9000000001', password: 'devfarmer123' });
    expect(login.status).toBe(200);
    expect(login.body.user.role).toBe('farmer');
    const buyerLogin = request.agent(app);
    expect((await buyerLogin.post('/api/auth/login').send({ phone: '9000000031', password: 'devbuyer123' })).status).toBe(200);
    expect((await buyerLogin.get('/api/v1/buyer/profile')).body.standing.can_transact).toBe(true);
  });
});

describe('Aadhaar QR auto-fill', () => {
  it('reads name and address from a Secure QR without returning the Aadhaar number', async () => {
    const { buildTestSecureQr } = await import('../services/aadhaarQr.ts');
    const qr = buildTestSecureQr({ indicator: '3', reference: '123420190101120000123', name: 'Ravi Kumar', dob: '01-01-1985', gender: 'M', care_of: 'S/O Ramaiah', district: 'Warangal', house: '4-12', location: 'Hanamkonda', pincode: '506001', state: 'Telangana', subdistrict: 'Hanamkonda', vtc: 'Kazipet' });
    const r = await request(app).post('/api/auth/aadhaar-qr').send({ qr });
    expect(r.status).toBe(200);
    expect(r.body.details).toMatchObject({ format: 'secure_qr', name: 'Ravi Kumar', last4: '1234', village: 'Kazipet', subdistrict: 'Hanamkonda', district: 'Warangal', state: 'Telangana', pincode: '506001', signature: 'not_checked' });
    expect(JSON.stringify(r.body)).not.toMatch(/\d{12}/);
  });

  it('checks the UIDAI signature when a key is configured, rejects altered QRs and raises a farmer identity level', async () => {
    const crypto = await import('node:crypto');
    const { buildTestSecureQr, resetUidaiCertCache } = await import('../services/aadhaarQr.ts');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    process.env.UIDAI_QR_CERT = publicKey.export({ type: 'spki', format: 'pem' }).toString();
    resetUidaiCertCache();
    try {
      const fields = { indicator: '0', reference: '987620200101120000123', name: 'Sita Devi', dob: '1990', gender: 'F', district: 'Guntur', pincode: '522001', state: 'Andhra Pradesh', vtc: 'Tenali' };
      const signed = buildTestSecureQr(fields, (b) => crypto.sign('sha256', b, privateKey));
      const f = await signUp('farmer');
      const ok = await f.agent.post('/api/auth/aadhaar-qr').send({ qr: signed });
      expect(ok.status).toBe(200);
      expect(ok.body.details.signature).toBe('verified');
      expect(ok.body.identity_updated).toBe(true);
      expect(q.get<any>('SELECT farmer_level FROM users WHERE id = ?', f.user.id).farmer_level).toBe(3);
      // Signed by someone else → refused.
      const forged = buildTestSecureQr(fields, () => crypto.randomBytes(256));
      const bad = await request(app).post('/api/auth/aadhaar-qr').send({ qr: forged });
      expect(bad.status).toBe(400);
      expect(bad.body.code).toBe('aadhaar_signature_invalid');
    } finally { delete process.env.UIDAI_QR_CERT; resetUidaiCertCache(); }
  });

  it('handles old unsigned QRs, rejects other QR codes, and stores nothing', async () => {
    const before = q.get<any>('SELECT COUNT(*) n FROM users').n;
    const old = await request(app).post('/api/auth/aadhaar-qr').send({ qr: '<?xml version="1.0"?><PrintLetterBarcodeData uid="123456789012" name="Old Card" gender="M" yob="1970" vtc="Nalgonda" dist="Nalgonda" state="Telangana" pc="508001"/>' });
    expect(old.status).toBe(200);
    expect(old.body.details).toMatchObject({ format: 'old_qr', name: 'Old Card', last4: '9012', signature: 'not_checked' });
    expect(JSON.stringify(old.body)).not.toContain('123456789012');
    expect((await request(app).post('/api/auth/aadhaar-qr').send({ qr: 'https://example.com/some-product-qr' })).status).toBe(400);
    expect((await request(app).post('/api/auth/aadhaar-qr').send({ qr: '9'.repeat(400) })).status).toBe(400);
    expect(q.get<any>('SELECT COUNT(*) n FROM users').n).toBe(before);
  });
});

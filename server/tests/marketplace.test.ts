import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import request from 'supertest';
import { app, signUp, signUpAs } from './helpers.ts';
import { q, insert } from '../db/index.ts';
import { config } from '../config.ts';
import { hashPassword } from '../lib/security.ts';
import { id } from '../lib/http.ts';
import { marketplaceExpiry } from '../jobs.ts';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const day = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

async function farmer() {
  const s = await signUp('farmer');
  await s.agent.patch('/api/v1/me').send({ state: 'Telangana', district: 'Warangal', village: 'Hanamkonda', location_consent: true, latitude: 17.98, longitude: 79.6 });
  return s;
}

async function verifiedBuyer(officer?: any) {
  const b = await signUp('buyer', { password: '' });
  await b.agent.patch('/api/v1/buyer/profile').send({ business_name: `Trader ${Math.random()}`, address: 'Market Yard', state: 'Telangana', district: 'Warangal', registration_type: 'individual', buyer_type: 'trader', max_qty: 50 });
  await b.agent.post('/api/v1/buyer/documents').field('doc_type', 'representative_authorisation').attach('file', PDF, 'id.pdf');
  await b.agent.post('/api/v1/buyer/accept-terms');
  const sub = await b.agent.post('/api/v1/buyer/submit');
  const off = officer ?? (await signUpAs('verification_officer'));
  await off.agent.post(`/api/v1/ops/verifications/${sub.body.applicationId}/decision`).send({ decision: 'approve' });
  return b;
}

async function publishedLot(f: any, qty = 10, price = 2000, extra: Record<string, unknown> = {}) {
  const r = await f.agent.post('/api/v1/marketplace/lots').send({ crop_id: 'paddy', commodity: 'Paddy', variety: `V${Math.random()}`, quantity_total: qty, unit: 'quintal', price_per_unit: price, publish: true, ...extra });
  if (r.status !== 201) throw new Error(JSON.stringify(r.body));
  return r.body.lot;
}

const offerBody = (qty: number, price: number, extra: Record<string, unknown> = {}) => ({ quantity: qty, price_per_unit: price, delivery_mode: 'buyer_pickup', payment_terms: 'on_delivery', charges: [], ...extra });

async function stepUp(agent: any) {
  const r = await agent.post('/api/auth/step-up/request');
  await agent.post('/api/auth/step-up/verify').send({ otp: r.body.devCode });
}

describe('Workflow C – buyer onboarding and verification', () => {
  it('moves from mobile verified to verified only after review, with conditional documents', async () => {
    const b = await signUp('buyer', { password: '' });
    expect(b.user.role).toBe('buyer');
    expect(b.user.has_password).toBe(false);
    let p = (await b.agent.get('/api/v1/buyer/profile')).body;
    expect(p.standing.status).toBe('mobile_verified');
    expect(p.standing.can_transact).toBe(false);

    // Processor company needs GSTIN, PAN, FSSAI and a registration certificate.
    expect((await b.agent.patch('/api/v1/buyer/profile').send({ gstin: 'BADGSTIN' })).status).toBe(400);
    await b.agent.patch('/api/v1/buyer/profile').send({ buyer_type: 'processor', registration_type: 'company', business_name: 'Agro Foods', address: 'Plot 1', state: 'Telangana', district: 'Warangal' });
    p = (await b.agent.get('/api/v1/buyer/profile')).body;
    const fields = p.standing.required_documents.map((d: any) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['pan', 'gstin', 'fssai', 'doc:registration_certificate', 'doc:representative_authorisation']));
    expect(p.standing.ready_to_submit).toBe(false);
    expect((await b.agent.post('/api/v1/buyer/submit')).status).toBe(400);

    await b.agent.patch('/api/v1/buyer/profile').send({ gstin: '36ABCDE1234F1Z5', pan: 'ABCDE1234F', fssai: '12345678901234' });
    expect((await b.agent.post('/api/v1/buyer/documents').field('doc_type', 'registration_certificate').attach('file', Buffer.from('not a document'), 'x.pdf')).status).toBe(400);
    await b.agent.post('/api/v1/buyer/documents').field('doc_type', 'registration_certificate').attach('file', PDF, 'reg.pdf');
    await b.agent.post('/api/v1/buyer/documents').field('doc_type', 'representative_authorisation').attach('file', PDF, 'auth.pdf');
    await b.agent.post('/api/v1/buyer/accept-terms');
    const sub = await b.agent.post('/api/v1/buyer/submit');
    expect(sub.status).toBe(201);
    expect(sub.body.standing.status).toBe('under_review');
    // Masked identifiers in the API, never the raw value.
    p = (await b.agent.get('/api/v1/buyer/profile')).body;
    expect(p.profile.gstin).toBeUndefined();
    expect(p.profile.gstin_masked).toMatch(/1Z5$/);
    expect((await b.agent.patch('/api/v1/buyer/profile').send({ business_name: 'Other' })).status).toBe(409);

    const officer = await signUpAs('verification_officer');
    const queue = (await officer.agent.get('/api/v1/ops/verifications')).body.applications;
    const app = queue.find((a: any) => a.id === sub.body.applicationId);
    expect(app.checks.some((c: any) => c.check.includes('PAN matches') && c.result === 'pass')).toBe(true);
    expect((await officer.agent.post(`/api/v1/ops/verifications/${app.id}/decision`).send({ decision: 'reject' })).status).toBe(400); // reason required
    await officer.agent.post(`/api/v1/ops/verifications/${app.id}/decision`).send({ decision: 'approve' });
    p = (await b.agent.get('/api/v1/buyer/profile')).body;
    expect(p.standing.status).toBe('verified');
    expect(p.standing.can_transact).toBe(true);
    expect(q.get<any>(`SELECT COUNT(*) n FROM audit_logs WHERE action = 'verification.approve' AND target_id = ?`, app.id).n).toBe(1);
    expect(q.get<any>(`SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND kind = 'system'`, b.user.id).n).toBeGreaterThan(0);
  });
});

describe('Workflow A – farmer sells produce', () => {
  it('runs listing → offer → counter → accept → confirm → deliver → pay → complete', async () => {
    const f0 = await signUp('farmer');
    // Level 1 (profile incomplete) can save a draft but cannot publish.
    expect((await f0.agent.post('/api/v1/marketplace/lots').send({ commodity: 'Paddy', quantity_total: 5, publish: true })).status).toBe(403);
    expect((await f0.agent.post('/api/v1/marketplace/lots').send({ commodity: 'Paddy', quantity_total: 5 })).status).toBe(201);

    const f = await farmer();
    const lot = await publishedLot(f, 10, 2000);
    expect((await f.agent.post('/api/v1/marketplace/lots').send({ crop_id: 'paddy', commodity: 'Paddy', variety: lot.variety, quantity_total: 10, unit: 'quintal', price_per_unit: 2000 })).status).toBe(409);

    // Workflow D: unverified buyer is refused with next steps.
    const unverified = await signUp('buyer', { password: '' });
    const denied = await unverified.agent.post('/api/v1/offers').send({ lot_id: lot.id, ...offerBody(6, 1900) });
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('buyer_not_verified');
    expect(denied.body.details.next_steps.length).toBeGreaterThan(0);

    const buyer = await verifiedBuyer();
    const browse = (await buyer.agent.get('/api/v1/marketplace/lots?crop_id=paddy&lat=17.9&lon=79.5')).body.lots.find((l: any) => l.id === lot.id);
    expect(browse.seller.first_name).toBeTruthy();
    expect(JSON.stringify(browse)).not.toContain(f.phone.slice(-10));
    expect(browse.transport.distance_km).toBeGreaterThan(0);

    const o1 = await buyer.agent.post('/api/v1/offers').send({ lot_id: lot.id, ...offerBody(6, 1900) });
    expect(o1.status).toBe(201);
    expect((await buyer.agent.post('/api/v1/offers').send({ lot_id: lot.id, ...offerBody(2, 1900) })).body.code).toBe('open_thread');
    expect((await buyer.agent.post(`/api/v1/offers/${o1.body.offer.id}/respond`).send({ action: 'accept', confirm: true })).status).toBe(403); // own offer
    const counter = await f.agent.post(`/api/v1/offers/${o1.body.offer.id}/respond`).send({ action: 'counter', counter: offerBody(6, 2200) });
    expect(counter.status).toBe(201);
    const thread = (await buyer.agent.get(`/api/v1/offers/threads/${o1.body.offer.thread_id}`)).body;
    expect(thread.offers.map((o: any) => o.status)).toEqual(['countered', 'pending']);
    expect(thread.can_respond).toBe(true);
    expect((await buyer.agent.post(`/api/v1/offers/${counter.body.offer.id}/respond`).send({ action: 'accept' })).body.code).toBe('confirmation_required');
    const acc = await buyer.agent.post(`/api/v1/offers/${counter.body.offer.id}/respond`).send({ action: 'accept', confirm: true });
    expect(acc.status).toBe(201);
    const orderId = acc.body.orderId;
    let l = q.get<any>('SELECT * FROM produce_lots WHERE id = ?', lot.id);
    expect([l.quantity_available, l.quantity_reserved, l.status]).toEqual([4, 6, 'published']);

    let order = (await buyer.agent.get(`/api/v1/orders/${orderId}`)).body;
    expect(order.order.breakdown.product_value).toBe(13200);
    expect(order.farmer.phone).toBeNull(); // hidden until confirmed
    await f.agent.post(`/api/v1/orders/${orderId}/confirm`);
    await buyer.agent.post(`/api/v1/orders/${orderId}/confirm`);
    order = (await buyer.agent.get(`/api/v1/orders/${orderId}`)).body;
    expect(order.order.status).toBe('confirmed');
    expect(order.farmer.phone).toBe(f.user.phone);
    expect(order.payments).toHaveLength(1);

    // Confirmed terms change only through an approved amendment.
    const am = await buyer.agent.post(`/api/v1/orders/${orderId}/amendments`).send({ changes: { price_per_unit: 2100 }, reason: 'Agreed on call after quality check' });
    expect((await buyer.agent.post(`/api/v1/orders/${orderId}/amendments/${am.body.id}/decide`).send({ decision: 'approve' })).status).toBe(403);
    await f.agent.post(`/api/v1/orders/${orderId}/amendments/${am.body.id}/decide`).send({ decision: 'approve' });
    expect(q.get<any>('SELECT buyer_payable FROM orders WHERE id = ?', orderId).buyer_payable).toBe(12600);

    await f.agent.post(`/api/v1/orders/${orderId}/progress`).send({ status: 'in_transit' });
    expect((await f.agent.post(`/api/v1/orders/${orderId}/deliver`).send({ received_quantity: 5, inspection_status: 'accepted' })).status).toBe(403);
    const del = await buyer.agent.post(`/api/v1/orders/${orderId}/deliver`).send({ received_quantity: 5, inspection_status: 'partially_accepted', inspection_notes: '1 qtl wet' });
    expect(del.body.order.final_settlement).toBe(10500);
    l = q.get<any>('SELECT * FROM produce_lots WHERE id = ?', lot.id);
    expect([l.quantity_available, l.quantity_reserved, l.quantity_sold, l.status]).toEqual([5, 0, 5, 'partially_sold']);

    expect((await f.agent.post(`/api/v1/orders/${orderId}/complete`)).body.code).toBe('payments_open');
    const pay = q.get<any>('SELECT * FROM payment_records WHERE order_id = ?', orderId);
    expect(pay.amount).toBe(10500);
    await buyer.agent.post(`/api/v1/payments/${pay.id}/mark-paid`).send({ method_note: 'upi', reference: 'UTR123' });
    expect(q.get<any>('SELECT status FROM payment_records WHERE id = ?', pay.id).status).toBe('pending');
    expect((await buyer.agent.post(`/api/v1/payments/${pay.id}/confirm-receipt`)).status).toBe(403);
    await f.agent.post(`/api/v1/payments/${pay.id}/confirm-receipt`);
    expect((await f.agent.post(`/api/v1/orders/${orderId}/complete`)).status).toBe(200);
    expect(q.get<any>('SELECT status FROM orders WHERE id = ?', orderId).status).toBe('completed');
    const stmt = (await f.agent.get(`/api/v1/orders/${orderId}/statement`)).body;
    expect(stmt.payments[0].status).toBe('confirmed');
  });

  it('prevents overselling and duplicate acceptance', async () => {
    const f = await farmer();
    const officer = await signUpAs('verification_officer');
    const [b1, b2] = [await verifiedBuyer(officer), await verifiedBuyer(officer)];
    const lot = await publishedLot(f, 10, 2000);
    const o1 = (await b1.agent.post('/api/v1/offers').send({ lot_id: lot.id, ...offerBody(6, 2000) })).body.offer;
    const o2 = (await b2.agent.post('/api/v1/offers').send({ lot_id: lot.id, ...offerBody(6, 2050) })).body.offer;
    expect((await f.agent.post(`/api/v1/offers/${o1.id}/respond`).send({ action: 'accept', confirm: true })).status).toBe(201);
    const second = await f.agent.post(`/api/v1/offers/${o2.id}/respond`).send({ action: 'accept', confirm: true });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('insufficient_quantity');
    expect(q.get<any>('SELECT status FROM offers WHERE id = ?', o2.id).status).toBe('pending'); // rolled back
    expect((await f.agent.post(`/api/v1/offers/${o1.id}/respond`).send({ action: 'accept', confirm: true })).body.code).toBe('not_pending');
    expect(q.get<any>('SELECT COUNT(*) n FROM orders WHERE lot_id = ?', lot.id).n).toBe(1);
    const l = q.get<any>('SELECT * FROM produce_lots WHERE id = ?', lot.id);
    expect(l.quantity_available + l.quantity_reserved).toBe(10);
  });

  it('requires step-up OTP for high-value confirmation and enforces the farmer order cap', async () => {
    const sup = await signUpAs('super_admin');
    await sup.agent.put('/api/v1/ops/settings').send({ stepup_threshold_inr: 1000, profile_level_max_order_inr: 50000 });
    const f = await farmer();
    const buyer = await verifiedBuyer();
    const big = await publishedLot(f, 100, 1000);
    const ob = (await buyer.agent.post('/api/v1/offers').send({ lot_id: big.id, ...offerBody(60, 1000) })).body.offer;
    expect((await f.agent.post(`/api/v1/offers/${ob.id}/respond`).send({ action: 'accept', confirm: true })).body.code).toBe('over_limit');
    const lot = await publishedLot(f, 10, 2000);
    const o = (await buyer.agent.post('/api/v1/offers').send({ lot_id: lot.id, ...offerBody(5, 2000) })).body.offer;
    const acc = await f.agent.post(`/api/v1/offers/${o.id}/respond`).send({ action: 'accept', confirm: true });
    const res = await f.agent.post(`/api/v1/orders/${acc.body.orderId}/confirm`);
    expect(res.body.code).toBe('step_up_required');
    await stepUp(f.agent);
    expect((await f.agent.post(`/api/v1/orders/${acc.body.orderId}/confirm`)).status).toBe(200);
    await sup.agent.put('/api/v1/ops/settings').send({ stepup_threshold_inr: 100000, profile_level_max_order_inr: 200000 });
  });

  it('releases reservations of orders nobody confirmed', async () => {
    const f = await farmer();
    const buyer = await verifiedBuyer();
    const lot = await publishedLot(f, 10, 2000);
    const o = (await buyer.agent.post('/api/v1/offers').send({ lot_id: lot.id, ...offerBody(4, 2000) })).body.offer;
    const acc = await f.agent.post(`/api/v1/offers/${o.id}/respond`).send({ action: 'accept', confirm: true });
    q.run(`UPDATE orders SET reservation_expires_at = datetime('now', '-1 hour') WHERE id = ?`, acc.body.orderId);
    marketplaceExpiry();
    expect(q.get<any>('SELECT status FROM orders WHERE id = ?', acc.body.orderId).status).toBe('cancelled');
    expect(q.get<any>('SELECT quantity_available FROM produce_lots WHERE id = ?', lot.id).quantity_available).toBe(10);
  });

  it('lets farmers respond to verified buyer requirements and compares selling options honestly', async () => {
    const f = await farmer();
    const buyer = await verifiedBuyer();
    const d = await buyer.agent.post('/api/v1/marketplace/demand').send({ crop_id: 'paddy', commodity: 'Paddy', quantity: 8, unit: 'quintal', price_min: 1900, price_max: 2300, district: 'Warangal', state: 'Telangana', latitude: 17.97, longitude: 79.59 });
    expect(d.status).toBe(201);
    const lot = await publishedLot(f, 10, 2000);
    expect((await f.agent.post('/api/v1/offers').send({ lot_id: lot.id, demand_id: d.body.demand.id, ...offerBody(9, 2200) })).body.code).toBe('over_demand');
    const r = await f.agent.post('/api/v1/offers').send({ lot_id: lot.id, demand_id: d.body.demand.id, ...offerBody(8, 2200) });
    expect(r.status).toBe(201);
    const opts = (await f.agent.get(`/api/v1/marketplace/lots/${lot.id}/sell-options`)).body;
    const dem = opts.options.find((o: any) => o.type === 'buyer_requirement');
    expect(dem.costs[0].amount).toBeNull(); // no transport rate configured → not guessed
    expect(dem.net_realization).toBeNull();
    expect(opts.disclaimer).toMatch(/not guarantee|Estimates/);
    await buyer.agent.post(`/api/v1/offers/${r.body.offer.id}/respond`).send({ action: 'accept', confirm: true });
    expect(q.get<any>('SELECT status, quantity_committed FROM demand_requests WHERE id = ?', d.body.demand.id)).toMatchObject({ status: 'filled', quantity_committed: 8 });
  });

  it('imports listings from the old browser marketplace as drafts, once', async () => {
    const f = await farmer();
    const items = [{ id: 'p1', cropName: 'Tomato', quantity: 200, pricePerKg: 18 }];
    expect((await f.agent.post('/api/v1/marketplace/lots/import-legacy').send({ items })).body.created).toBe(1);
    expect((await f.agent.post('/api/v1/marketplace/lots/import-legacy').send({ items })).body.created).toBe(0);
    expect(q.get<any>(`SELECT status FROM produce_lots WHERE farmer_id = ? AND imported_from = 'legacy_browser:p1'`, f.user.id).status).toBe('draft');
  });
});

describe('Workflow B – nearby storage booking', () => {
  async function verifiedFacility(capacity = 100) {
    const prov = await signUp('storage_provider', { password: 'password123' });
    const fac = (await prov.agent.post('/api/v1/storage/provider/facilities').send({
      name: 'Warangal Agri Warehouse', operator_name: 'Sri Lakshmi Storage', facility_type: 'warehouse', address: 'NH 163', district: 'Warangal', state: 'Telangana',
      latitude: 17.99, longitude: 79.58, commodities: ['cereal', 'pulse'], total_capacity_qtl: capacity, min_booking_qtl: 5,
      loading_per_qtl: 10, unloading_per_qtl: 10, booking_fee: 200, cancellation_policy: 'Booking fee non-refundable within 24h of start.', authorization_type: 'leased',
    })).body.facility;
    return { prov, fac };
  }

  it('verifies the facility, holds capacity, prevents overbooking, issues a receipt and reconciles charges', async () => {
    const { prov, fac } = await verifiedFacility(100);
    const f1 = await farmer();
    const f2 = await farmer();
    expect((await f1.agent.get('/api/v1/storage/facilities?lat=17.98&lon=79.6')).body.facilities.find((x: any) => x.id === fac.id)).toBeUndefined();
    const booking = { facility_id: fac.id, crop_id: 'paddy', commodity: 'Paddy', quantity: 60, unit: 'quintal', start_date: day(1), end_date: day(30), confirm: true };
    expect((await f1.agent.post('/api/v1/storage/bookings').send(booking)).body.code).toBe('not_bookable');

    expect((await prov.agent.post(`/api/v1/storage/provider/facilities/${fac.id}/submit`)).status).toBe(400); // no rate
    await prov.agent.put(`/api/v1/storage/provider/facilities/${fac.id}/rates`).send([{ price: 20, unit: 'quintal', period: 'month' }]);
    expect((await prov.agent.post(`/api/v1/storage/provider/facilities/${fac.id}/submit`)).body.code).toBe('incomplete'); // no authorisation proof
    await prov.agent.post(`/api/v1/storage/provider/facilities/${fac.id}/documents`).field('doc_type', 'authorization_proof').attach('file', PDF, 'lease.pdf');
    const sub = await prov.agent.post(`/api/v1/storage/provider/facilities/${fac.id}/submit`);
    expect(sub.status).toBe(201);
    const verifier = await signUpAs('verification_officer');
    expect((await verifier.agent.post(`/api/v1/ops/verifications/${sub.body.applicationId}/decision`).send({ decision: 'approve' })).status).toBe(404); // not their permission
    const storageOfficer = await signUpAs('storage_officer');
    await storageOfficer.agent.post(`/api/v1/ops/verifications/${sub.body.applicationId}/decision`).send({ decision: 'approve' });

    const list = (await f1.agent.get('/api/v1/storage/facilities?lat=17.98&lon=79.6&crop_id=paddy&quantity=60')).body.facilities;
    const found = list.find((x: any) => x.id === fac.id);
    expect(found.distance_km).toBeLessThan(10);
    expect(found.estimate.total).toBe(200 + 60 * 20 + 600 + 600);
    expect((await f1.agent.get('/api/v1/storage/facilities?crop_id=tomato')).body.facilities.find((x: any) => x.id === fac.id)).toBeUndefined(); // vegetables not supported

    const chk = (await f1.agent.post('/api/v1/storage/check').send(booking)).body;
    expect(chk.ok).toBe(true);
    const b1 = await f1.agent.post('/api/v1/storage/bookings').send(booking);
    expect(b1.status).toBe(201);
    expect(b1.body.booking.status).toBe('availability_requested');
    const over = await f2.agent.post('/api/v1/storage/bookings').send(booking);
    expect(over.status).toBe(409);
    expect(over.body.code).toBe('not_available');
    expect((await f2.agent.post('/api/v1/storage/bookings').send({ ...booking, start_date: day(31), end_date: day(40) })).status).toBe(201);
    expect((await f2.agent.get(`/api/v1/storage/bookings/${b1.body.booking.id}`)).status).toBe(404);

    const bid = b1.body.booking.id;
    await prov.agent.post(`/api/v1/storage/provider/bookings/${bid}/decide`).send({ decision: 'confirm' });
    expect(q.get<any>('SELECT status FROM storage_bookings WHERE id = ?', bid).status).toBe('awaiting_payment');
    const fee = q.get<any>(`SELECT * FROM payment_records WHERE booking_id = ?`, bid);
    await f1.agent.post(`/api/v1/payments/${fee.id}/mark-paid`).send({ method_note: 'upi' });
    expect((await prov.agent.post(`/api/v1/storage/provider/bookings/${bid}/schedule-checkin`).send({ check_in_date: day(1) })).status).toBe(409);
    await prov.agent.post(`/api/v1/payments/${fee.id}/confirm-receipt`);
    expect(q.get<any>('SELECT status FROM storage_bookings WHERE id = ?', bid).status).toBe('confirmed');
    await prov.agent.post(`/api/v1/storage/provider/bookings/${bid}/schedule-checkin`).send({ check_in_date: day(1) });
    expect((await prov.agent.post(`/api/v1/storage/provider/bookings/${bid}/receive`).send({ received_qty_qtl: 70, condition_notes: 'Dry' })).body.code).toBe('over_booked');
    const rec = await prov.agent.post(`/api/v1/storage/provider/bookings/${bid}/receive`).send({ received_qty_qtl: 58, condition_notes: 'Dry, clean bags', moisture_pct: 13, bin_ref: 'B-12' });
    expect(rec.body.receipt.receipt_no).toMatch(/^SR-/);
    const view = (await f1.agent.get(`/api/v1/storage/bookings/${bid}`)).body;
    expect(view.receipt.bin_ref).toBe('B-12');
    expect(view.movements.some((m: any) => m.kind === 'in' && m.quantity_qtl === 58)).toBe(true);

    await f1.agent.post(`/api/v1/storage/bookings/${bid}/release-request`).send({});
    const rel = await prov.agent.post(`/api/v1/storage/provider/bookings/${bid}/release`).send({ confirm: true });
    expect(rel.body.final_charges.paid_before_release).toBe(200);
    expect(rel.body.final_charges.outstanding).toBeGreaterThan(0);
    expect((await prov.agent.post(`/api/v1/storage/provider/bookings/${bid}/complete`)).body.code).toBe('payments_open');
    const due = q.get<any>(`SELECT * FROM payment_records WHERE booking_id = ? AND status = 'required'`, bid);
    await f1.agent.post(`/api/v1/payments/${due.id}/mark-paid`).send({ method_note: 'cash' });
    await prov.agent.post(`/api/v1/payments/${due.id}/confirm-receipt`);
    expect((await prov.agent.post(`/api/v1/storage/provider/bookings/${bid}/complete`)).status).toBe(200);
  });

  it('holds sensitive facility changes for re-approval and keeps capacity above existing bookings', async () => {
    const { prov, fac } = await verifiedFacility(100);
    q.run(`UPDATE storage_facilities SET status = 'verified' WHERE id = ?`, fac.id);
    q.run(`INSERT INTO storage_rates (id, facility_id, price, unit, period) VALUES (?, ?, 10, 'quintal', 'month')`, id(), fac.id);
    const f = await farmer();
    await f.agent.post('/api/v1/storage/bookings').send({ facility_id: fac.id, crop_id: 'paddy', commodity: 'Paddy', quantity: 50, unit: 'quintal', start_date: day(2), end_date: day(10), confirm: true });
    expect((await prov.agent.patch(`/api/v1/storage/provider/facilities/${fac.id}`).send({ total_capacity_qtl: 40 })).body.code).toBe('capacity_in_use');
    const r = await prov.agent.patch(`/api/v1/storage/provider/facilities/${fac.id}`).send({ address: 'New address', phone: '9999988888' });
    expect(r.body.pending_review).toBe(true);
    const row = q.get<any>('SELECT address, phone, pending_changes, status FROM storage_facilities WHERE id = ?', fac.id);
    expect(row.address).toBe('NH 163');
    expect(row.phone).toBe('9999988888');
    expect(JSON.parse(row.pending_changes).address).toBe('New address');
    expect(row.status).toBe('verified');
  });

  it('releases holds a facility never answered', async () => {
    const { fac } = await verifiedFacility(100);
    q.run(`UPDATE storage_facilities SET status = 'verified' WHERE id = ?`, fac.id);
    q.run(`INSERT INTO storage_rates (id, facility_id, price, unit, period) VALUES (?, ?, 10, 'quintal', 'month')`, id(), fac.id);
    const f = await farmer();
    const b = (await f.agent.post('/api/v1/storage/bookings').send({ facility_id: fac.id, crop_id: 'paddy', commodity: 'Paddy', quantity: 100, unit: 'quintal', start_date: day(2), end_date: day(10), confirm: true })).body.booking;
    q.run(`UPDATE storage_bookings SET hold_expires_at = datetime('now', '-1 hour') WHERE id = ?`, b.id);
    const chk = (await f.agent.post('/api/v1/storage/check').send({ facility_id: fac.id, crop_id: 'paddy', commodity: 'Paddy', quantity: 100, unit: 'quintal', start_date: day(2), end_date: day(10) })).body;
    expect(chk.ok).toBe(true); // lapsed hold no longer blocks capacity
    marketplaceExpiry();
    expect(q.get<any>('SELECT status FROM storage_bookings WHERE id = ?', b.id).status).toBe('cancelled');
  });
});

describe('Workflow D – fraud prevention and document security', () => {
  it('restricts access to private documents and logs every access', async () => {
    const b = await signUp('buyer', { password: '' });
    const up = await b.agent.post('/api/v1/buyer/documents').field('doc_type', 'pan_card').attach('file', PDF, 'pan.pdf');
    const docId = up.body.document.id;
    const other = await farmer();
    expect((await other.agent.get(`/api/v1/documents/${docId}/link`)).status).toBe(404);
    const officer = await signUpAs('verification_officer');
    const link = (await officer.agent.get(`/api/v1/documents/${docId}/link`)).body;
    expect(link.url).toContain('sig=');
    expect((await officer.agent.get(link.url.replace('/api', '/api'))).status).toBe(200);
    expect((await other.agent.get(link.url)).status).toBe(404); // link is bound to the officer
    const dispute = await signUpAs('dispute_officer');
    expect((await dispute.agent.get(`/api/v1/documents/${docId}/link`)).status).toBe(404); // wrong permission
    const log = q.all<any>('SELECT action FROM document_access_log WHERE document_id = ?', docId).map((r) => r.action);
    expect(log).toEqual(expect.arrayContaining(['denied', 'link', 'view']));
  });

  it('refuses forged payment confirmations and replayed webhooks', async () => {
    const f = await farmer();
    const buyer = await verifiedBuyer();
    const lot = await publishedLot(f, 10, 1000);
    const o = (await buyer.agent.post('/api/v1/offers').send({ lot_id: lot.id, ...offerBody(2, 1000) })).body.offer;
    const acc = await f.agent.post(`/api/v1/offers/${o.id}/respond`).send({ action: 'accept', confirm: true });
    await f.agent.post(`/api/v1/orders/${acc.body.orderId}/confirm`);
    await buyer.agent.post(`/api/v1/orders/${acc.body.orderId}/confirm`);
    const pay = q.get<any>('SELECT * FROM payment_records WHERE order_id = ?', acc.body.orderId);
    expect((await buyer.agent.post(`/api/v1/payments/${pay.id}/gateway-verify`).send({ razorpay_order_id: 'order_x', razorpay_payment_id: 'pay_x', razorpay_signature: 'abc' })).status).toBe(503);

    Object.assign(config.razorpay, { keyId: 'rzp_test_key', keySecret: 'test_secret', webhookSecret: 'wh_secret' });
    try {
      q.run(`UPDATE payment_records SET provider_order_id = 'order_TEST1', status = 'initiated' WHERE id = ?`, pay.id);
      const forged = await buyer.agent.post(`/api/v1/payments/${pay.id}/gateway-verify`).send({ razorpay_order_id: 'order_TEST1', razorpay_payment_id: 'pay_1', razorpay_signature: 'f'.repeat(64) });
      expect(forged.status).toBe(400);
      expect(q.get<any>('SELECT status FROM payment_records WHERE id = ?', pay.id).status).toBe('initiated');
      const sig = crypto.createHmac('sha256', 'test_secret').update('order_TEST1|pay_1').digest('hex');
      expect((await buyer.agent.post(`/api/v1/payments/${pay.id}/gateway-verify`).send({ razorpay_order_id: 'order_TEST1', razorpay_payment_id: 'pay_1', razorpay_signature: sig })).status).toBe(200);
      expect(q.get<any>('SELECT status FROM payment_records WHERE id = ?', pay.id).status).toBe('confirmed');

      const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_2', order_id: 'order_NONE' } } } });
      expect((await request(app).post('/api/webhooks/razorpay').set('content-type', 'application/json').set('x-razorpay-signature', 'bad').send(body)).status).toBe(401);
      const whSig = crypto.createHmac('sha256', 'wh_secret').update(body).digest('hex');
      const ok = await request(app).post('/api/webhooks/razorpay').set('content-type', 'application/json').set('x-razorpay-signature', whSig).set('x-razorpay-event-id', 'evt_1').send(body);
      expect(ok.body.ok).toBe(true);
      const again = await request(app).post('/api/webhooks/razorpay').set('content-type', 'application/json').set('x-razorpay-signature', whSig).set('x-razorpay-event-id', 'evt_1').send(body);
      expect(again.body.duplicate).toBe(true);
    } finally {
      Object.assign(config.razorpay, { keyId: '', keySecret: '', webhookSecret: '' });
    }
  });

  it('records reports, restricts, and handles appeals by a different reviewer', async () => {
    const f = await farmer();
    const lot = await publishedLot(f, 10, 2000);
    const reporter = await farmer();
    expect((await reporter.agent.post('/api/v1/trust/reports').send({ target_type: 'lot', target_id: lot.id, reason: 'misleading_quality', details: 'Photos are of another crop' })).status).toBe(201);
    const officer = await signUpAs('verification_officer');
    const fraud = (await officer.agent.get('/api/v1/ops/fraud')).body;
    expect(fraud.reports.some((r: any) => r.target_id === lot.id)).toBe(true);
    const restr = await officer.agent.post('/api/v1/ops/restrictions').send({ user_id: f.user.id, kind: 'no_listings', reason: 'Listing under investigation' });
    const draft = (await f.agent.post('/api/v1/marketplace/lots').send({ crop_id: 'paddy', commodity: 'Paddy', quantity_total: 3 })).body.lot;
    const blocked = await f.agent.post(`/api/v1/marketplace/lots/${draft.id}/publish`);
    expect(blocked.status).toBe(403);
    const ap = await f.agent.post('/api/v1/trust/appeals').send({ subject_type: 'restriction', subject_id: restr.body.id, statement: 'The photos are my own harvest; I can share more.' });
    expect(ap.status).toBe(201);
    expect((await officer.agent.post(`/api/v1/ops/appeals/${ap.body.id}/decide`).send({ decision: 'upheld', note: 'ok' })).status).toBe(403);
    const officer2 = await signUpAs('verification_officer');
    await officer2.agent.post(`/api/v1/ops/appeals/${ap.body.id}/decide`).send({ decision: 'upheld', note: 'Evidence checked' });
    expect((await f.agent.post(`/api/v1/marketplace/lots/${draft.id}/publish`)).status).toBe(200);
  });

  it('flags prices far from official mandi data without blocking the farmer', async () => {
    for (let i = 0; i < 5; i++) {
      q.run(`INSERT INTO market_prices (source, state, market, commodity, variety, grade, arrival_date, modal_price, fetched_at) VALUES ('agmarknet', 'Telangana', ?, 'Paddy(Dhan)(Common)', '', '', date('now'), 2200, datetime('now'))`, `M${i}${Math.random()}`);
    }
    const f = await farmer();
    const lot = await publishedLot(f, 10, 20000);
    expect(q.get<any>(`SELECT rule FROM fraud_flags WHERE subject_type = 'lot' AND subject_id = ?`, lot.id).rule).toBe('price_outlier');
  });
});

describe('Workflow E – disputes', () => {
  it('runs evidence, review, decision and a single appeal decided by another officer', async () => {
    const f = await farmer();
    const buyer = await verifiedBuyer();
    const lot = await publishedLot(f, 10, 1000);
    const o = (await buyer.agent.post('/api/v1/offers').send({ lot_id: lot.id, ...offerBody(5, 1000) })).body.offer;
    const orderId = (await f.agent.post(`/api/v1/offers/${o.id}/respond`).send({ action: 'accept', confirm: true })).body.orderId;
    expect((await buyer.agent.post('/api/v1/disputes').send({ order_id: orderId, category: 'quality_disagreement', description: 'x', requested_resolution: 'y' })).body.code).toBe('bad_state');
    await f.agent.post(`/api/v1/orders/${orderId}/confirm`);
    await buyer.agent.post(`/api/v1/orders/${orderId}/confirm`);
    await buyer.agent.post(`/api/v1/orders/${orderId}/deliver`).send({ received_quantity: 5, inspection_status: 'accepted' });
    const d = await buyer.agent.post('/api/v1/disputes').send({ order_id: orderId, category: 'quality_disagreement', description: 'Moisture much higher than stated', requested_resolution: 'Price reduction of 10%' });
    expect(d.status).toBe(201);
    expect((await f.agent.post(`/api/v1/orders/${orderId}/complete`)).body.code).toBe('payments_open');
    await buyer.agent.post(`/api/v1/disputes/${d.body.id}/evidence`).field('description', 'Moisture meter photo').attach('file', PDF, 'm.pdf');
    const outsider = await farmer();
    expect((await outsider.agent.get(`/api/v1/disputes/${d.body.id}`)).status).toBe(404);
    const ev = q.get<any>(`SELECT id FROM documents WHERE subject_type = 'dispute' AND subject_id = ?`, d.body.id);
    expect((await f.agent.get(`/api/v1/documents/${ev.id}/link`)).status).toBe(200); // other party may see evidence
    expect((await outsider.agent.get(`/api/v1/documents/${ev.id}/link`)).status).toBe(404);

    const off1 = await signUpAs('dispute_officer');
    expect((await off1.agent.get('/api/v1/ops/verifications')).status).toBe(403);
    await off1.agent.post(`/api/v1/ops/disputes/${d.body.id}/assign`).send({});
    await off1.agent.post(`/api/v1/ops/disputes/${d.body.id}/note`).send({ body: 'Internal: buyer has 2 prior complaints' });
    const partyView = (await f.agent.get(`/api/v1/disputes/${d.body.id}`)).body;
    expect(partyView.events.some((e: any) => e.kind === 'internal_note')).toBe(false);
    await off1.agent.post(`/api/v1/ops/disputes/${d.body.id}/decide`).send({ outcome: 'resolved', resolution: '5% price reduction agreed' });
    expect((await f.agent.post(`/api/v1/disputes/${d.body.id}/appeal`).send({ statement: 'Moisture was within limits at loading' })).status).toBe(200);
    expect((await off1.agent.post(`/api/v1/ops/disputes/${d.body.id}/assign`).send({})).body.code).toBe('same_officer');
    const off2 = await signUpAs('dispute_officer');
    await off2.agent.post(`/api/v1/ops/disputes/${d.body.id}/assign`).send({});
    await off2.agent.post(`/api/v1/ops/disputes/${d.body.id}/decide`).send({ outcome: 'rejected', resolution: 'Original decision stands after review' });
    expect((await f.agent.post(`/api/v1/disputes/${d.body.id}/appeal`).send({ statement: 'again' })).body.code).toBe('not_appealable');
    expect(() => q.run(`UPDATE dispute_events SET body = 'tampered' WHERE dispute_id = ?`, d.body.id)).toThrow(/append-only/);
    expect(() => q.run(`DELETE FROM audit_logs`)).toThrow(/append-only/);
  });
});

describe('Administrator security', () => {
  async function staff(role: string, password = 'StrongAdmin2026') {
    const phone = `+9198${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const uid = id();
    insert('users', { id: uid, phone, phone_verified: 1, password_hash: hashPassword(password), full_name: role, role, onboarding_complete: 1 });
    return { uid, phone: phone.slice(3), password };
  }

  it('requires password + OTP, locks after repeated failures, and keeps farmers out of the admin portal', async () => {
    const a = await staff('super_admin');
    const agent = request.agent(app);
    const step1 = await agent.post('/api/auth/login').send({ phone: a.phone, password: a.password, portal: 'admin' });
    expect(step1.body.mfa_required).toBe(true);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
    expect((await agent.post('/api/auth/login/mfa').send({ challenge: step1.body.challenge, otp: '000000' })).status).toBe(400);
    const ok = await agent.post('/api/auth/login/mfa').send({ challenge: step1.body.challenge, otp: step1.body.devCode });
    expect(ok.body.user.is_staff).toBe(true);
    expect(ok.body.user.permissions).toContain('admins.manage');
    expect((await agent.get('/api/v1/ops/analytics')).status).toBe(200);
    expect((await request(app).post('/api/auth/login/otp').send({ phone: a.phone, otp: '123456' })).status).toBe(400);

    const f = await farmer();
    expect((await request(app).post('/api/auth/login').send({ phone: f.phone, password: 'password123', portal: 'admin' })).status).toBe(401);

    const v = await staff('finance_officer');
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/login').send({ phone: v.phone, password: 'wrong-password' });
    const locked = await request(app).post('/api/auth/login').send({ phone: v.phone, password: v.password });
    expect(locked.status).toBe(429);
    expect(locked.body.code).toBe('locked');
  });

  it('enforces the permission matrix and immediate session revocation', async () => {
    const sup = await signUpAs('super_admin');
    expect((await sup.agent.post('/api/v1/ops/admins').send({ full_name: 'Weak', phone: '9811111111', password: 'short1', role: 'finance_officer' })).status).toBe(400);
    const created = await sup.agent.post('/api/v1/ops/admins').send({ full_name: 'Finance', phone: '9811111112', password: 'FinanceOfficer2026', role: 'finance_officer' });
    expect(created.status).toBe(201);
    const fin = await signUpAs('finance_officer');
    expect((await fin.agent.put('/api/v1/ops/settings').send({ platform_fee_buyer_pct: 1 })).status).toBe(403);
    expect((await fin.agent.get('/api/v1/ops/payments')).status).toBe(200);
    expect((await fin.agent.post('/api/v1/ops/admins').send({})).status).toBe(403);
    const admin = await signUpAs('admin');
    expect((await admin.agent.put('/api/v1/ops/settings').send({ platform_fee_buyer_pct: 1 })).status).toBe(403);
    expect((await admin.agent.patch(`/api/v1/admin/users/${fin.user.id}`).send({ role: 'farmer' })).status).toBe(403);
    await sup.agent.patch(`/api/v1/ops/admins/${fin.user.id}`).send({ status: 'suspended' });
    expect((await fin.agent.get('/api/v1/ops/payments')).status).toBe(401);
    // Fee changes are audited with before/after values.
    await sup.agent.put('/api/v1/ops/settings').send({ platform_fee_buyer_pct: 1 });
    expect(q.get<any>(`SELECT detail FROM audit_logs WHERE action = 'settings.update' ORDER BY id DESC LIMIT 1`).detail).toContain('"before"');
    await sup.agent.put('/api/v1/ops/settings').send({ platform_fee_buyer_pct: 0 });
  });
});

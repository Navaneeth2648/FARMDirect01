import { Router } from 'express';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.ts';
import { q, out, updateSet, insert, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, id, notFound, parse, zOptText, zText } from '../lib/http.ts';
import { requireRole } from '../lib/auth.ts';
import { audit } from '../lib/security.ts';
import { canAccessDocument, deleteDocumentFile, docUpload, logDocAccess, signedLink, storeDocument, verifySignedLink } from '../lib/files.ts';
import { buyerStanding, farmerStanding, mask } from '../services/standing.ts';
import { checkBusinessIdentifierConflict } from '../services/fraud.ts';

export const GSTIN_RE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export const PAN_RE = /^[A-Z]{5}\d{4}[A-Z]$/;
export const FSSAI_RE = /^\d{14}$/;

// ---------------- Buyer profile & verification ----------------
export const buyerRouter = Router();
buyerRouter.use(requireRole('buyer'));

const SENSITIVE = ['business_name', 'registration_type', 'gstin', 'pan', 'fssai', 'trade_license', 'address', 'state', 'district', 'buyer_type'];

function maskedProfile(p: Row) {
  const o = out(p) as Row;
  return { ...o, gstin_masked: mask(o.gstin), pan_masked: mask(o.pan), fssai_masked: mask(o.fssai), gstin: undefined, pan: undefined, fssai: undefined };
}

buyerRouter.get('/profile', ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM buyer_profiles WHERE user_id = ?', req.user!.id);
  if (!p) throw notFound('Buyer profile');
  const docs = q.all(`SELECT id, doc_type, mime, size, original_name, created_at FROM documents WHERE subject_type = 'buyer' AND subject_id = ? AND deleted_at IS NULL ORDER BY created_at DESC`, req.user!.id);
  res.json({ profile: maskedProfile(p), standing: buyerStanding(req.user!.id), documents: docs });
}));

const upper = (s?: string | null) => (s ? s.trim().toUpperCase() : s);
const ProfileSchema = z.object({
  buyer_type: z.enum(['trader', 'wholesaler', 'retailer', 'processor', 'exporter', 'institutional', 'cooperative', 'other']).optional(),
  business_name: zOptText(200), contact_email: z.string().email().max(200).optional().nullable().or(z.literal('').transform(() => null)),
  address: zOptText(500), state: zOptText(80), district: zOptText(80),
  pincode: z.string().regex(/^\d{6}$/).optional().nullable().or(z.literal('').transform(() => null)),
  operating_locations: z.array(z.string().max(100)).max(30).optional(),
  registration_type: z.enum(['individual', 'proprietorship', 'partnership', 'llp', 'company', 'cooperative', 'fpo', 'other']).optional().nullable(),
  gstin: z.string().transform(upper).pipe(z.string().regex(GSTIN_RE, 'GSTIN format looks wrong (15 characters, e.g. 36ABCDE1234F1Z5)')).optional().nullable().or(z.literal('').transform(() => null)),
  pan: z.string().transform(upper).pipe(z.string().regex(PAN_RE, 'PAN format looks wrong (e.g. ABCDE1234F)')).optional().nullable().or(z.literal('').transform(() => null)),
  fssai: z.string().regex(FSSAI_RE, 'FSSAI number has 14 digits').optional().nullable().or(z.literal('').transform(() => null)),
  trade_license: zOptText(100),
  commodities: z.array(z.string().max(80)).max(40).optional(),
  varieties: zOptText(300), quality_grades: zOptText(300),
  min_qty: z.number().positive().max(1e7).optional().nullable(), max_qty: z.number().positive().max(1e7).optional().nullable(),
  qty_unit: z.enum(['kg', 'quintal', 'tonne']).optional(),
  sourcing_regions: z.array(z.string().max(80)).max(40).optional(),
  delivery_preference: z.enum(['pickup', 'delivery', 'either']).optional().nullable(),
  purchase_frequency: z.enum(['one_time', 'weekly', 'monthly', 'seasonal']).optional().nullable(),
  storage_packaging_reqs: zOptText(500),
}).strict();

buyerRouter.patch('/profile', ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM buyer_profiles WHERE user_id = ?', req.user!.id)!;
  const data = parse(ProfileSchema, req.body);
  if (['suspended', 'deactivated'].includes(p.status)) throw forbidden('This account cannot be edited. Contact support.');
  if (data.min_qty && data.max_qty && data.min_qty > data.max_qty) throw new HttpError(400, 'Minimum quantity cannot exceed maximum', 'validation_error');
  const touchesSensitive = SENSITIVE.some((k) => k in data && (data as any)[k] !== p[k]);
  if (p.status === 'under_review' && touchesSensitive) throw new HttpError(409, 'Your application is under review. Business details can be changed after the review.', 'under_review');
  const set = updateSet(data);
  if (!set.empty) q.run(`UPDATE buyer_profiles SET ${set.sql}, updated_at = datetime('now') WHERE user_id = ?`, ...set.values, req.user!.id);
  // A verified buyer changing identity details must be re-verified.
  if (p.status === 'verified' && touchesSensitive) {
    q.run(`UPDATE buyer_profiles SET status = 'documents_pending', status_reason = 'Business details changed; re-verification needed' WHERE user_id = ?`, req.user!.id);
    audit(req, 'buyer.reverification_required', 'user', req.user!.id);
  } else if (p.status === 'mobile_verified' && (data.business_name || data.address)) {
    q.run(`UPDATE buyer_profiles SET status = 'documents_pending' WHERE user_id = ?`, req.user!.id);
  }
  checkBusinessIdentifierConflict(req.user!.id, 'gstin', data.gstin);
  checkBusinessIdentifierConflict(req.user!.id, 'pan', data.pan);
  res.json({ profile: maskedProfile(q.get<Row>('SELECT * FROM buyer_profiles WHERE user_id = ?', req.user!.id)!), standing: buyerStanding(req.user!.id) });
}));

const BUYER_DOC_TYPES = ['registration_certificate', 'representative_authorisation', 'gst_certificate', 'pan_card', 'fssai_licence', 'trade_licence', 'bank_proof', 'other'] as const;

buyerRouter.post('/documents', docUpload.single('file'), ah(async (req, res) => {
  const { doc_type } = parse(z.object({ doc_type: z.enum(BUYER_DOC_TYPES) }), req.body);
  const p = q.get<Row>('SELECT status FROM buyer_profiles WHERE user_id = ?', req.user!.id)!;
  if (p.status === 'under_review') throw new HttpError(409, 'Documents cannot be changed while under review', 'under_review');
  const doc = storeDocument(req, 'buyer', req.user!.id, doc_type);
  res.status(201).json({ document: doc, standing: buyerStanding(req.user!.id) });
}));

buyerRouter.post('/accept-terms', ah(async (req, res) => {
  q.run(`UPDATE buyer_profiles SET terms_accepted_at = datetime('now') WHERE user_id = ?`, req.user!.id);
  audit(req, 'buyer.accept_terms', 'user', req.user!.id);
  res.json({ standing: buyerStanding(req.user!.id) });
}));

buyerRouter.post('/submit', ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM buyer_profiles WHERE user_id = ?', req.user!.id)!;
  if (!['mobile_verified', 'documents_pending', 'info_required', 'draft'].includes(p.status)) throw new HttpError(409, `Cannot submit while status is "${p.status}"`, 'bad_state');
  const standing = buyerStanding(req.user!.id)!;
  if (!standing.ready_to_submit) throw new HttpError(400, 'Some required information is missing', 'incomplete', { next_steps: standing.next_steps });
  // Automated checks are recorded for the reviewer; they never approve anyone by themselves.
  const checks = [
    { check: 'Mobile number verified by OTP', result: 'pass' },
    p.gstin ? { check: 'GSTIN format', result: GSTIN_RE.test(p.gstin) ? 'pass' : 'fail' } : null,
    p.gstin && p.pan ? { check: 'PAN matches characters 3–12 of GSTIN', result: p.gstin.slice(2, 12) === p.pan ? 'pass' : 'mismatch' } : null,
    p.pan ? { check: 'PAN format', result: PAN_RE.test(p.pan) ? 'pass' : 'fail' } : null,
    p.fssai ? { check: 'FSSAI number format', result: FSSAI_RE.test(p.fssai) ? 'pass' : 'fail' } : null,
    { check: 'Same GSTIN/PAN on another account', result: q.get(`SELECT 1 FROM fraud_flags WHERE user_id = ? AND rule IN ('gstin_shared_across_accounts','pan_shared_across_accounts') AND status = 'open'`, req.user!.id) ? 'flagged' : 'none found' },
    { check: 'Official registry lookup (GST/MCA/FSSAI)', result: 'not automated – reviewer must check the official portal' },
  ].filter(Boolean);
  const aid = id();
  q.tx(() => {
    insert('verification_applications', {
      id: aid, user_id: req.user!.id, kind: 'buyer_business', status: 'submitted',
      submitted_data: { ...out(p), terms_accepted_at: p.terms_accepted_at }, checks,
    });
    q.run(`INSERT INTO verification_events (application_id, actor_id, action) VALUES (?, ?, 'submitted')`, aid, req.user!.id);
    q.run(`UPDATE buyer_profiles SET status = 'under_review', status_reason = NULL, submitted_at = datetime('now') WHERE user_id = ?`, req.user!.id);
  });
  audit(req, 'buyer.submit_verification', 'verification', aid);
  res.status(201).json({ applicationId: aid, standing: buyerStanding(req.user!.id) });
}));

// ---------------- Farmer identity (optional level 3) ----------------
export const verificationRouter = Router();

const ID_DOC_TYPES = ['voter_id', 'pan_card', 'driving_licence', 'ration_card', 'kisan_credit_card', 'masked_aadhaar', 'other_government_id'] as const;

verificationRouter.get('/mine', ah(async (req, res) => {
  const apps = q.all<Row>('SELECT id, kind, status, decision_reason, submitted_at, decided_at FROM verification_applications WHERE user_id = ? ORDER BY submitted_at DESC', req.user!.id);
  res.json({
    applications: apps.map((a) => ({ ...a, events: q.all('SELECT action, note, created_at FROM verification_events WHERE application_id = ? ORDER BY id', a.id) })),
    farmer_standing: req.user!.role === 'farmer' ? farmerStanding(req.user!.id) : undefined,
  });
}));

verificationRouter.post('/farmer-identity', requireRole('farmer'), docUpload.single('file'), ah(async (req, res) => {
  const b = parse(z.object({ doc_type: z.enum(ID_DOC_TYPES), consent: z.literal('true') }), req.body);
  const standing = farmerStanding(req.user!.id)!;
  if (standing.level < 2) throw new HttpError(400, 'Complete your profile (state, district, village) first', 'profile_incomplete');
  if (q.get(`SELECT 1 FROM verification_applications WHERE user_id = ? AND kind = 'farmer_identity' AND status IN ('submitted','under_review')`, req.user!.id)) {
    throw new HttpError(409, 'You already have an identity verification in progress', 'in_progress');
  }
  const aid = id();
  const doc = storeDocument(req, 'user', req.user!.id, b.doc_type);
  insert('verification_applications', {
    id: aid, user_id: req.user!.id, kind: 'farmer_identity', submitted_data: { doc_type: b.doc_type, document_id: doc.id },
    checks: [{ check: 'Mobile number verified by OTP', result: 'pass' }, { check: 'Profile complete', result: 'pass' }],
  });
  q.run(`INSERT INTO verification_events (application_id, actor_id, action) VALUES (?, ?, 'submitted')`, aid, req.user!.id);
  audit(req, 'farmer.submit_identity', 'verification', aid);
  res.status(201).json({ applicationId: aid });
}));

// ---------------- Documents (authorised, signed, logged) ----------------
export const documentsRouter = Router();

documentsRouter.get('/:id/link', ah(async (req, res) => {
  const doc = q.get<Row>('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc || !canAccessDocument(req.user!, doc)) {
    if (doc) { logDocAccess(doc.id, req.user!.id, 'denied'); audit(req, 'document.access_denied', 'document', doc.id); }
    throw notFound('Document');
  }
  logDocAccess(doc.id, req.user!.id, 'link');
  res.json(signedLink(doc.id, req.user!.id));
}));

documentsRouter.get('/:id/file', ah(async (req, res) => {
  const doc = q.get<Row>('SELECT * FROM documents WHERE id = ?', req.params.id);
  if (!doc || !doc.file_path || !canAccessDocument(req.user!, doc) || !verifySignedLink(doc.id, req.user!.id, String(req.query.exp || ''), String(req.query.sig || ''))) {
    if (doc) logDocAccess(doc.id, req.user!.id, 'denied');
    throw notFound('Document');
  }
  logDocAccess(doc.id, req.user!.id, 'view');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', `inline; filename="${doc.doc_type}${path.extname(doc.file_path)}"`);
  res.type(doc.mime).sendFile(path.resolve(config.uploadDir, doc.file_path));
}));

documentsRouter.delete('/:id', ah(async (req, res) => {
  const doc = q.get<Row>('SELECT * FROM documents WHERE id = ? AND owner_id = ?', req.params.id, req.user!.id);
  if (!doc) throw notFound('Document');
  if (doc.subject_type === 'dispute') throw forbidden('Dispute evidence cannot be deleted');
  if (doc.subject_type === 'buyer' && q.get(`SELECT 1 FROM buyer_profiles WHERE user_id = ? AND status = 'under_review'`, req.user!.id)) {
    throw new HttpError(409, 'Documents cannot be removed while under review', 'under_review');
  }
  deleteDocumentFile(doc);
  audit(req, 'document.delete', 'document', doc.id);
  res.json({ ok: true });
}));

// ---------------- Reports & appeals ----------------
export const trustRouter = Router();

trustRouter.post('/reports', ah(async (req, res) => {
  const b = parse(z.object({
    target_type: z.enum(['user', 'lot', 'demand', 'facility', 'transport', 'order']), target_id: z.string().max(100),
    reason: z.enum(['fake_listing', 'misleading_quality', 'impersonation', 'payment_fraud', 'non_delivery', 'abusive', 'fake_facility', 'other']),
    details: zOptText(2000),
  }), req.body);
  const rid = id();
  const r = q.run('INSERT OR IGNORE INTO user_reports (id, reporter_id, target_type, target_id, reason, details) VALUES (?, ?, ?, ?, ?, ?)',
    rid, req.user!.id, b.target_type, b.target_id, b.reason, b.details ?? null);
  audit(req, 'report.create', b.target_type, b.target_id, { reason: b.reason });
  res.status(201).json({ ok: true, duplicate: r.changes === 0 });
}));

trustRouter.get('/restrictions', ah(async (req, res) => {
  res.json({
    restrictions: q.all('SELECT id, kind, reason, created_at, lifted_at FROM account_restrictions WHERE user_id = ? ORDER BY created_at DESC', req.user!.id),
    appeals: q.all('SELECT * FROM appeals WHERE user_id = ? ORDER BY created_at DESC', req.user!.id),
  });
}));

trustRouter.post('/appeals', ah(async (req, res) => {
  const b = parse(z.object({ subject_type: z.enum(['restriction', 'verification', 'fraud_flag']), subject_id: z.string().max(100), statement: zText(3000) }), req.body);
  const owns = b.subject_type === 'restriction' ? q.get('SELECT 1 FROM account_restrictions WHERE id = ? AND user_id = ?', b.subject_id, req.user!.id)
    : b.subject_type === 'verification' ? q.get(`SELECT 1 FROM verification_applications WHERE id = ? AND user_id = ? AND status = 'rejected'`, b.subject_id, req.user!.id)
    : q.get('SELECT 1 FROM fraud_flags WHERE id = ? AND user_id = ?', b.subject_id, req.user!.id);
  if (!owns) throw notFound('Item to appeal');
  if (q.get(`SELECT 1 FROM appeals WHERE subject_type = ? AND subject_id = ? AND status = 'open'`, b.subject_type, b.subject_id)) {
    throw new HttpError(409, 'An appeal is already open for this', 'duplicate');
  }
  const aid = id();
  q.run('INSERT INTO appeals (id, user_id, subject_type, subject_id, statement) VALUES (?, ?, ?, ?, ?)', aid, req.user!.id, b.subject_type, b.subject_id, b.statement);
  audit(req, 'appeal.create', b.subject_type, b.subject_id);
  res.status(201).json({ id: aid });
}));

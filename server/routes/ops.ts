import { Router } from 'express';
import { z } from 'zod';
import { q, out, insert, updateSet, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, id, notFound, parse, zPhone, zText } from '../lib/http.ts';
import { requirePerm } from '../lib/auth.ts';
import { hasPerm, permissionsFor, ROLE_LABELS, STAFF_ROLES, type Permission } from '../lib/permissions.ts';
import { audit, hashPassword } from '../lib/security.ts';
import { notifyT } from '../services/messages.ts';
import { allSettings, setSetting, SETTING_DEFAULTS, type SettingKey } from '../services/settings.ts';
import { occupancyToday } from '../services/capacity.ts';
import { mask } from '../services/standing.ts';
import { zStaffPassword } from './auth.ts';

/** Marketplace operations for administrators, each action gated by a specific permission. */
export const opsRouter = Router();

const KIND_PERM: Record<string, Permission> = {
  buyer_business: 'verify.buyers', farmer_identity: 'verify.farmers', storage_facility: 'verify.storage', transport_provider: 'verify.transport',
};
const anyVerify = requirePerm('verify.buyers', 'verify.farmers', 'verify.storage', 'verify.transport');

// ---------------- Verification queues ----------------
opsRouter.get('/verifications', anyVerify, ah(async (req, res) => {
  const { kind, status } = req.query as Record<string, string | undefined>;
  const kinds = Object.keys(KIND_PERM).filter((k) => hasPerm(req.user!.role, KIND_PERM[k]) && (!kind || k === kind));
  if (!kinds.length) return res.json({ applications: [] });
  const statuses = status ? [status] : ['submitted', 'under_review', 'info_required'];
  const rows = q.all<Row>(`SELECT a.*, u.full_name, u.phone, u.role FROM verification_applications a JOIN users u ON u.id = a.user_id
    WHERE a.kind IN (${kinds.map(() => '?').join(',')}) AND a.status IN (${statuses.map(() => '?').join(',')}) ORDER BY a.submitted_at LIMIT 300`, ...kinds, ...statuses);
  res.json({ applications: rows.map((a) => ({ ...out(a), phone: mask(a.phone, 4) })) });
}));

opsRouter.get('/verifications/:id', anyVerify, ah(async (req, res) => {
  const a = q.get<Row>(`SELECT a.*, u.full_name, u.phone, u.role, u.created_at AS user_since FROM verification_applications a JOIN users u ON u.id = a.user_id WHERE a.id = ?`, req.params.id);
  if (!a || !hasPerm(req.user!.role, KIND_PERM[a.kind])) throw notFound('Application');
  const subjectType = a.kind === 'buyer_business' ? 'buyer' : a.kind === 'farmer_identity' ? 'user' : a.kind === 'storage_facility' ? 'facility' : 'transport';
  const subjectId = a.subject_id ?? a.user_id;
  res.json({
    application: out(a),
    documents: q.all(`SELECT id, doc_type, mime, size, original_name, created_at FROM documents WHERE subject_type = ? AND subject_id = ? AND deleted_at IS NULL`, subjectType, subjectId),
    history: q.all(`SELECT e.action, e.note, e.created_at, u.full_name AS actor FROM verification_events e LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.application_id IN (SELECT id FROM verification_applications WHERE user_id = ? AND kind = ?) ORDER BY e.id`, a.user_id, a.kind),
    previous: q.all(`SELECT id, status, decision_reason, submitted_at, decided_at FROM verification_applications WHERE user_id = ? AND kind = ? AND id != ? ORDER BY submitted_at DESC`, a.user_id, a.kind, a.id),
    fraud_flags: q.all(`SELECT rule, severity, status, created_at FROM fraud_flags WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`, a.user_id),
    current: a.kind === 'storage_facility' ? out(q.get('SELECT * FROM storage_facilities WHERE id = ?', a.subject_id))
      : a.kind === 'transport_provider' ? out(q.get('SELECT * FROM transport_providers WHERE id = ?', a.subject_id))
      : a.kind === 'buyer_business' ? out(q.get('SELECT * FROM buyer_profiles WHERE user_id = ?', a.user_id)) : null,
  });
}));

opsRouter.post('/verifications/:id/decision', anyVerify, ah(async (req, res) => {
  const { decision, reason } = parse(z.object({ decision: z.enum(['start_review', 'approve', 'reject', 'request_info']), reason: z.string().trim().max(1000).optional() }), req.body);
  const a = q.get<Row>('SELECT * FROM verification_applications WHERE id = ?', req.params.id);
  if (!a || !hasPerm(req.user!.role, KIND_PERM[a.kind])) throw notFound('Application');
  if (['approved', 'rejected'].includes(a.status)) throw new HttpError(409, 'Already decided', 'decided');
  if ((decision === 'reject' || decision === 'request_info') && !reason) throw new HttpError(400, 'Give a reason the applicant can act on', 'validation_error');
  if (a.user_id === req.user!.id) throw forbidden('You cannot review your own application');
  const status = { start_review: 'under_review', approve: 'approved', reject: 'rejected', request_info: 'info_required' }[decision];
  q.tx(() => {
    q.run(`UPDATE verification_applications SET status = ?, reviewer_id = ?, decision_reason = ?, decided_at = CASE WHEN ? IN ('approved','rejected') THEN datetime('now') ELSE decided_at END WHERE id = ?`,
      status, req.user!.id, reason ?? null, status, a.id);
    q.run('INSERT INTO verification_events (application_id, actor_id, action, note) VALUES (?, ?, ?, ?)', a.id, req.user!.id, decision, reason ?? null);
    if (decision === 'start_review') return;
    if (a.kind === 'buyer_business') {
      const bs = { approve: 'verified', reject: 'rejected', request_info: 'info_required' }[decision as 'approve'];
      q.run(`UPDATE buyer_profiles SET status = ?, status_reason = ?, verified_at = CASE WHEN ? = 'verified' THEN datetime('now') ELSE verified_at END, verified_by = ? WHERE user_id = ?`, bs, reason ?? null, bs, req.user!.id, a.user_id);
    } else if (a.kind === 'farmer_identity' && decision === 'approve') {
      q.run('UPDATE users SET farmer_level = 3 WHERE id = ?', a.user_id);
    } else if (a.kind === 'storage_facility') {
      const f = q.get<Row>('SELECT * FROM storage_facilities WHERE id = ?', a.subject_id)!;
      if (decision === 'approve') {
        const pending = f.pending_changes ? JSON.parse(f.pending_changes) : {};
        const set = updateSet(pending);
        q.run(`UPDATE storage_facilities SET ${set.empty ? '' : `${set.sql}, `}status = 'verified', status_reason = NULL, pending_changes = NULL, verified_by = ?, verified_at = datetime('now') WHERE id = ?`, ...set.values, req.user!.id, f.id);
      } else {
        // Rejecting changes to an already verified facility keeps it live with its old details.
        q.run(`UPDATE storage_facilities SET status = CASE WHEN status = 'verified' THEN 'verified' ELSE ? END, pending_changes = NULL, status_reason = ? WHERE id = ?`,
          decision === 'reject' ? 'rejected' : 'draft', reason ?? null, f.id);
      }
    } else if (a.kind === 'transport_provider') {
      q.run(`UPDATE transport_providers SET status = ?, status_reason = ?, verified_by = ?, verified_at = CASE WHEN ? = 'verified' THEN datetime('now') ELSE verified_at END WHERE id = ?`,
        decision === 'approve' ? 'verified' : decision === 'reject' ? 'rejected' : 'pending_review', reason ?? null, req.user!.id, decision === 'approve' ? 'verified' : '', a.subject_id);
    }
  });
  if (decision !== 'start_review') notifyT(a.user_id, 'system', 'verification_update', { status: status.replace('_', ' ') }, `verif:${a.id}:${status}`, '/account/verification');
  audit(req, `verification.${decision}`, 'verification', a.id, { kind: a.kind, reason });
  res.json({ ok: true, status });
}));

// ---------------- Storage oversight ----------------
opsRouter.get('/facilities', requirePerm('verify.storage', 'bookings.view'), ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  const rows = q.all<Row>(`SELECT f.*, u.full_name AS provider_name FROM storage_facilities f LEFT JOIN users u ON u.id = f.provider_id ${status ? 'WHERE f.status = ?' : ''} ORDER BY f.updated_at DESC`, ...(status ? [status] : []));
  res.json({ facilities: rows.map((f) => ({ ...out(f), occupancy: occupancyToday(f.id) })) });
}));

opsRouter.post('/facilities/:id/status', requirePerm('verify.storage'), ah(async (req, res) => {
  const { status, reason } = parse(z.object({ status: z.enum(['suspended', 'verified']), reason: zText(500) }), req.body);
  const f = q.get<Row>('SELECT * FROM storage_facilities WHERE id = ?', req.params.id);
  if (!f) throw notFound('Facility');
  if (status === 'verified' && f.status !== 'suspended') throw new HttpError(409, 'Only suspended facilities can be reinstated here; new facilities go through verification', 'bad_state');
  q.run(`UPDATE storage_facilities SET status = ?, status_reason = ? WHERE id = ?`, status, reason, f.id);
  notifyT(f.provider_id, 'system', 'verification_update', { status: `facility ${status}` }, `facility-status:${f.id}:${Date.now()}`, '/storage/provider');
  audit(req, `facility.${status}`, 'facility', f.id, { reason });
  res.json({ ok: true });
}));

opsRouter.get('/bookings', requirePerm('bookings.view'), ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  res.json({ bookings: q.all(`SELECT b.*, f.name AS facility_name, u.full_name AS farmer_name FROM storage_bookings b JOIN storage_facilities f ON f.id = b.facility_id
    LEFT JOIN users u ON u.id = b.farmer_id ${status ? 'WHERE b.status = ?' : ''} ORDER BY b.created_at DESC LIMIT 300`, ...(status ? [status] : [])).map(out) });
}));

// ---------------- Listings, demand, orders ----------------
opsRouter.get('/lots', requirePerm('listings.moderate'), ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  res.json({ lots: q.all(`SELECT l.*, u.full_name AS farmer_name, (SELECT COUNT(*) FROM user_reports r WHERE r.target_type = 'lot' AND r.target_id = l.id AND r.status = 'open') AS open_reports,
    (SELECT COUNT(*) FROM fraud_flags ff WHERE ff.subject_type = 'lot' AND ff.subject_id = l.id AND ff.status = 'open') AS open_flags
    FROM produce_lots l JOIN users u ON u.id = l.farmer_id ${status ? 'WHERE l.status = ?' : ''} ORDER BY l.updated_at DESC LIMIT 300`, ...(status ? [status] : [])) });
}));

opsRouter.post('/lots/:id/moderate', requirePerm('listings.moderate'), ah(async (req, res) => {
  const { action, reason } = parse(z.object({ action: z.enum(['withdraw', 'restore']), reason: zText(500) }), req.body);
  const l = q.get<Row>('SELECT * FROM produce_lots WHERE id = ?', req.params.id);
  if (!l) throw notFound('Lot');
  if (action === 'withdraw' && l.quantity_reserved > 0) throw new HttpError(409, 'Lot has reserved quantity in an order; handle the order first', 'has_reservations');
  q.tx(() => {
    q.run(`UPDATE produce_lots SET status = ?, updated_at = datetime('now') WHERE id = ?`, action === 'withdraw' ? 'withdrawn' : 'draft', l.id);
    if (action === 'withdraw') q.run(`UPDATE offers SET status = 'withdrawn' WHERE lot_id = ? AND status = 'pending'`, l.id);
  });
  notifyT(l.farmer_id, 'system', 'verification_update', { status: action === 'withdraw' ? `listing removed by moderator: ${reason}` : 'listing restored as draft' }, `lot-mod:${l.id}:${Date.now()}`, '/sell');
  audit(req, `lot.moderate_${action}`, 'lot', l.id, { reason });
  res.json({ ok: true });
}));

opsRouter.get('/demand', requirePerm('listings.moderate'), ah(async (_req, res) => {
  res.json({ demand: q.all(`SELECT d.*, b.business_name FROM demand_requests d LEFT JOIN buyer_profiles b ON b.user_id = d.buyer_id ORDER BY d.created_at DESC LIMIT 300`) });
}));

opsRouter.post('/demand/:id/close', requirePerm('listings.moderate'), ah(async (req, res) => {
  const { reason } = parse(z.object({ reason: zText(500) }), req.body);
  const r = q.run(`UPDATE demand_requests SET status = 'closed', updated_at = datetime('now') WHERE id = ?`, req.params.id);
  if (!r.changes) throw notFound('Requirement');
  audit(req, 'demand.moderate_close', 'demand', req.params.id, { reason });
  res.json({ ok: true });
}));

opsRouter.get('/orders', requirePerm('orders.view'), ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  res.json({ orders: q.all(`SELECT o.*, f.full_name AS farmer_name, b.full_name AS buyer_name FROM orders o LEFT JOIN users f ON f.id = o.farmer_id LEFT JOIN users b ON b.id = o.buyer_id
    ${status ? 'WHERE o.status = ?' : ''} ORDER BY o.updated_at DESC LIMIT 300`, ...(status ? [status] : [])).map(out) });
}));

opsRouter.get('/offers', requirePerm('orders.view', 'listings.moderate'), ah(async (_req, res) => {
  res.json({ offers: q.all(`SELECT o.*, l.commodity FROM offers o LEFT JOIN produce_lots l ON l.id = o.lot_id ORDER BY o.created_at DESC LIMIT 300`).map(out) });
}));

// ---------------- Payments & reconciliation ----------------
opsRouter.get('/payments', requirePerm('payments.view'), ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  res.json({
    payments: q.all(`SELECT p.*, o.order_no, b.booking_ref FROM payment_records p LEFT JOIN orders o ON o.id = p.order_id LEFT JOIN storage_bookings b ON b.id = p.booking_id
      ${status ? 'WHERE p.status = ?' : ''} ORDER BY p.updated_at DESC LIMIT 500`, ...(status ? [status] : [])),
    totals: q.all(`SELECT status, kind, COUNT(*) n, SUM(amount) total FROM payment_records GROUP BY status, kind`),
  });
}));

opsRouter.post('/payments/:id/reconcile', requirePerm('payments.reconcile'), ah(async (req, res) => {
  const { status, note } = parse(z.object({ status: z.enum(['confirmed', 'failed', 'disputed', 'refunded', 'settled']), note: zText(500) }), req.body);
  const p = q.get<Row>('SELECT * FROM payment_records WHERE id = ?', req.params.id);
  if (!p) throw notFound('Payment');
  q.run(`UPDATE payment_records SET status = ?, confirmed_by = ?, updated_at = datetime('now') WHERE id = ?`, status, req.user!.id, p.id);
  q.run('INSERT INTO payment_events (payment_id, event, actor_id, payload) VALUES (?, ?, ?, ?)', p.id, `reconciled:${status}`, req.user!.id, JSON.stringify({ note }));
  audit(req, 'payment.reconcile', 'payment', p.id, { from: p.status, to: status, note });
  res.json({ ok: true });
}));

// ---------------- Transport providers ----------------
opsRouter.get('/transport-providers', requirePerm('verify.transport'), ah(async (_req, res) => {
  res.json({ providers: q.all('SELECT tp.*, u.full_name FROM transport_providers tp LEFT JOIN users u ON u.id = tp.user_id ORDER BY tp.created_at DESC').map(out) });
}));

opsRouter.post('/transport-providers/:id/suspend', requirePerm('verify.transport'), ah(async (req, res) => {
  const { reason } = parse(z.object({ reason: zText(500) }), req.body);
  const r = q.run(`UPDATE transport_providers SET status = 'suspended', status_reason = ? WHERE id = ?`, reason, req.params.id);
  if (!r.changes) throw notFound('Provider');
  audit(req, 'transport.suspend', 'transport', req.params.id, { reason });
  res.json({ ok: true });
}));

// ---------------- Fraud, reports, restrictions, appeals ----------------
opsRouter.get('/fraud', requirePerm('fraud.review'), ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'open';
  res.json({
    flags: q.all(`SELECT f.*, u.full_name FROM fraud_flags f LEFT JOIN users u ON u.id = f.user_id WHERE f.status = ? ORDER BY CASE f.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, f.created_at DESC LIMIT 300`, status).map(out),
    reports: q.all(`SELECT r.*, u.full_name AS reporter_name FROM user_reports r LEFT JOIN users u ON u.id = r.reporter_id WHERE r.status IN ('open','investigating') ORDER BY r.created_at LIMIT 300`),
    appeals: q.all(`SELECT a.*, u.full_name FROM appeals a JOIN users u ON u.id = a.user_id WHERE a.status = 'open' ORDER BY a.created_at`),
    restrictions: q.all(`SELECT r.*, u.full_name FROM account_restrictions r JOIN users u ON u.id = r.user_id WHERE r.lifted_at IS NULL ORDER BY r.created_at DESC`),
  });
}));

opsRouter.post('/fraud/:id/review', requirePerm('fraud.review'), ah(async (req, res) => {
  const { status, note } = parse(z.object({ status: z.enum(['dismissed', 'actioned']), note: zText(1000) }), req.body);
  const r = q.run(`UPDATE fraud_flags SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`, status, note, req.user!.id, req.params.id);
  if (!r.changes) throw notFound('Flag');
  audit(req, `fraud.${status}`, 'fraud_flag', req.params.id, { note });
  res.json({ ok: true });
}));

opsRouter.post('/reports/:id', requirePerm('fraud.review', 'listings.moderate'), ah(async (req, res) => {
  const { status, resolution } = parse(z.object({ status: z.enum(['investigating', 'actioned', 'dismissed']), resolution: z.string().trim().max(1000).optional() }), req.body);
  if (status !== 'investigating' && !resolution) throw new HttpError(400, 'Record what was decided', 'validation_error');
  const r = q.run(`UPDATE user_reports SET status = ?, resolution = COALESCE(?, resolution), assigned_to = ?, updated_at = datetime('now') WHERE id = ?`, status, resolution ?? null, req.user!.id, req.params.id);
  if (!r.changes) throw notFound('Report');
  audit(req, `report.${status}`, 'report', req.params.id, { resolution });
  res.json({ ok: true });
}));

opsRouter.post('/restrictions', requirePerm('fraud.review'), ah(async (req, res) => {
  const b = parse(z.object({ user_id: z.string(), kind: z.enum(['no_offers', 'no_listings', 'no_bookings', 'full']), reason: zText(500) }), req.body);
  const target = q.get<Row>('SELECT role FROM users WHERE id = ?', b.user_id);
  if (!target) throw notFound('User');
  if ((STAFF_ROLES as readonly string[]).includes(target.role)) throw forbidden('Staff accounts are managed separately');
  const rid = id();
  q.run('INSERT INTO account_restrictions (id, user_id, kind, reason, created_by) VALUES (?, ?, ?, ?, ?)', rid, b.user_id, b.kind, b.reason, req.user!.id);
  notifyT(b.user_id, 'system', 'security_warning', { status: `Your account has a restriction: ${b.reason}. You can appeal from your account` }, `restriction:${rid}`, '/account/verification');
  audit(req, 'restriction.create', 'user', b.user_id, b);
  res.status(201).json({ id: rid });
}));

opsRouter.post('/restrictions/:id/lift', requirePerm('fraud.review'), ah(async (req, res) => {
  const { reason } = parse(z.object({ reason: zText(500) }), req.body);
  const r = q.run(`UPDATE account_restrictions SET lifted_at = datetime('now'), lifted_by = ? WHERE id = ? AND lifted_at IS NULL`, req.user!.id, req.params.id);
  if (!r.changes) throw notFound('Active restriction');
  audit(req, 'restriction.lift', 'restriction', req.params.id, { reason });
  res.json({ ok: true });
}));

opsRouter.post('/appeals/:id/decide', requirePerm('fraud.review'), ah(async (req, res) => {
  const { decision, note } = parse(z.object({ decision: z.enum(['upheld', 'denied']), note: zText(1000) }), req.body);
  const a = q.get<Row>(`SELECT * FROM appeals WHERE id = ? AND status = 'open'`, req.params.id);
  if (!a) throw notFound('Open appeal');
  const orig = a.subject_type === 'restriction' ? q.get<Row>('SELECT created_by FROM account_restrictions WHERE id = ?', a.subject_id)?.created_by
    : a.subject_type === 'verification' ? q.get<Row>('SELECT reviewer_id FROM verification_applications WHERE id = ?', a.subject_id)?.reviewer_id : null;
  if (orig === req.user!.id && req.user!.role !== 'super_admin') throw forbidden('A different reviewer must decide this appeal');
  q.tx(() => {
    q.run(`UPDATE appeals SET status = ?, decided_by = ?, decision_note = ?, decided_at = datetime('now') WHERE id = ?`, decision, req.user!.id, note, a.id);
    if (decision === 'upheld') {
      if (a.subject_type === 'restriction') q.run(`UPDATE account_restrictions SET lifted_at = datetime('now'), lifted_by = ? WHERE id = ?`, req.user!.id, a.subject_id);
      if (a.subject_type === 'fraud_flag') q.run(`UPDATE fraud_flags SET status = 'dismissed', review_note = ? WHERE id = ?`, `Appeal upheld: ${note}`, a.subject_id);
      if (a.subject_type === 'verification') {
        const v = q.get<Row>('SELECT * FROM verification_applications WHERE id = ?', a.subject_id)!;
        q.run(`UPDATE verification_applications SET status = 'under_review', decided_at = NULL WHERE id = ?`, v.id);
        q.run(`INSERT INTO verification_events (application_id, actor_id, action, note) VALUES (?, ?, 'reopened_on_appeal', ?)`, v.id, req.user!.id, note);
        if (v.kind === 'buyer_business') q.run(`UPDATE buyer_profiles SET status = 'under_review' WHERE user_id = ?`, v.user_id);
      }
    }
  });
  notifyT(a.user_id, 'system', 'verification_update', { status: `appeal ${decision}` }, `appeal:${a.id}`, '/account/verification');
  audit(req, `appeal.${decision}`, 'appeal', a.id, { note });
  res.json({ ok: true });
}));

// ---------------- Rules & fees ----------------
opsRouter.get('/settings', requirePerm('settings.manage', 'analytics.view'), (_req, res) => {
  res.json({ settings: allSettings(), defaults: SETTING_DEFAULTS });
});

opsRouter.put('/settings', requirePerm('settings.manage'), ah(async (req, res) => {
  const b = parse(z.record(z.union([z.number().min(0).max(1e9), z.null()])), req.body);
  for (const [k, v] of Object.entries(b)) {
    if (!(k in SETTING_DEFAULTS)) throw new HttpError(400, `Unknown setting ${k}`, 'validation_error');
    if (v === null && k !== 'transport_rate_per_qtl_km') throw new HttpError(400, `${k} cannot be empty`, 'validation_error');
    if (k.endsWith('_pct') && (v ?? 0) > 50) throw new HttpError(400, `${k} looks too high`, 'validation_error');
  }
  const before = allSettings();
  for (const [k, v] of Object.entries(b)) setSetting(k as SettingKey, v, req.user!.id);
  audit(req, 'settings.update', 'settings', 'marketplace', { before: Object.fromEntries(Object.keys(b).map((k) => [k, before[k]])), after: b });
  res.json({ settings: allSettings() });
}));

// ---------------- Administrator accounts (super admin only) ----------------
opsRouter.get('/admins', requirePerm('admins.manage'), ah(async (_req, res) => {
  res.json({
    admins: q.all(`SELECT id, full_name, phone, role, status, created_at FROM users WHERE role IN (${STAFF_ROLES.map(() => '?').join(',')}) ORDER BY created_at`, ...STAFF_ROLES)
      .map((u: Row) => ({ ...u, role_label: ROLE_LABELS[u.role], permissions: permissionsFor(u.role) })),
    roles: STAFF_ROLES.filter((r) => r !== 'super_admin').map((r) => ({ role: r, label: ROLE_LABELS[r], permissions: permissionsFor(r) })),
  });
}));

opsRouter.post('/admins', requirePerm('admins.manage'), ah(async (req, res) => {
  const b = parse(z.object({ full_name: zText(100), phone: zPhone, password: zStaffPassword, role: z.enum(STAFF_ROLES.filter((r) => r !== 'super_admin') as [string, ...string[]]) }), req.body);
  if (q.get('SELECT 1 FROM users WHERE phone = ?', b.phone)) throw new HttpError(409, 'This mobile number already has an account', 'phone_taken');
  const uid = id();
  insert('users', { id: uid, phone: b.phone, phone_verified: 1, password_hash: hashPassword(b.password), full_name: b.full_name, role: b.role, onboarding_complete: 1, data_consent_at: new Date().toISOString() });
  audit(req, 'admin.create', 'user', uid, { role: b.role });
  res.status(201).json({ id: uid });
}));

opsRouter.patch('/admins/:id', requirePerm('admins.manage'), ah(async (req, res) => {
  const b = parse(z.object({ role: z.enum(STAFF_ROLES.filter((r) => r !== 'super_admin') as [string, ...string[]]).optional(), status: z.enum(['active', 'suspended']).optional() }), req.body);
  const u = q.get<Row>('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!u || !(STAFF_ROLES as readonly string[]).includes(u.role)) throw notFound('Administrator');
  if (u.id === req.user!.id) throw new HttpError(400, 'You cannot change your own account here', 'self_change');
  if (u.role === 'super_admin') throw forbidden('Super administrator accounts are managed through the bootstrap process');
  const set = updateSet(b);
  if (!set.empty) q.run(`UPDATE users SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, u.id);
  q.run('DELETE FROM sessions WHERE user_id = ?', u.id); // immediate revocation on any change
  audit(req, 'admin.update', 'user', u.id, b);
  res.json({ ok: true });
}));

// ---------------- Audit & analytics ----------------
opsRouter.get('/audit', requirePerm('audit.view'), ah(async (req, res) => {
  const { action, actor, target } = req.query as Record<string, string | undefined>;
  const where: string[] = [];
  const params: unknown[] = [];
  if (action) { where.push('a.action LIKE ?'); params.push(`${action}%`); }
  if (actor) { where.push('a.actor_id = ?'); params.push(actor); }
  if (target) { where.push('a.target_id = ?'); params.push(target); }
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.json({ logs: q.all(`SELECT a.*, u.full_name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY a.id DESC LIMIT 100 OFFSET ?`, ...params, offset) });
}));

opsRouter.get('/documents/:id/access-log', requirePerm('documents.view'), ah(async (req, res) => {
  res.json({ log: q.all('SELECT l.action, l.created_at, u.full_name FROM document_access_log l LEFT JOIN users u ON u.id = l.user_id WHERE l.document_id = ? ORDER BY l.id DESC', req.params.id) });
}));

opsRouter.get('/analytics', requirePerm('analytics.view'), ah(async (_req, res) => {
  const n = (sql: string, ...p: unknown[]) => q.get<Row>(sql, ...p)!.n ?? 0;
  const facilities = q.all<Row>(`SELECT id, name, total_capacity_qtl FROM storage_facilities WHERE status = 'verified'`);
  const occ = facilities.map((f) => ({ name: f.name, total: f.total_capacity_qtl, ...occupancyToday(f.id) }));
  res.json({
    active_verified_farmers: n(`SELECT COUNT(*) n FROM users WHERE role = 'farmer' AND status = 'active' AND state IS NOT NULL AND district IS NOT NULL AND village IS NOT NULL`),
    identity_verified_farmers: n(`SELECT COUNT(*) n FROM users WHERE role = 'farmer' AND farmer_level >= 3`),
    active_verified_buyers: n(`SELECT COUNT(*) n FROM buyer_profiles b JOIN users u ON u.id = b.user_id WHERE b.status = 'verified' AND u.status = 'active'`),
    pending_verifications: q.all(`SELECT kind, COUNT(*) n FROM verification_applications WHERE status IN ('submitted','under_review') GROUP BY kind`),
    published_lots: n(`SELECT COUNT(*) n FROM produce_lots WHERE status IN ('published','offer_received','negotiation','reserved','partially_sold')`),
    active_demand: n(`SELECT COUNT(*) n FROM demand_requests WHERE status IN ('open','partially_filled')`),
    offers_received_30d: n(`SELECT COUNT(DISTINCT thread_id) n FROM offers WHERE created_at > datetime('now','-30 day')`),
    offers_accepted_30d: n(`SELECT COUNT(*) n FROM offers WHERE status = 'accepted' AND responded_at > datetime('now','-30 day')`),
    orders_by_status: q.all(`SELECT status, COUNT(*) n, SUM(product_value) value FROM orders GROUP BY status`),
    avg_completion_days: q.get<Row>(`SELECT ROUND(AVG(julianday(completed_at) - julianday(created_at)), 1) n FROM orders WHERE status = 'completed'`)!.n,
    storage: { facilities: facilities.length, occupancy: occ, bookings_by_status: q.all(`SELECT status, COUNT(*) n FROM storage_bookings GROUP BY status`) },
    disputes: {
      by_status: q.all(`SELECT status, COUNT(*) n FROM disputes GROUP BY status`),
      avg_resolution_days: q.get<Row>(`SELECT ROUND(AVG(julianday(decided_at) - julianday(created_at)), 1) n FROM disputes WHERE decided_at IS NOT NULL`)!.n,
    },
    payments_by_status: q.all(`SELECT status, COUNT(*) n, SUM(amount) total FROM payment_records GROUP BY status`),
    suspicious_activity: { open_flags: n(`SELECT COUNT(*) n FROM fraud_flags WHERE status = 'open'`), open_reports: n(`SELECT COUNT(*) n FROM user_reports WHERE status IN ('open','investigating')`) },
    generated_at: new Date().toISOString(),
  });
}));

/**
 * Platform fee report, calculated from the fee breakdown frozen on each order at
 * confirmation. "Earned" counts completed orders only; open orders are shown as
 * pending. Nothing here is an invoice or a settlement statement.
 */
opsRouter.get('/revenue', requirePerm('analytics.view'), ah(async (_req, res) => {
  const fee = (col: string) => `COALESCE(json_extract(breakdown, '$.${col}'), 0)`;
  const rows = q.all<Row>(`SELECT strftime('%Y-%m', created_at) month,
      CASE WHEN status = 'completed' THEN 'earned' WHEN status IN ('cancelled','rejected') THEN 'void' ELSE 'pending' END bucket,
      COUNT(*) orders, ROUND(SUM(product_value), 2) gmv,
      ROUND(SUM(${fee('platform_fee_buyer')}), 2) buyer_fees, ROUND(SUM(${fee('platform_fee_farmer')}), 2) farmer_fees, ROUND(SUM(${fee('tax_on_fees')}), 2) tax_on_fees
    FROM orders GROUP BY month, bucket ORDER BY month DESC LIMIT 72`);
  res.json({
    rows,
    current_rates: (({ platform_fee_buyer_pct, platform_fee_farmer_pct, tax_on_fees_pct }) => ({ buyer_pct: platform_fee_buyer_pct, farmer_pct: platform_fee_farmer_pct, tax_on_fees_pct }))(allSettings()),
    note: 'Fees are calculated by the server from the rates in force when each order was confirmed. Earned = completed orders. Void orders are listed for completeness and are not revenue.',
    generated_at: new Date().toISOString(),
  });
}));

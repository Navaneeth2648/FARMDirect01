import { Router } from 'express';
import { z } from 'zod';
import { q, out, insert, updateSet, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, notFound, parse, zText } from '../lib/http.ts';
import { requireRole, ROLES } from '../lib/auth.ts';
import { audit } from '../lib/security.ts';
import { notify } from '../services/notify.ts';
import { config } from '../config.ts';
import { aiConfigured } from '../providers/ai.ts';
import { mandiConfigured } from '../providers/mandi.ts';
import { smsConfigured } from '../providers/sms.ts';
import { satelliteConfigured } from '../providers/satellite.ts';
import { razorpayConfigured } from '../providers/razorpay.ts';
import { isStaffRole } from '../lib/permissions.ts';

export const adminRouter = Router();
adminRouter.use(requireRole('admin'));

// ---------- Users ----------
adminRouter.get('/users', ah(async (req, res) => {
  const { q: search, role, status, verification } = req.query as Record<string, string | undefined>;
  const where: string[] = [];
  const params: unknown[] = [];
  if (search) { where.push('(full_name LIKE ? OR phone LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (role) { where.push('role = ?'); params.push(role); }
  if (status) { where.push('status = ?'); params.push(status); }
  if (verification) { where.push('verification_status = ?'); params.push(verification); }
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  res.json({
    users: q.all(`SELECT id, full_name, phone, role, status, verification_status, state, district, language, created_at FROM users ${w} ORDER BY created_at DESC LIMIT 50 OFFSET ?`, ...params, offset),
    total: q.get<Row>(`SELECT COUNT(*) n FROM users ${w}`, ...params)!.n,
  });
}));

adminRouter.patch('/users/:id', ah(async (req, res) => {
  const b = parse(z.object({
    role: z.enum(ROLES).optional(), status: z.enum(['active', 'suspended']).optional(),
    verification_status: z.enum(['pending', 'verified', 'rejected', 'not_required']).optional(),
  }), req.body);
  const target = q.get<Row>('SELECT * FROM users WHERE id = ?', req.params.id);
  if (!target) throw notFound('User');
  const actorIsSuper = req.user!.role === 'super_admin';
  // Only a super admin can grant/revoke administrator roles or act on other administrators.
  if (!actorIsSuper && (isStaffRole(target.role) || isStaffRole(b.role))) {
    throw forbidden('Only a super administrator can change administrator accounts');
  }
  if (target.id === req.user!.id && (b.role || b.status)) throw new HttpError(400, 'You cannot change your own role or status', 'self_change');
  const set = updateSet(b);
  if (!set.empty) q.run(`UPDATE users SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, target.id);
  // Role changes and suspensions take effect immediately.
  if (b.status === 'suspended' || (b.role && b.role !== target.role)) q.run('DELETE FROM sessions WHERE user_id = ?', target.id);
  if (b.role === 'buyer' && !q.get('SELECT 1 FROM buyer_profiles WHERE user_id = ?', target.id)) q.run(`INSERT INTO buyer_profiles (user_id) VALUES (?)`, target.id);
  if (b.verification_status === 'verified' || b.verification_status === 'rejected') {
    notify(target.id, 'system', `Your professional account was ${b.verification_status}`, 'Contact support if you have questions.', `verify:${target.id}:${b.verification_status}`);
  }
  audit(req, 'admin.user_update', 'user', target.id, b);
  res.json({ user: out(q.get('SELECT * FROM users WHERE id = ?', target.id)) });
}));

adminRouter.get('/deletion-requests', ah(async (_req, res) => {
  res.json({ items: q.all('SELECT * FROM deletion_requests ORDER BY created_at DESC LIMIT 200') });
}));

// ---------- Verification queues ----------
adminRouter.get('/providers', ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'pending';
  res.json({ providers: q.all('SELECT sp.*, u.full_name AS owner_name FROM service_providers sp LEFT JOIN users u ON u.id = sp.owner_id WHERE sp.verification_status = ? ORDER BY sp.created_at', status) });
}));

adminRouter.post('/providers/:id/verify', ah(async (req, res) => {
  const { decision } = parse(z.object({ decision: z.enum(['verified', 'rejected']) }), req.body);
  const p = q.get<Row>('SELECT * FROM service_providers WHERE id = ?', req.params.id);
  if (!p) throw notFound('Provider');
  q.run(`UPDATE service_providers SET verification_status = ?, verified_by = ?, verified_at = datetime('now') WHERE id = ?`, decision, req.user!.id, p.id);
  if (p.owner_id) notify(p.owner_id, 'system', `Your listing "${p.name}" was ${decision}`, '', `provider:${p.id}:${decision}:${Date.now()}`, '/experts');
  audit(req, `provider.${decision}`, 'provider', p.id);
  res.json({ ok: true });
}));

adminRouter.get('/suspicious-reports', ah(async (_req, res) => {
  res.json({ items: q.all('SELECT * FROM suspicious_reports ORDER BY created_at DESC LIMIT 200') });
}));

adminRouter.get('/market-feedback', ah(async (_req, res) => {
  res.json({ items: q.all(`SELECT mf.*, mp.market, mp.commodity, mp.arrival_date FROM market_feedback mf LEFT JOIN market_prices mp ON mp.id = mf.price_id ORDER BY mf.created_at DESC LIMIT 200`) });
}));

// ---------- Crop catalogue ----------
const CropSchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]{2,40}$/), name: zText(100), category: z.enum(['cereal', 'pulse', 'oilseed', 'vegetable', 'fruit', 'cash', 'spice', 'other']),
  local_names: z.record(z.string()).default({}), seasons: z.array(z.string()).default([]), regions: z.array(z.string()).default([]),
  agmarknet_name: z.string().max(100).optional().nullable(), active: z.boolean().default(true),
});

adminRouter.post('/crops', ah(async (req, res) => {
  const d = parse(CropSchema, req.body);
  insert('crops', d);
  audit(req, 'crop.create', 'crop', d.id);
  res.status(201).json({ crop: out(q.get('SELECT * FROM crops WHERE id = ?', d.id)) });
}));

adminRouter.patch('/crops/:id', ah(async (req, res) => {
  const set = updateSet(parse(CropSchema.partial().omit({ id: true }), req.body));
  if (!set.empty) q.run(`UPDATE crops SET ${set.sql} WHERE id = ?`, ...set.values, req.params.id);
  audit(req, 'crop.update', 'crop', req.params.id);
  res.json({ crop: out(q.get('SELECT * FROM crops WHERE id = ?', req.params.id)) });
}));

adminRouter.put('/crops/:id/stages', ah(async (req, res) => {
  const stages = parse(z.array(z.object({
    key: z.string().regex(/^[a-z_]{2,40}$/), name: zText(100), start_day: z.number().int().min(-120).max(800), end_day: z.number().int().min(-120).max(800),
    water_need: z.enum(['low', 'medium', 'high', 'critical']),
  })).min(1).max(20), req.body);
  if (stages.some((s) => s.end_day < s.start_day)) throw new HttpError(400, 'Stage end must be after start', 'bad_stage');
  q.tx(() => {
    q.run('DELETE FROM crop_stages WHERE crop_id = ?', req.params.id);
    stages.forEach((s, i) => q.run('INSERT INTO crop_stages (crop_id, seq, key, name, start_day, end_day, water_need) VALUES (?, ?, ?, ?, ?, ?, ?)',
      req.params.id, i + 1, s.key, s.name, s.start_day, s.end_day, s.water_need));
  });
  audit(req, 'crop.stages_update', 'crop', req.params.id);
  res.json({ ok: true });
}));

adminRouter.get('/advisories', ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'needs_review';
  res.json({ advisories: q.all('SELECT a.*, c.name AS crop_name FROM advisories a LEFT JOIN crops c ON c.id = a.crop_id WHERE review_status = ? ORDER BY crop_id, stage_key LIMIT 300', status) });
}));

adminRouter.get('/diagnoses', ah(async (_req, res) => {
  res.json({
    outcomes: q.all('SELECT status, expert_status, COUNT(*) n FROM diagnoses GROUP BY status, expert_status'),
    recent: q.all(`SELECT d.id, d.status, d.confidence, d.expert_status, d.created_at, c.name AS crop_name FROM diagnoses d LEFT JOIN crops c ON c.id = d.crop_id ORDER BY d.created_at DESC LIMIT 50`),
  });
}));

// ---------- Monitoring ----------
adminRouter.get('/stats', ah(async (_req, res) => {
  const one = (sql: string, ...p: unknown[]) => q.get<Row>(sql, ...p)!.n;
  res.json({
    users: {
      total: one('SELECT COUNT(*) n FROM users'),
      active7d: one(`SELECT COUNT(DISTINCT user_id) n FROM sessions WHERE created_at > datetime('now', '-7 day')`),
      byRole: q.all('SELECT role, COUNT(*) n FROM users GROUP BY role'),
      pendingVerification: one(`SELECT COUNT(*) n FROM users WHERE verification_status = 'pending'`),
    },
    registrations: q.all(`SELECT date(created_at) d, COUNT(*) n FROM users WHERE created_at > datetime('now', '-30 day') GROUP BY d ORDER BY d`),
    moduleUsage: q.all(`SELECT module, COUNT(*) n FROM usage_events WHERE created_at > datetime('now', '-30 day') GROUP BY module ORDER BY n DESC`),
    apiHealth: q.all(`SELECT provider, operation, SUM(ok) ok, COUNT(*) - SUM(ok) failed, CAST(AVG(latency_ms) AS INT) avg_ms, MAX(created_at) last
      FROM api_events WHERE created_at > datetime('now', '-1 day') GROUP BY provider, operation`),
    aiRequests: one(`SELECT COUNT(*) n FROM api_events WHERE provider = 'gemini' AND created_at > datetime('now', '-30 day')`),
    diagnosisOutcomes: q.all('SELECT status, COUNT(*) n FROM diagnoses GROUP BY status'),
    notificationDelivery: q.all(`SELECT channel, status, COUNT(*) n FROM delivery_logs WHERE created_at > datetime('now', '-7 day') GROUP BY channel, status`),
    dataFreshness: {
      marketLastFetch: q.get<Row>('SELECT MAX(fetched_at) v FROM market_prices')?.v ?? null,
      weatherLastFetch: q.get<Row>('SELECT MAX(fetched_at) v FROM weather_cache')?.v ?? null,
      schemesUnverified: one('SELECT COUNT(*) n FROM schemes WHERE last_verified_at IS NULL AND active = 1'),
      advisoriesPendingReview: one(`SELECT COUNT(*) n FROM advisories WHERE review_status = 'needs_review'`),
    },
    reportedContent: one(`SELECT COUNT(*) n FROM content_reports WHERE status = 'open'`),
    openCases: one(`SELECT COUNT(*) n FROM expert_cases WHERE status IN ('open','assigned','escalated')`),
  });
}));

adminRouter.get('/integrations', (_req, res) => {
  res.json({
    integrations: [
      { name: 'Weather (Open-Meteo)', configured: true, note: config.weather.apiKey ? 'Commercial API key set' : 'Free non-commercial tier (no key). Use OPEN_METEO_API_KEY for commercial use.' },
      { name: 'Mandi prices (Agmarknet / data.gov.in)', configured: mandiConfigured(), env: 'DATA_GOV_IN_API_KEY' },
      { name: 'AI – Crop Doctor & Assistant (Gemini)', configured: aiConfigured(), env: 'GEMINI_API_KEY', model: config.gemini.model },
      { name: 'SMS / OTP', configured: smsConfigured(), env: 'SMS_PROVIDER + MSG91_* or TWILIO_*', note: smsConfigured() ? undefined : 'Development mode prints OTPs to the server console.' },
      { name: 'Satellite NDVI (Sentinel Hub)', configured: satelliteConfigured(), env: 'SENTINELHUB_CLIENT_ID / SENTINELHUB_CLIENT_SECRET' },
      { name: 'Push / email notifications', configured: false, note: 'Not implemented in this deployment; in-app notifications are active.' },
      { name: 'Online payments (Razorpay)', configured: razorpayConfigured(), env: 'RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET / RAZORPAY_WEBHOOK_SECRET', note: razorpayConfigured() ? undefined : 'Without it, payments are recorded by the payer and confirmed by the recipient. No escrow is offered.' },
      { name: 'Administrator MFA (OTP)', configured: config.adminMfa && (smsConfigured() || !config.isProd), note: config.adminMfa ? (smsConfigured() ? 'OTP sent by SMS' : 'Development: OTP shown on screen. Production requires an SMS provider.') : 'Disabled (ADMIN_MFA=off) – local use only' },
    ],
  });
});

adminRouter.get('/audit', ah(async (req, res) => {
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.json({ logs: q.all(`SELECT a.*, u.full_name AS actor_name FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 100 OFFSET ?`, offset) });
}));

adminRouter.post('/broadcast', ah(async (req, res) => {
  const b = parse(z.object({ title: zText(150), body: zText(1000), state: z.string().optional().nullable(), kind: z.enum(['system', 'scheme', 'content']).default('system') }), req.body);
  const users = q.all<Row>(`SELECT id FROM users WHERE status = 'active' ${b.state ? 'AND state = ?' : ''}`, ...(b.state ? [b.state] : []));
  const key = `broadcast:${Date.now()}`;
  for (const u of users) notify(u.id, b.kind, b.title, b.body, key);
  audit(req, 'admin.broadcast', 'notification', key, { count: users.length });
  res.json({ notified: users.length });
}));

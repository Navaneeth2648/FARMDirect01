import { Router } from 'express';
import { z } from 'zod';
import { q, out, insert, updateSet, type Row } from '../db/index.ts';
import { ah, forbidden, id, notFound, parse, zOptText, zText } from '../lib/http.ts';
import { requireRole, isStaff } from '../lib/auth.ts';
import { audit } from '../lib/security.ts';
import { notify } from '../services/notify.ts';

/** Knowledge centre, news and events. Editorial workflow: draft → in_review → published. */
export const contentRouter = Router();

const TYPES = ['article', 'guide', 'video', 'audio', 'infographic', 'news', 'event', 'success_story', 'webinar', 'training'] as const;

const ContentSchema = z.object({
  type: z.enum(TYPES), title: zText(200), summary: zOptText(500), body: zOptText(50000),
  media_url: z.string().url().optional().nullable(), transcript: zOptText(50000),
  language: z.enum(['en', 'hi', 'te', 'ml']).default('en'),
  crop_ids: z.array(z.string()).max(20).default([]), regions: z.array(z.string()).max(40).default([]), tags: z.array(z.string().max(40)).max(20).default([]),
  event_date: z.string().optional().nullable(), event_location: zOptText(200),
  source_name: zOptText(200), source_url: z.string().url().optional().nullable(), license: zOptText(200),
  safety_critical: z.boolean().default(false),
});

const readingTime = (body?: string | null) => (body ? Math.max(1, Math.round(body.split(/\s+/).length / 200)) : null);

contentRouter.get('/', ah(async (req, res) => {
  const { type, crop, region, lang, q: search, kind } = req.query as Record<string, string | undefined>;
  const where = [`c.status = 'published'`];
  const params: unknown[] = [];
  if (type) { where.push('c.type = ?'); params.push(type); }
  if (kind === 'news') where.push(`c.type IN ('news','event','webinar','training')`);
  if (kind === 'knowledge') where.push(`c.type NOT IN ('news','event','webinar','training')`);
  if (crop) { where.push(`c.crop_ids LIKE ?`); params.push(`%"${crop}"%`); }
  if (region) { where.push(`(c.regions = '[]' OR c.regions LIKE ?)`); params.push(`%"${region}"%`); }
  if (lang) { where.push('c.language = ?'); params.push(lang); }
  if (search) { where.push('(c.title LIKE ? OR c.summary LIKE ? OR c.tags LIKE ?)'); params.push(`%${search}%`, `%${search}%`, `%${search}%`); }
  const limit = Math.min(Number(req.query.limit) || 24, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const rows = q.all<Row>(`SELECT c.*, u.full_name AS author_name FROM content c LEFT JOIN users u ON u.id = c.author_id
    WHERE ${where.join(' AND ')} ORDER BY COALESCE(c.event_date, c.published_at) DESC LIMIT ? OFFSET ?`, ...params, limit, offset);
  res.json({ items: rows.map((r) => ({ ...out(r), body: undefined, reading_minutes: readingTime(r.body) })) });
}));

contentRouter.get('/manage', requireRole('content_editor', 'expert', 'admin'), ah(async (req, res) => {
  const mine = isStaff(req.user) || req.user!.role === 'content_editor' ? '' : 'WHERE author_id = ?';
  res.json({ items: q.all(`SELECT id, type, title, status, language, safety_critical, updated_at FROM content ${mine} ORDER BY updated_at DESC LIMIT 200`, ...(mine ? [req.user!.id] : [])) });
}));

contentRouter.get('/:id', ah(async (req, res) => {
  const c = q.get<Row>(`SELECT c.*, u.full_name AS author_name, u.role AS author_role FROM content c LEFT JOIN users u ON u.id = c.author_id WHERE c.id = ?`, req.params.id);
  const editor = req.user && ['content_editor', 'admin', 'super_admin'].includes(req.user.role);
  if (!c || (c.status !== 'published' && !editor && c.author_id !== req.user?.id)) throw notFound('Content');
  const related = q.all(`SELECT id, title, type FROM content WHERE status = 'published' AND id != ? AND (type = ? OR crop_ids = ?) ORDER BY published_at DESC LIMIT 4`,
    c.id, c.type, c.crop_ids);
  const fb = q.get<Row>('SELECT SUM(helpful) AS yes, COUNT(*) AS total FROM content_feedback WHERE content_id = ?', c.id);
  res.json({ item: { ...out(c), reading_minutes: readingTime(c.body) }, related, feedback: fb });
}));

contentRouter.post('/', requireRole('content_editor', 'expert', 'admin'), ah(async (req, res) => {
  const d = parse(ContentSchema, req.body);
  const cid = id();
  insert('content', { id: cid, ...d, author_id: req.user!.id, status: 'draft' });
  audit(req, 'content.create', 'content', cid);
  res.status(201).json({ item: out(q.get('SELECT * FROM content WHERE id = ?', cid)) });
}));

contentRouter.patch('/:id', requireRole('content_editor', 'expert', 'admin'), ah(async (req, res) => {
  const c = q.get<Row>('SELECT * FROM content WHERE id = ?', req.params.id);
  if (!c) throw notFound('Content');
  if (c.author_id !== req.user!.id && !['content_editor', 'admin', 'super_admin'].includes(req.user!.role)) throw forbidden();
  const set = updateSet(parse(ContentSchema.partial(), req.body));
  // Editing published content sends it back to review.
  if (!set.empty) q.run(`UPDATE content SET ${set.sql}, status = CASE WHEN status = 'published' THEN 'in_review' ELSE status END, updated_at = datetime('now') WHERE id = ?`, ...set.values, c.id);
  audit(req, 'content.update', 'content', c.id);
  res.json({ item: out(q.get('SELECT * FROM content WHERE id = ?', c.id)) });
}));

contentRouter.post('/:id/submit', requireRole('content_editor', 'expert', 'admin'), ah(async (req, res) => {
  q.run(`UPDATE content SET status = 'in_review', updated_at = datetime('now') WHERE id = ? AND status = 'draft'`, req.params.id);
  res.json({ ok: true });
}));

/**
 * Publishing: content editors/admins publish. Safety-critical content (e.g.
 * crop-protection guidance or translations of it) must be published by a
 * verified expert or admin.
 */
contentRouter.post('/:id/publish', requireRole('content_editor', 'expert', 'admin'), ah(async (req, res) => {
  const c = q.get<Row>('SELECT * FROM content WHERE id = ?', req.params.id);
  if (!c) throw notFound('Content');
  if (req.user!.role === 'expert' && c.author_id === req.user!.id && !c.safety_critical) {
    throw forbidden('Content must be published by an editor or another reviewer');
  }
  if (c.safety_critical && !['expert', 'admin', 'super_admin'].includes(req.user!.role)) {
    throw forbidden('Safety-critical content must be approved by a verified expert or administrator');
  }
  q.run(`UPDATE content SET status = 'published', published_at = COALESCE(published_at, datetime('now')), updated_at = datetime('now') WHERE id = ?`, c.id);
  audit(req, 'content.publish', 'content', c.id);
  // Notify users who grow a tagged crop.
  const crops: string[] = JSON.parse(c.crop_ids || '[]');
  if (crops.length) {
    const users = q.all<Row>(`SELECT DISTINCT user_id FROM crop_cycles WHERE status = 'active' AND crop_id IN (${crops.map(() => '?').join(',')})`, ...crops);
    for (const u of users) notify(u.user_id, 'content', 'New expert content', c.title, `content:${c.id}`, `/knowledge/${c.id}`);
  }
  res.json({ ok: true });
}));

contentRouter.post('/:id/archive', requireRole('content_editor', 'admin'), ah(async (req, res) => {
  q.run(`UPDATE content SET status = 'archived', updated_at = datetime('now') WHERE id = ?`, req.params.id);
  audit(req, 'content.archive', 'content', req.params.id);
  res.json({ ok: true });
}));

contentRouter.post('/:id/feedback', ah(async (req, res) => {
  const b = parse(z.object({ helpful: z.boolean(), comment: zOptText(1000) }), req.body);
  if (!q.get(`SELECT 1 FROM content WHERE id = ? AND status = 'published'`, req.params.id)) throw notFound('Content');
  q.run(`INSERT INTO content_feedback (id, content_id, user_id, helpful, comment) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(content_id, user_id) DO UPDATE SET helpful = excluded.helpful, comment = excluded.comment`,
    id(), req.params.id, req.user!.id, b.helpful ? 1 : 0, b.comment ?? null);
  res.json({ ok: true });
}));

// ---- Government schemes ----
export const schemesRouter = Router();

schemesRouter.get('/', ah(async (req, res) => {
  const { state, type, category, crop, level } = req.query as Record<string, string | undefined>;
  const where = ['active = 1'];
  const params: unknown[] = [];
  if (level) { where.push('level = ?'); params.push(level); }
  if (state) { where.push(`(level = 'central' OR state = ?)`); params.push(state); }
  if (type) { where.push('scheme_type = ?'); params.push(type); }
  if (category) { where.push(`(farmer_categories LIKE '%"all"%' OR farmer_categories LIKE ?)`); params.push(`%"${category}"%`); }
  if (crop) { where.push(`(crop_ids = '[]' OR crop_ids LIKE ?)`); params.push(`%"${crop}"%`); }
  res.json({
    schemes: q.all(`SELECT * FROM schemes WHERE ${where.join(' AND ')} ORDER BY level, name`, ...params).map(out),
    disclaimer: 'Information is summarised from official sources. Eligibility and benefits are decided by the implementing government department; always confirm on the official website.',
  });
}));

const SchemeSchema = z.object({
  name: zText(200), department: zText(200), level: z.enum(['central', 'state']), state: zOptText(80),
  scheme_type: z.enum(['income_support', 'insurance', 'credit', 'irrigation', 'soil', 'market', 'subsidy', 'mechanisation', 'other']),
  farmer_categories: z.array(z.string()).default(['all']), crop_ids: z.array(z.string()).default([]),
  eligibility: zText(5000), benefits: zText(5000), documents: zOptText(3000), process: zOptText(3000), deadline: zOptText(100),
  official_url: z.string().url().refine((u) => /\.(gov|nic)\.in(\/|$)/.test(new URL(u).hostname + '/'), 'Use an official .gov.in or .nic.in URL'),
  active: z.boolean().default(true),
});

schemesRouter.post('/', requireRole('admin', 'content_editor'), ah(async (req, res) => {
  const d = parse(SchemeSchema, req.body);
  const sid = id();
  insert('schemes', { id: sid, ...d });
  audit(req, 'scheme.create', 'scheme', sid);
  res.status(201).json({ scheme: out(q.get('SELECT * FROM schemes WHERE id = ?', sid)) });
}));

schemesRouter.patch('/:id', requireRole('admin', 'content_editor'), ah(async (req, res) => {
  const set = updateSet(parse(SchemeSchema.partial(), req.body));
  if (!set.empty) q.run(`UPDATE schemes SET ${set.sql}, last_verified_at = NULL, updated_at = datetime('now') WHERE id = ?`, ...set.values, req.params.id);
  audit(req, 'scheme.update', 'scheme', req.params.id);
  res.json({ scheme: out(q.get('SELECT * FROM schemes WHERE id = ?', req.params.id)) });
}));

/** Marks a scheme as checked against its official source today. */
schemesRouter.post('/:id/verify', requireRole('admin', 'content_editor'), ah(async (req, res) => {
  const r = q.run(`UPDATE schemes SET last_verified_at = datetime('now'), verified_by = ? WHERE id = ?`, req.user!.id, req.params.id);
  if (!r.changes) throw notFound('Scheme');
  audit(req, 'scheme.verify', 'scheme', req.params.id);
  res.json({ ok: true });
}));

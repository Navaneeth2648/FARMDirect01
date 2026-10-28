import { Router } from 'express';
import { z } from 'zod';
import { q, insert, type Row } from '../db/index.ts';
import { ah, id, notFound, parse, zOptText, zText } from '../lib/http.ts';
import { requireRole } from '../lib/auth.ts';
import { audit } from '../lib/security.ts';
import { notify } from '../services/notify.ts';

export const alertsRouter = Router();

/** Alerts relevant to a user: their farm-specific alerts, alerts for their farms' regions, and subscriptions. */
export function alertsForUser(userId: string, limit = 50) {
  return q.all<Row>(
    `SELECT a.*, CASE WHEN r.alert_id IS NULL THEN 0 ELSE 1 END AS is_read FROM alerts a
     LEFT JOIN alert_reads r ON r.alert_id = a.id AND r.user_id = ?
     WHERE a.expires_at > datetime('now') AND (
       a.user_id = ?
       OR (a.user_id IS NULL AND (
         EXISTS (SELECT 1 FROM farms f WHERE f.user_id = ? AND (a.state IS NULL OR a.state = f.state) AND (a.district IS NULL OR a.district = f.district))
         OR EXISTS (SELECT 1 FROM alert_subscriptions s WHERE s.user_id = ? AND (s.state IS NULL OR a.state IS NULL OR s.state = a.state)
                    AND (s.district IS NULL OR a.district IS NULL OR s.district = a.district) AND (s.crop_id IS NULL OR a.crop_id IS NULL OR s.crop_id = a.crop_id))
         OR EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND a.state IS NOT NULL AND u.state = a.state AND (a.district IS NULL OR a.district = u.district))
       ))
     )
     AND (a.crop_id IS NULL OR a.user_id IS NOT NULL OR EXISTS (SELECT 1 FROM crop_cycles cc WHERE cc.user_id = ? AND cc.crop_id = a.crop_id AND cc.status = 'active')
          OR EXISTS (SELECT 1 FROM alert_subscriptions s2 WHERE s2.user_id = ? AND s2.crop_id = a.crop_id))
     ORDER BY CASE a.severity WHEN 'severe' THEN 0 WHEN 'warning' THEN 1 WHEN 'advisory' THEN 2 ELSE 3 END, a.created_at DESC
     LIMIT ?`,
    userId, userId, userId, userId, userId, userId, userId, limit);
}

alertsRouter.get('/', ah(async (req, res) => {
  const alerts = alertsForUser(req.user!.id).map((a) => ({
    ...a,
    affected_farms: q.all('SELECT id, name FROM farms WHERE user_id = ? AND (? IS NULL OR state = ?) AND (? IS NULL OR district = ?)',
      req.user!.id, a.state, a.state, a.district, a.district),
  }));
  res.json({ alerts });
}));

alertsRouter.post('/:id/read', ah(async (req, res) => {
  q.run('INSERT OR IGNORE INTO alert_reads (alert_id, user_id) VALUES (?, ?)', req.params.id, req.user!.id);
  res.json({ ok: true });
}));

alertsRouter.get('/subscriptions', ah(async (req, res) => {
  res.json({ subscriptions: q.all('SELECT * FROM alert_subscriptions WHERE user_id = ?', req.user!.id) });
}));

alertsRouter.post('/subscriptions', ah(async (req, res) => {
  const b = parse(z.object({ state: zOptText(80), district: zOptText(80), crop_id: z.string().optional().nullable() }), req.body);
  q.run('INSERT OR IGNORE INTO alert_subscriptions (id, user_id, state, district, crop_id) VALUES (?, ?, ?, ?, ?)',
    id(), req.user!.id, b.state ?? null, b.district ?? null, b.crop_id ?? null);
  res.status(201).json({ ok: true });
}));

alertsRouter.delete('/subscriptions/:id', ah(async (req, res) => {
  q.run('DELETE FROM alert_subscriptions WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  res.json({ ok: true });
}));

// ---- Issuing alerts (verified sources only: admins, verified experts / field agents) ----
const AlertSchema = z.object({
  category: z.enum(['pest', 'disease', 'heavy_rain', 'flood', 'drought', 'heat', 'wind', 'cold', 'other']),
  severity: z.enum(['info', 'advisory', 'warning', 'severe']),
  title: zText(200), body: zText(3000), precautions: zOptText(3000),
  state: zOptText(80), district: zOptText(80), crop_id: z.string().optional().nullable(),
  source: zText(200), source_url: z.string().url().optional().nullable(),
  expires_at: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
});

alertsRouter.post('/', requireRole('admin', 'expert', 'field_agent'), ah(async (req, res) => {
  const d = parse(AlertSchema, req.body);
  const dedupe = `manual:${d.category}:${d.state ?? ''}:${d.district ?? ''}:${d.crop_id ?? ''}:${d.title.toLowerCase()}`;
  const existing = q.get<Row>('SELECT id FROM alerts WHERE dedupe_key = ? AND expires_at > datetime(\'now\')', dedupe);
  if (existing) return res.status(200).json({ id: existing.id, duplicate: true });
  q.run('DELETE FROM alerts WHERE dedupe_key = ?', dedupe); // remove expired duplicate key
  const aid = id();
  insert('alerts', { id: aid, ...d, verified: 1, dedupe_key: dedupe, created_by: req.user!.id });
  audit(req, 'alert.create', 'alert', aid, { title: d.title });
  // Fan out in-app notifications to affected users (deduplicated per alert).
  const users = q.all<Row>(
    `SELECT DISTINCT u.id FROM users u LEFT JOIN farms f ON f.user_id = u.id
     WHERE u.status = 'active' AND ((? IS NULL) OR f.state = ? OR u.state = ?) AND ((? IS NULL) OR f.district = ? OR u.district = ?)`,
    d.state ?? null, d.state ?? null, d.state ?? null, d.district ?? null, d.district ?? null, d.district ?? null);
  for (const u of users) notify(u.id, d.category === 'pest' || d.category === 'disease' ? 'pest' : 'weather', d.title, d.body, `alert:${aid}`, '/alerts');
  res.status(201).json({ id: aid, notified: users.length });
}));

alertsRouter.delete('/:id', requireRole('admin'), ah(async (req, res) => {
  const r = q.run(`UPDATE alerts SET expires_at = datetime('now') WHERE id = ?`, req.params.id);
  if (!r.changes) throw notFound('Alert');
  audit(req, 'alert.expire', 'alert', req.params.id);
  res.json({ ok: true });
}));

// ---- Notifications ----
export const notificationsRouter = Router();

notificationsRouter.get('/', ah(async (req, res) => {
  const unreadOnly = req.query.unread === '1';
  res.json({
    notifications: q.all(`SELECT * FROM notifications WHERE user_id = ? ${unreadOnly ? 'AND read_at IS NULL' : ''} ORDER BY created_at DESC LIMIT 100`, req.user!.id),
    unread: q.get<Row>('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL', req.user!.id)!.n,
  });
}));

notificationsRouter.post('/read-all', ah(async (req, res) => {
  q.run(`UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL`, req.user!.id);
  res.json({ ok: true });
}));

notificationsRouter.post('/:id/read', ah(async (req, res) => {
  q.run(`UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ?`, req.params.id, req.user!.id);
  res.json({ ok: true });
}));

notificationsRouter.delete('/:id', ah(async (req, res) => {
  q.run('DELETE FROM notifications WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  res.json({ ok: true });
}));

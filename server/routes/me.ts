import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { config } from '../config.ts';
import { q, out, updateSet, type Row } from '../db/index.ts';
import { ah, HttpError, id, parse, zLat, zLon, zOptText } from '../lib/http.ts';
import { destroySession } from '../lib/auth.ts';
import { audit, verifyPassword } from '../lib/security.ts';
import { deleteDocumentFile } from '../lib/files.ts';
import { userPayload } from './auth.ts';

export const meRouter = Router();

const ProfileSchema = z.object({
  full_name: z.string().trim().min(2).max(100).optional(),
  email: z.string().email().max(200).optional().nullable().or(z.literal('')),
  language: z.enum(['en', 'hi', 'te', 'ml']).optional(),
  state: zOptText(80), district: zOptText(80), subdistrict: zOptText(80), village: zOptText(80),
  pincode: z.string().regex(/^\d{6}$/).optional().nullable().or(z.literal('')),
  latitude: zLat.optional().nullable(), longitude: zLon.optional().nullable(),
  location_consent: z.boolean().optional(),
  onboarding_complete: z.boolean().optional(),
  notify_channels: z.array(z.enum(['in_app', 'sms', 'email', 'push'])).optional(),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().or(z.literal('')),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().or(z.literal('')),
  keep_diagnosis_history: z.boolean().optional(),
}).strict();

meRouter.get('/', ah(async (req, res) => {
  res.json({ user: userPayload(req.user!.id) });
}));

meRouter.patch('/', ah(async (req, res) => {
  const data = parse(ProfileSchema, req.body);
  for (const k of ['email', 'pincode', 'quiet_hours_start', 'quiet_hours_end'] as const) if (data[k] === '') data[k] = null;
  // Precise coordinates are stored only with explicit consent.
  if ((data.latitude != null || data.longitude != null) && !data.location_consent) {
    const cur = q.get<Row>('SELECT location_consent FROM users WHERE id = ?', req.user!.id);
    if (!cur?.location_consent) throw new HttpError(400, 'Location consent is required to save GPS coordinates', 'consent_required');
  }
  if (data.location_consent === false) { data.latitude = null; data.longitude = null; }
  const set = updateSet(data);
  if (!set.empty) q.run(`UPDATE users SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, req.user!.id);
  res.json({ user: userPayload(req.user!.id) });
}));

/** Export all of a user's personal data (data portability). */
meRouter.get('/export', ah(async (req, res) => {
  const uid = req.user!.id;
  const tables = ['farms', 'crop_cycles', 'tasks', 'activity_logs', 'soil_tests', 'irrigation_logs', 'expenses', 'harvests',
    'diagnoses', 'conversations', 'market_watchlist', 'notifications', 'saved_items', 'community_posts', 'community_comments'];
  const data: Record<string, unknown> = { user: out(q.get('SELECT * FROM users WHERE id = ?', uid)) };
  for (const t of tables) data[t] = q.all(`SELECT * FROM ${t} WHERE user_id = ?`, uid);
  data.plots = q.all('SELECT p.* FROM plots p JOIN farms f ON f.id = p.farm_id WHERE f.user_id = ?', uid);
  data.messages = q.all('SELECT m.* FROM messages m JOIN conversations c ON c.id = m.conversation_id WHERE c.user_id = ?', uid);
  audit(req, 'user.export', 'user', uid);
  res.setHeader('Content-Disposition', `attachment; filename="farmdirect-export-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(data);
}));

/** Permanently delete the account and all personal records (requires password). */
meRouter.delete('/', ah(async (req, res) => {
  const { password, reason } = parse(z.object({ password: z.string(), reason: zOptText(500) }), req.body);
  const uid = req.user!.id;
  const user = q.get<Row>('SELECT password_hash, role FROM users WHERE id = ?', uid)!;
  if (!verifyPassword(password, user.password_hash)) throw new HttpError(400, 'Password is incorrect', 'bad_credentials');
  if (user.role === 'super_admin') throw new HttpError(400, 'A super administrator account cannot delete itself', 'forbidden');
  // Open transactions must be finished first; completed transaction records are kept (anonymised) for the other party and audit.
  const open = q.get<Row>(`SELECT
      (SELECT COUNT(*) FROM orders WHERE (farmer_id = ? OR buyer_id = ?) AND status NOT IN ('completed','cancelled')) +
      (SELECT COUNT(*) FROM storage_bookings WHERE farmer_id = ? AND status NOT IN ('completed','cancelled','declined')) +
      (SELECT COUNT(*) FROM disputes WHERE (raised_by = ? OR against_id = ?) AND status NOT IN ('resolved','rejected')) AS n`, uid, uid, uid, uid, uid)!.n;
  if (open > 0) throw new HttpError(409, 'Please complete or cancel your open orders, storage bookings and disputes before deleting your account.', 'open_transactions');
  const images = q.all<Row>('SELECT image_path FROM diagnoses WHERE user_id = ? AND image_path IS NOT NULL', uid);
  const docs = q.all<Row>(`SELECT * FROM documents WHERE owner_id = ? AND subject_type IN ('buyer','user','lot') AND deleted_at IS NULL`, uid);
  q.tx(() => {
    q.run('INSERT INTO deletion_requests (id, user_id, reason) VALUES (?, ?, ?)', id(), uid, reason ?? null);
    q.run('DELETE FROM users WHERE id = ?', uid); // ON DELETE CASCADE removes owned records
  });
  for (const img of images) fs.rm(path.join(config.uploadDir, img.image_path), { force: true }, () => {});
  for (const d of docs) deleteDocumentFile(d);
  audit(req, 'user.delete', 'user', uid);
  destroySession(req, res);
  res.json({ ok: true });
}));

// ---- Saved items & recently viewed ----
meRouter.get('/saved', ah(async (req, res) => {
  res.json({ items: q.all('SELECT * FROM saved_items WHERE user_id = ? ORDER BY created_at DESC', req.user!.id) });
}));

meRouter.post('/saved', ah(async (req, res) => {
  const b = parse(z.object({
    item_type: z.enum(['content', 'advisory', 'diagnosis', 'scheme', 'product', 'market']),
    item_id: z.string().min(1).max(200), title: z.string().min(1).max(300),
  }), req.body);
  q.run('INSERT OR IGNORE INTO saved_items (id, user_id, item_type, item_id, title) VALUES (?, ?, ?, ?, ?)',
    id(), req.user!.id, b.item_type, b.item_id, b.title);
  res.status(201).json({ ok: true });
}));

meRouter.delete('/saved/:type/:itemId', ah(async (req, res) => {
  q.run('DELETE FROM saved_items WHERE user_id = ? AND item_type = ? AND item_id = ?', req.user!.id, req.params.type, req.params.itemId);
  res.json({ ok: true });
}));

meRouter.post('/recent', ah(async (req, res) => {
  const b = parse(z.object({ item_type: z.string().max(30), item_id: z.string().max(200), title: z.string().max(300) }), req.body);
  q.run(`INSERT INTO recent_views (user_id, item_type, item_id, title) VALUES (?, ?, ?, ?)
         ON CONFLICT(user_id, item_type, item_id) DO UPDATE SET viewed_at = datetime('now'), title = excluded.title`,
    req.user!.id, b.item_type, b.item_id, b.title);
  res.json({ ok: true });
}));

meRouter.get('/recent', ah(async (req, res) => {
  res.json({ items: q.all('SELECT * FROM recent_views WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 10', req.user!.id) });
}));

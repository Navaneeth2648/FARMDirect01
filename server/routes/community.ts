import { Router } from 'express';
import { z } from 'zod';
import { q, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, id, notFound, parse, zText } from '../lib/http.ts';
import { isStaff, isVerifiedExpert, requireRole } from '../lib/auth.ts';
import { audit, rateLimit } from '../lib/security.ts';

export const communityRouter = Router();

/** Basic spam/scam heuristics. Suspicious posts are held for moderation instead of being published. */
export function spamCheck(text: string) {
  const links = (text.match(/https?:\/\//gi) || []).length;
  const phones = (text.match(/(\+91[\s-]?)?[6-9]\d{9}/g) || []).length;
  const scamWords = /(guaranteed (profit|returns)|double your money|lottery|send (otp|money)|whatsapp me|upi pin|loan approved)/i.test(text);
  return { hold: links > 2 || phones > 1 || scamWords, reason: scamWords ? 'possible scam language' : links > 2 ? 'too many links' : phones > 1 ? 'multiple phone numbers' : null };
}

const postLimit = rateLimit({ name: 'post', windowMs: 60 * 60_000, max: 10, key: (r) => r.user!.id });

communityRouter.get('/posts', ah(async (req, res) => {
  const { category, crop, q: search } = req.query as Record<string, string | undefined>;
  const where = [`p.status = 'visible'`];
  const params: unknown[] = [];
  if (category) { where.push('p.category = ?'); params.push(category); }
  if (crop) { where.push('p.crop_id = ?'); params.push(crop); }
  if (search) { where.push('(p.title LIKE ? OR p.body LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.json({
    posts: q.all(`SELECT p.*, u.full_name AS author, u.role AS author_role, (SELECT COUNT(*) FROM community_comments c WHERE c.post_id = p.id AND c.status = 'visible') AS comments
      FROM community_posts p JOIN users u ON u.id = p.user_id WHERE ${where.join(' AND ')} ORDER BY p.created_at DESC LIMIT 30 OFFSET ?`, ...params, offset),
    notice: 'Community posts are shared by farmers and are not verified advice unless marked "Expert verified".',
  });
}));

communityRouter.get('/posts/:id', ah(async (req, res) => {
  const p = q.get<Row>(`SELECT p.*, u.full_name AS author, u.role AS author_role FROM community_posts p JOIN users u ON u.id = p.user_id WHERE p.id = ?`, req.params.id);
  if (!p || (p.status !== 'visible' && p.user_id !== req.user!.id && !isStaff(req.user))) throw notFound('Post');
  const comments = q.all(`SELECT c.*, u.full_name AS author, u.role AS author_role FROM community_comments c JOIN users u ON u.id = c.user_id
    WHERE c.post_id = ? AND (c.status = 'visible' OR c.user_id = ?) ORDER BY c.is_expert DESC, c.created_at`, p.id, req.user!.id);
  res.json({ post: p, comments });
}));

communityRouter.post('/posts', postLimit, ah(async (req, res) => {
  const b = parse(z.object({ category: z.enum(['question', 'experience', 'discussion']), title: zText(200), body: zText(5000), crop_id: z.string().optional().nullable() }), req.body);
  const spam = spamCheck(`${b.title} ${b.body}`);
  const pid = id();
  q.run('INSERT INTO community_posts (id, user_id, category, title, body, crop_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    pid, req.user!.id, b.category, b.title, b.body, b.crop_id ?? null, spam.hold ? 'pending' : 'visible');
  res.status(201).json({ id: pid, held: spam.hold, message: spam.hold ? 'Your post will appear after a moderator reviews it.' : undefined });
}));

communityRouter.delete('/posts/:id', ah(async (req, res) => {
  const p = q.get<Row>('SELECT * FROM community_posts WHERE id = ?', req.params.id);
  if (!p) throw notFound('Post');
  if (p.user_id !== req.user!.id && !isStaff(req.user)) throw forbidden();
  q.run('DELETE FROM community_posts WHERE id = ?', p.id);
  if (p.user_id !== req.user!.id) audit(req, 'community.post_delete', 'post', p.id);
  res.json({ ok: true });
}));

communityRouter.post('/posts/:id/comments', postLimit, ah(async (req, res) => {
  const { body } = parse(z.object({ body: zText(3000) }), req.body);
  if (!q.get(`SELECT 1 FROM community_posts WHERE id = ? AND status = 'visible'`, req.params.id)) throw notFound('Post');
  const spam = spamCheck(body);
  const cid = id();
  q.run('INSERT INTO community_comments (id, post_id, user_id, body, is_expert, status) VALUES (?, ?, ?, ?, ?, ?)',
    cid, req.params.id, req.user!.id, body, isVerifiedExpert(req.user) ? 1 : 0, spam.hold ? 'pending' : 'visible');
  res.status(201).json({ id: cid, held: spam.hold });
}));

communityRouter.post('/posts/:id/verify', requireRole('expert', 'admin'), ah(async (req, res) => {
  q.run('UPDATE community_posts SET expert_verified = 1 WHERE id = ?', req.params.id);
  audit(req, 'community.verify', 'post', req.params.id);
  res.json({ ok: true });
}));

communityRouter.post('/report', ah(async (req, res) => {
  const b = parse(z.object({ target_type: z.enum(['post', 'comment', 'content', 'provider']), target_id: z.string(), reason: zText(500) }), req.body);
  q.run('INSERT OR IGNORE INTO content_reports (id, reporter_id, target_type, target_id, reason) VALUES (?, ?, ?, ?, ?)',
    id(), req.user!.id, b.target_type, b.target_id, b.reason);
  // Auto-hide after 3 independent reports pending moderator review.
  const n = q.get<Row>(`SELECT COUNT(*) n FROM content_reports WHERE target_type = ? AND target_id = ? AND status = 'open'`, b.target_type, b.target_id)!.n;
  if (n >= 3 && b.target_type === 'post') q.run(`UPDATE community_posts SET status = 'pending' WHERE id = ?`, b.target_id);
  if (n >= 3 && b.target_type === 'comment') q.run(`UPDATE community_comments SET status = 'pending' WHERE id = ?`, b.target_id);
  res.status(201).json({ ok: true });
}));

// ---- Moderation ----
export const moderationRouter = Router();
moderationRouter.use(requireRole('admin', 'content_editor'));

moderationRouter.get('/queue', ah(async (_req, res) => {
  res.json({
    reports: q.all(`SELECT * FROM content_reports WHERE status = 'open' ORDER BY created_at LIMIT 200`),
    pendingPosts: q.all(`SELECT p.*, u.full_name AS author FROM community_posts p JOIN users u ON u.id = p.user_id WHERE p.status = 'pending' ORDER BY p.created_at`),
    pendingComments: q.all(`SELECT c.*, u.full_name AS author FROM community_comments c JOIN users u ON u.id = c.user_id WHERE c.status = 'pending' ORDER BY c.created_at`),
  });
}));

moderationRouter.post('/:type/:id', ah(async (req, res) => {
  const { action } = parse(z.object({ action: z.enum(['approve', 'hide']) }), req.body);
  const table = req.params.type === 'post' ? 'community_posts' : req.params.type === 'comment' ? 'community_comments' : null;
  if (!table) throw new HttpError(400, 'Unknown type', 'bad_type');
  q.run(`UPDATE ${table} SET status = ? WHERE id = ?`, action === 'approve' ? 'visible' : 'hidden', req.params.id);
  q.run(`UPDATE content_reports SET status = ?, resolved_by = ? WHERE target_type = ? AND target_id = ? AND status = 'open'`,
    action === 'approve' ? 'dismissed' : 'actioned', req.user!.id, req.params.type, req.params.id);
  audit(req, `moderation.${action}`, req.params.type, req.params.id);
  res.json({ ok: true });
}));

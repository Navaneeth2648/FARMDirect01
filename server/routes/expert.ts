import { Router } from 'express';
import { z } from 'zod';
import { q, out, insert, type Row } from '../db/index.ts';
import { ah, forbidden, id, notFound, parse, zDate, zText } from '../lib/http.ts';
import { isVerifiedExpert, requireRole } from '../lib/auth.ts';
import { audit } from '../lib/security.ts';
import { notify } from '../services/notify.ts';

/** Farmer side: ask an expert and follow up on own cases. */
export const casesRouter = Router();

casesRouter.get('/', ah(async (req, res) => {
  res.json({ cases: q.all('SELECT * FROM expert_cases WHERE farmer_id = ? ORDER BY updated_at DESC', req.user!.id) });
}));

casesRouter.post('/', ah(async (req, res) => {
  const b = parse(z.object({
    question: zText(3000), crop_id: z.string().optional().nullable(), farm_id: z.string().optional().nullable(),
    urgency: z.enum(['normal', 'urgent']).default('normal'), allow_contact: z.boolean().default(false),
  }), req.body);
  if (b.farm_id && !q.get('SELECT 1 FROM farms WHERE id = ? AND user_id = ?', b.farm_id, req.user!.id)) throw notFound('Farm');
  const cid = id();
  insert('expert_cases', { id: cid, farmer_id: req.user!.id, ...b });
  res.status(201).json({ id: cid });
}));

function loadCase(req: any, caseId: string) {
  const c = q.get<Row>(`SELECT ec.*, u.full_name AS farmer_name, CASE WHEN ec.allow_contact = 1 THEN u.phone END AS farmer_phone,
      cr.name AS crop_name, f.district, f.state, f.village
    FROM expert_cases ec JOIN users u ON u.id = ec.farmer_id LEFT JOIN crops cr ON cr.id = ec.crop_id LEFT JOIN farms f ON f.id = ec.farm_id WHERE ec.id = ?`, caseId);
  if (!c) throw notFound('Case');
  if (c.farmer_id !== req.user.id && !isVerifiedExpert(req.user)) throw notFound('Case');
  return c;
}

casesRouter.get('/:id', ah(async (req, res) => {
  const c = loadCase(req, req.params.id);
  const events = q.all(`SELECT e.*, u.full_name AS actor_name, u.role AS actor_role FROM case_events e LEFT JOIN users u ON u.id = e.actor_id
    WHERE e.case_id = ? ORDER BY e.created_at`, c.id);
  const diagnosis = c.diagnosis_id ? out(q.get('SELECT * FROM diagnoses WHERE id = ?', c.diagnosis_id)) : null;
  res.json({ case: c, events, diagnosis });
}));

casesRouter.post('/:id/reply', ah(async (req, res) => {
  const c = loadCase(req, req.params.id);
  const { body } = parse(z.object({ body: zText(5000) }), req.body);
  q.run('INSERT INTO case_events (id, case_id, actor_id, kind, body) VALUES (?, ?, ?, ?, ?)', id(), c.id, req.user!.id, 'reply', body);
  const fromExpert = req.user!.id !== c.farmer_id;
  q.run(`UPDATE expert_cases SET status = ?, updated_at = datetime('now') WHERE id = ?`, fromExpert ? 'answered' : (c.status === 'answered' ? 'assigned' : c.status), c.id);
  if (fromExpert) {
    audit(req, 'case.reply', 'case', c.id);
    notify(c.farmer_id, 'expert', 'An expert replied to your question', body.slice(0, 140), `case-reply:${c.id}:${Date.now()}`, `/experts/cases/${c.id}`);
  }
  res.status(201).json({ ok: true });
}));

casesRouter.post('/:id/close', ah(async (req, res) => {
  const c = loadCase(req, req.params.id);
  q.run(`UPDATE expert_cases SET status = 'closed', updated_at = datetime('now') WHERE id = ?`, c.id);
  res.json({ ok: true });
}));

/** Expert / field-agent workspace. */
export const expertRouter = Router();
expertRouter.use(requireRole('expert', 'field_agent', 'admin'));

expertRouter.get('/cases', ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'open';
  const mine = req.query.mine === '1';
  res.json({
    cases: q.all(`SELECT ec.*, cr.name AS crop_name, f.district, f.state, u.full_name AS farmer_name
      FROM expert_cases ec JOIN users u ON u.id = ec.farmer_id LEFT JOIN crops cr ON cr.id = ec.crop_id LEFT JOIN farms f ON f.id = ec.farm_id
      WHERE ${status === 'unresolved' ? `ec.status IN ('open','assigned','escalated')` : 'ec.status = ?'} ${mine ? 'AND ec.assigned_to = ?' : ''}
      ORDER BY CASE ec.urgency WHEN 'urgent' THEN 0 ELSE 1 END, ec.created_at LIMIT 200`,
      ...(status === 'unresolved' ? [] : [status]), ...(mine ? [req.user!.id] : [])),
  });
}));

expertRouter.post('/cases/:id/assign', ah(async (req, res) => {
  const r = q.run(`UPDATE expert_cases SET assigned_to = ?, status = 'assigned', updated_at = datetime('now') WHERE id = ? AND status IN ('open','escalated')`, req.user!.id, req.params.id);
  if (!r.changes) throw notFound('Open case');
  q.run('INSERT INTO case_events (id, case_id, actor_id, kind, body) VALUES (?, ?, ?, ?, ?)', id(), req.params.id, req.user!.id, 'status', 'Case assigned');
  audit(req, 'case.assign', 'case', req.params.id);
  res.json({ ok: true });
}));

expertRouter.post('/cases/:id/escalate', ah(async (req, res) => {
  const { reason } = parse(z.object({ reason: zText(1000) }), req.body);
  q.run(`UPDATE expert_cases SET status = 'escalated', urgency = 'urgent', assigned_to = NULL, updated_at = datetime('now') WHERE id = ?`, req.params.id);
  q.run('INSERT INTO case_events (id, case_id, actor_id, kind, body) VALUES (?, ?, ?, ?, ?)', id(), req.params.id, req.user!.id, 'status', `Escalated: ${reason}`);
  audit(req, 'case.escalate', 'case', req.params.id);
  res.json({ ok: true });
}));

expertRouter.post('/cases/:id/events', ah(async (req, res) => {
  const b = parse(z.object({ kind: z.enum(['field_visit', 'observation', 'follow_up']), body: zText(5000), due_date: zDate.optional().nullable() }), req.body);
  if (!q.get('SELECT 1 FROM expert_cases WHERE id = ?', req.params.id)) throw notFound('Case');
  q.run('INSERT INTO case_events (id, case_id, actor_id, kind, body, due_date) VALUES (?, ?, ?, ?, ?, ?)', id(), req.params.id, req.user!.id, b.kind, b.body, b.due_date ?? null);
  audit(req, `case.${b.kind}`, 'case', req.params.id);
  res.status(201).json({ ok: true });
}));

/** Confirm or correct a preliminary AI diagnosis attached to a case. */
expertRouter.post('/diagnoses/:id/review', ah(async (req, res) => {
  const b = parse(z.object({ decision: z.enum(['confirmed', 'corrected']), notes: zText(5000) }), req.body);
  const d = q.get<Row>('SELECT * FROM diagnoses WHERE id = ?', req.params.id);
  const linked = d && q.get('SELECT 1 FROM expert_cases WHERE diagnosis_id = ?', d.id);
  if (!d || !linked) throw notFound('Diagnosis');
  if (d.user_id === req.user!.id) throw forbidden('You cannot review your own diagnosis');
  q.run(`UPDATE diagnoses SET expert_status = ?, expert_notes = ?, expert_id = ?, updated_at = datetime('now') WHERE id = ?`, b.decision, b.notes, req.user!.id, d.id);
  audit(req, `diagnosis.${b.decision}`, 'diagnosis', d.id);
  notify(d.user_id, 'expert', `Expert ${b.decision} your Crop Doctor result`, b.notes.slice(0, 140), `diag-review:${d.id}`, `/crop-doctor/${d.id}`);
  res.json({ ok: true });
}));

expertRouter.get('/follow-ups', ah(async (req, res) => {
  res.json({
    items: q.all(`SELECT e.*, ec.question FROM case_events e JOIN expert_cases ec ON ec.id = e.case_id
      WHERE e.kind = 'follow_up' AND e.actor_id = ? AND ec.status != 'closed' ORDER BY e.due_date`, req.user!.id),
  });
}));

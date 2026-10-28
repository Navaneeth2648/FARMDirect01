import { Router, type Request } from 'express';
import { z } from 'zod';
import { q, insert, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, id, notFound, parse, zOptText, zText } from '../lib/http.ts';
import { hasPerm } from '../lib/permissions.ts';
import { requirePerm } from '../lib/auth.ts';
import { audit } from '../lib/security.ts';
import { docUpload, storeDocument } from '../lib/files.ts';
import { checkNonDelivery } from '../services/fraud.ts';
import { ref } from '../services/trade.ts';
import { notifyT } from '../services/messages.ts';

export const disputesRouter = Router();

const CATEGORIES = ['quantity_mismatch', 'quality_disagreement', 'non_delivery', 'damaged_produce', 'late_pickup', 'storage_condition', 'unexpected_charges', 'payment_delay', 'suspected_fraud', 'other'] as const;

/** Case history is append-only (enforced by a database trigger). */
function caseEvent(disputeId: string, actorId: string | null, kind: string, body: string, internal = false) {
  q.run('INSERT INTO dispute_events (dispute_id, actor_id, kind, body, internal) VALUES (?, ?, ?, ?, ?)', disputeId, actorId, kind, body, internal ? 1 : 0);
}

function load(req: Request, disputeId: string) {
  const d = q.get<Row>('SELECT * FROM disputes WHERE id = ?', disputeId);
  if (!d) throw notFound('Dispute');
  const officer = hasPerm(req.user!.role, 'disputes.manage');
  const party = d.raised_by === req.user!.id || d.against_id === req.user!.id;
  if (!officer && !party) throw notFound('Dispute');
  return { d, officer, party };
}

const notifyParties = (d: Row, status: string) => {
  for (const uid of [d.raised_by, d.against_id]) notifyT(uid, 'system', 'dispute_update', { ref: d.ref, status }, `dispute:${d.id}:${status}:${Date.now()}`, `/trade/disputes/${d.id}`);
};

disputesRouter.post('/', ah(async (req, res) => {
  const b = parse(z.object({
    order_id: z.string().optional().nullable(), booking_id: z.string().optional().nullable(),
    category: z.enum(CATEGORIES), description: zText(3000), requested_resolution: zText(1000),
  }).refine((x) => !!x.order_id !== !!x.booking_id, 'Choose either an order or a storage booking'), req.body);
  const uid = req.user!.id;
  let against: string | null = null;
  if (b.order_id) {
    const o = q.get<Row>('SELECT * FROM orders WHERE id = ?', b.order_id);
    if (!o || (o.farmer_id !== uid && o.buyer_id !== uid)) throw notFound('Order');
    if (o.status === 'pending_confirmation') throw new HttpError(409, 'Cancel unconfirmed orders instead of opening a dispute', 'bad_state');
    against = o.farmer_id === uid ? o.buyer_id : o.farmer_id;
  } else {
    const bk = q.get<Row>('SELECT b.*, f.provider_id FROM storage_bookings b JOIN storage_facilities f ON f.id = b.facility_id WHERE b.id = ?', b.booking_id);
    if (!bk || (bk.farmer_id !== uid && bk.provider_id !== uid)) throw notFound('Booking');
    against = bk.farmer_id === uid ? bk.provider_id : bk.farmer_id;
  }
  const open = q.get(`SELECT 1 FROM disputes WHERE raised_by = ? AND COALESCE(order_id, booking_id) = ? AND status NOT IN ('resolved','rejected')`, uid, b.order_id ?? b.booking_id);
  if (open) throw new HttpError(409, 'You already have an open dispute for this', 'duplicate');
  const did = id();
  const dref = ref('DSP');
  q.tx(() => {
    insert('disputes', { id: did, ref: dref, order_id: b.order_id ?? null, booking_id: b.booking_id ?? null, raised_by: uid, against_id: against, category: b.category, description: b.description, requested_resolution: b.requested_resolution });
    caseEvent(did, uid, 'created', `${b.category.replace(/_/g, ' ')}: ${b.description}\nRequested: ${b.requested_resolution}`);
    if (b.order_id) q.run('INSERT INTO order_events (order_id, actor_id, event, details) VALUES (?, ?, ?, ?)', b.order_id, uid, 'dispute_opened', JSON.stringify({ ref: dref }));
    if (b.booking_id) q.run(`INSERT INTO inventory_movements (booking_id, kind, note, actor_id) VALUES (?, 'status', ?, ?)`, b.booking_id, `Dispute ${dref} opened`, uid);
  });
  if (b.category === 'non_delivery' && against) checkNonDelivery(against);
  notifyParties({ id: did, ref: dref, raised_by: uid, against_id: against }, 'opened');
  audit(req, 'dispute.open', 'dispute', did);
  res.status(201).json({ id: did, ref: dref });
}));

disputesRouter.get('/', ah(async (req, res) => {
  res.json({ disputes: q.all('SELECT * FROM disputes WHERE raised_by = ? OR against_id = ? ORDER BY updated_at DESC', req.user!.id, req.user!.id) });
}));

disputesRouter.get('/:id', ah(async (req, res) => {
  const { d, officer } = load(req, req.params.id);
  res.json({
    dispute: d, is_officer: officer,
    events: q.all(`SELECT e.kind, e.body, e.internal, e.created_at, u.full_name AS actor_name, u.role AS actor_role FROM dispute_events e LEFT JOIN users u ON u.id = e.actor_id
      WHERE e.dispute_id = ? ${officer ? '' : 'AND e.internal = 0'} ORDER BY e.id`, d.id),
    evidence: q.all(`SELECT id, doc_type, mime, original_name, created_at, owner_id FROM documents WHERE subject_type = 'dispute' AND subject_id = ? AND deleted_at IS NULL`, d.id),
    can_appeal: !officer && ['resolved', 'rejected'].includes(d.status) && d.appeal_count < 1 && !!d.decided_at && Date.now() - Date.parse(d.decided_at + 'Z') < 14 * 86400_000,
  });
}));

disputesRouter.post('/:id/evidence', docUpload.single('file'), ah(async (req, res) => {
  const { d } = load(req, req.params.id);
  if (['resolved', 'rejected'].includes(d.status)) throw new HttpError(409, 'This case is closed', 'closed');
  const { description } = parse(z.object({ description: zOptText(300) }), req.body);
  const doc = storeDocument(req, 'dispute', d.id, 'evidence');
  caseEvent(d.id, req.user!.id, 'evidence', description || `Evidence uploaded (${doc.mime})`);
  if (d.status === 'awaiting_evidence') q.run(`UPDATE disputes SET status = 'under_review', updated_at = datetime('now') WHERE id = ?`, d.id);
  res.status(201).json({ document: doc });
}));

disputesRouter.post('/:id/comments', ah(async (req, res) => {
  const { body } = parse(z.object({ body: zText(3000) }), req.body);
  const { d } = load(req, req.params.id);
  if (['resolved', 'rejected'].includes(d.status)) throw new HttpError(409, 'This case is closed', 'closed');
  caseEvent(d.id, req.user!.id, 'comment', body);
  q.run(`UPDATE disputes SET updated_at = datetime('now') WHERE id = ?`, d.id);
  res.status(201).json({ ok: true });
}));

disputesRouter.post('/:id/appeal', ah(async (req, res) => {
  const { statement } = parse(z.object({ statement: zText(3000) }), req.body);
  const { d, party } = load(req, req.params.id);
  if (!party) throw forbidden();
  if (!['resolved', 'rejected'].includes(d.status) || d.appeal_count >= 1) throw new HttpError(409, 'This decision cannot be appealed', 'not_appealable');
  if (Date.now() - Date.parse(d.decided_at + 'Z') > 14 * 86400_000) throw new HttpError(409, 'The 14-day appeal period has ended', 'appeal_window_closed');
  q.run(`UPDATE disputes SET status = 'appealed', appeal_count = appeal_count + 1, assigned_to = NULL, updated_at = datetime('now') WHERE id = ?`, d.id);
  caseEvent(d.id, req.user!.id, 'appeal', statement);
  notifyParties(d, 'appealed');
  audit(req, 'dispute.appeal', 'dispute', d.id);
  res.json({ ok: true });
}));

// ---------------- Resolution officers (mounted at /v1/ops/disputes) ----------------
export const disputeOfficerRouter = Router();
const officer = disputeOfficerRouter;
officer.use(requirePerm('disputes.manage'));

officer.get('/', ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  res.json({
    disputes: q.all(`SELECT d.*, r.full_name AS raised_by_name, a.full_name AS against_name, o.order_no, b.booking_ref FROM disputes d
      LEFT JOIN users r ON r.id = d.raised_by LEFT JOIN users a ON a.id = d.against_id LEFT JOIN orders o ON o.id = d.order_id LEFT JOIN storage_bookings b ON b.id = d.booking_id
      ${status ? 'WHERE d.status = ?' : `WHERE d.status NOT IN ('resolved','rejected')`} ORDER BY d.created_at LIMIT 300`, ...(status ? [status] : [])),
  });
}));

officer.post('/:id/assign', ah(async (req, res) => {
  const { officer_id } = parse(z.object({ officer_id: z.string().optional() }), req.body);
  const { d } = load(req, req.params.id);
  const assignee = officer_id ?? req.user!.id;
  const u = q.get<Row>('SELECT role, full_name FROM users WHERE id = ?', assignee);
  if (!u || !hasPerm(u.role, 'disputes.manage')) throw new HttpError(400, 'Assignee is not a resolution officer', 'validation_error');
  if (d.status === 'appealed' && d.decided_by === assignee) throw new HttpError(400, 'An appeal must be reviewed by a different officer than the one who decided the case', 'same_officer');
  q.run(`UPDATE disputes SET assigned_to = ?, status = CASE WHEN status = 'open' THEN 'under_review' ELSE status END, updated_at = datetime('now') WHERE id = ?`, assignee, d.id);
  caseEvent(d.id, req.user!.id, 'assignment', `Assigned to ${u.full_name}`);
  audit(req, 'dispute.assign', 'dispute', d.id, { assignee });
  res.json({ ok: true });
}));

officer.post('/:id/status', ah(async (req, res) => {
  const { status, note } = parse(z.object({ status: z.enum(['under_review', 'awaiting_evidence', 'escalated']), note: zText(1000) }), req.body);
  const { d } = load(req, req.params.id);
  if (['resolved', 'rejected'].includes(d.status)) throw new HttpError(409, 'Case is closed', 'closed');
  q.run(`UPDATE disputes SET status = ?, updated_at = datetime('now') WHERE id = ?`, status, d.id);
  caseEvent(d.id, req.user!.id, 'status', `${status.replace('_', ' ')}: ${note}`);
  notifyParties(d, status.replace('_', ' '));
  audit(req, 'dispute.status', 'dispute', d.id, { status });
  res.json({ ok: true });
}));

officer.post('/:id/note', ah(async (req, res) => {
  const { body } = parse(z.object({ body: zText(3000) }), req.body);
  const { d } = load(req, req.params.id);
  caseEvent(d.id, req.user!.id, 'internal_note', body, true);
  res.status(201).json({ ok: true });
}));

officer.post('/:id/decide', ah(async (req, res) => {
  const { outcome, resolution } = parse(z.object({ outcome: z.enum(['resolved', 'rejected']), resolution: zText(3000) }), req.body);
  const { d } = load(req, req.params.id);
  if (['resolved', 'rejected'].includes(d.status)) throw new HttpError(409, 'Case is already decided', 'closed');
  if (d.status === 'appealed' && d.decided_by === req.user!.id && req.user!.role !== 'super_admin') throw forbidden('A different officer must decide the appeal');
  q.run(`UPDATE disputes SET status = ?, resolution = ?, decided_by = ?, decided_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`, outcome, resolution, req.user!.id, d.id);
  caseEvent(d.id, req.user!.id, 'decision', `${outcome === 'resolved' ? 'Resolved' : 'Rejected'}: ${resolution}`);
  notifyParties(d, outcome);
  audit(req, `dispute.${outcome}`, 'dispute', d.id, { resolution });
  res.json({ ok: true });
}));

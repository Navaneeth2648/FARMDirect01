import { Router, type Request } from 'express';
import { z } from 'zod';
import { q, out, insert, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, id, notFound, parse, zOptText, zText } from '../lib/http.ts';
import { hasPerm } from '../lib/permissions.ts';
import { audit } from '../lib/security.ts';
import { docUpload, storeDocument } from '../lib/files.ts';
import { criteriaFor, GRADE_NOTE } from '../services/grading.ts';
import { buyerStanding } from '../services/standing.ts';
import { notifyT } from '../services/messages.ts';
import { notify } from '../services/notify.ts';

export const gradingRouter = Router();

/** Verified field agents/experts and administrators with the grading permission can inspect. */
export const canInspect = (u: { role: string; verification_status?: string } | undefined) =>
  !!u && (hasPerm(u.role, 'grading.inspect') || (['field_agent', 'expert'].includes(u.role) && u.verification_status === 'verified'));

/** Who may see full inspection evidence: lot owner, inspectors, verified buyers, staff with orders.view. */
export function canSeeEvidence(u: { id: string; role: string; verification_status?: string }, lot: Row) {
  if (lot.farmer_id === u.id || canInspect(u) || hasPerm(u.role, 'orders.view')) return true;
  return u.role === 'buyer' && !!buyerStanding(u.id)?.can_transact;
}

/** Latest grade for a lot, with evidence only for authorised viewers. */
export function latestGrade(lotId: string, viewer?: { id: string; role: string; verification_status?: string }) {
  const r = q.get<Row>(`SELECT g.*, u.full_name AS inspector_name, u.role AS inspector_role, gr.status AS request_status
    FROM grading_results g JOIN grading_requests gr ON gr.id = g.request_id LEFT JOIN users u ON u.id = g.inspector_id
    WHERE g.lot_id = ? ORDER BY g.inspected_at DESC, g.version DESC LIMIT 1`, lotId);
  if (!r) return null;
  const lot = q.get<Row>('SELECT farmer_id FROM produce_lots WHERE id = ?', lotId)!;
  const full = viewer ? canSeeEvidence(viewer, lot) : false;
  return {
    grade: r.grade, inspected_at: r.inspected_at, version: r.version, inspector: r.inspector_name, inspector_role: r.inspector_role,
    under_review: r.request_status === 'review_requested', note: GRADE_NOTE, source: 'inspection',
    ...(full ? {
      measurements: JSON.parse(r.measurements), reasons: r.reasons, quantity_inspected: r.quantity_inspected, sample_method: r.sample_method,
      photos: q.all<Row>(`SELECT id FROM documents WHERE subject_type = 'grading' AND subject_id = ? AND deleted_at IS NULL`, r.id).map((d) => d.id),
      result_id: r.id,
    } : { evidence_note: 'Verified buyers can see the measurements and photos.' }),
  };
}

function loadRequest(req: Request, rid: string) {
  const g = q.get<Row>(`SELECT gr.*, l.commodity, l.variety, l.quantity_total, l.unit, l.crop_id, l.district, l.state, l.farmer_id AS lot_owner
    FROM grading_requests gr JOIN produce_lots l ON l.id = gr.lot_id WHERE gr.id = ?`, rid);
  if (!g) throw notFound('Grading request');
  if (g.lot_owner !== req.user!.id && !canInspect(req.user!) && !hasPerm(req.user!.role, 'orders.view')) throw notFound('Grading request');
  return g;
}

gradingRouter.get('/criteria', ah(async (req, res) => {
  const crop = typeof req.query.crop_id === 'string' ? q.get<Row>('SELECT category FROM crops WHERE id = ?', req.query.crop_id) : undefined;
  res.json({ criteria: criteriaFor(crop?.category), note: GRADE_NOTE });
}));

/** Farmer requests an inspection for one of their lots. */
gradingRouter.post('/requests', ah(async (req, res) => {
  const b = parse(z.object({ lot_id: z.string(), notes: zOptText(500) }), req.body);
  const lot = q.get<Row>('SELECT * FROM produce_lots WHERE id = ? AND farmer_id = ?', b.lot_id, req.user!.id);
  if (!lot) throw notFound('Lot');
  if (['sold', 'withdrawn'].includes(lot.status)) throw new HttpError(409, 'This lot is closed', 'bad_state');
  if (q.get(`SELECT 1 FROM grading_requests WHERE lot_id = ? AND status IN ('requested','assigned','review_requested')`, lot.id)) {
    throw new HttpError(409, 'An inspection is already in progress for this lot', 'duplicate');
  }
  const gid = id();
  insert('grading_requests', { id: gid, lot_id: lot.id, farmer_id: req.user!.id, notes: b.notes ?? null });
  audit(req, 'grading.request', 'lot', lot.id);
  res.status(201).json({ request: q.get('SELECT * FROM grading_requests WHERE id = ?', gid) });
}));

gradingRouter.get('/requests', ah(async (req, res) => {
  const u = req.user!;
  const inspector = canInspect(u);
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  const rows = q.all<Row>(`SELECT gr.*, l.commodity, l.variety, l.quantity_total, l.unit, l.district, l.state, f.full_name AS farmer_name, i.full_name AS inspector_name
    FROM grading_requests gr JOIN produce_lots l ON l.id = gr.lot_id LEFT JOIN users f ON f.id = gr.farmer_id LEFT JOIN users i ON i.id = gr.assigned_to
    WHERE ${inspector && req.query.mine !== '1' ? '1=1' : 'gr.farmer_id = ?'} ${status ? 'AND gr.status = ?' : ''} ORDER BY gr.created_at DESC LIMIT 200`,
    ...(inspector && req.query.mine !== '1' ? [] : [u.id]), ...(status ? [status] : []));
  res.json({ requests: rows, can_inspect: inspector });
}));

gradingRouter.get('/requests/:id', ah(async (req, res) => {
  const g = loadRequest(req, req.params.id);
  const crop = g.crop_id ? q.get<Row>('SELECT category FROM crops WHERE id = ?', g.crop_id) : undefined;
  const results = q.all<Row>(`SELECT g.*, u.full_name AS inspector_name FROM grading_results g LEFT JOIN users u ON u.id = g.inspector_id WHERE request_id = ? ORDER BY version`, g.id)
    .map((r) => ({ ...out(r), photos: q.all<Row>(`SELECT id FROM documents WHERE subject_type = 'grading' AND subject_id = ? AND deleted_at IS NULL`, r.id).map((d) => d.id) }));
  res.json({ request: g, results, criteria: criteriaFor(crop?.category), note: GRADE_NOTE, can_inspect: canInspect(req.user!) });
}));

gradingRouter.post('/requests/:id/assign', ah(async (req, res) => {
  if (!canInspect(req.user!)) throw forbidden('Only verified inspectors can take inspections');
  const g = loadRequest(req, req.params.id);
  if (g.lot_owner === req.user!.id) throw forbidden('You cannot inspect your own produce');
  const r = q.run(`UPDATE grading_requests SET assigned_to = ?, status = CASE WHEN status = 'requested' THEN 'assigned' ELSE status END, updated_at = datetime('now')
    WHERE id = ? AND status IN ('requested','review_requested') AND (assigned_to IS NULL OR status = 'review_requested')`, req.user!.id, g.id);
  if (!r.changes) throw new HttpError(409, 'This request is already assigned', 'taken');
  audit(req, 'grading.assign', 'grading', g.id);
  res.json({ ok: true });
}));

/** Record an inspection result (a new version each time; earlier versions stay on record). */
gradingRouter.post('/requests/:id/results', ah(async (req, res) => {
  if (!canInspect(req.user!)) throw forbidden('Only verified inspectors can record grades');
  const g = loadRequest(req, req.params.id);
  if (g.assigned_to !== req.user!.id) throw forbidden('Take the request before recording a result');
  if (!['assigned', 'review_requested'].includes(g.status)) throw new HttpError(409, `Request is ${g.status}`, 'bad_state');
  const crop = g.crop_id ? q.get<Row>('SELECT category FROM crops WHERE id = ?', g.crop_id) : undefined;
  const keys = criteriaFor(crop?.category).map((c) => c.key);
  const b = parse(z.object({
    grade: zText(50), reasons: zText(2000),
    measurements: z.record(z.union([z.number().min(0).max(100000), z.string().max(200)])).refine((m) => Object.keys(m).every((k) => keys.includes(k)), 'Unknown measurement for this crop'),
    quantity_inspected: z.number().positive().max(1e7).optional().nullable(), sample_method: zOptText(300),
  }), req.body);
  if (!Object.keys(b.measurements).length) throw new HttpError(400, 'Record at least one measurement', 'validation_error');
  const version = (q.get<Row>('SELECT MAX(version) v FROM grading_results WHERE request_id = ?', g.id)!.v ?? 0) + 1;
  const rid = id();
  q.tx(() => {
    insert('grading_results', { id: rid, request_id: g.id, lot_id: g.lot_id, inspector_id: req.user!.id, version, grade: b.grade, measurements: b.measurements, reasons: b.reasons, quantity_inspected: b.quantity_inspected ?? null, sample_method: b.sample_method ?? null });
    // The farmer's own grade field is left untouched: farmer-reported and inspected values stay separate.
    q.run(`UPDATE grading_requests SET status = 'graded', updated_at = datetime('now') WHERE id = ?`, g.id);
  });
  notifyT(g.farmer_id, 'order', 'order_update', { ref: `${g.commodity} lot`, status: `graded ${b.grade}${version > 1 ? ' (corrected)' : ''}` }, `grading:${rid}`, `/sell/${g.lot_id}`);
  audit(req, version > 1 ? 'grading.correct' : 'grading.result', 'grading', g.id, { grade: b.grade, version });
  res.status(201).json({ result_id: rid, version });
}));

gradingRouter.post('/results/:id/photos', docUpload.single('file'), ah(async (req, res) => {
  const r = q.get<Row>('SELECT * FROM grading_results WHERE id = ?', req.params.id);
  if (!r || r.inspector_id !== req.user!.id) throw notFound('Result');
  res.status(201).json({ document: storeDocument(req, 'grading', r.id, 'inspection_photo', { imagesOnly: true }) });
}));

/** Farmer, or a verified buyer with an order on the lot, can ask for a re-inspection with a reason. */
gradingRouter.post('/requests/:id/review', ah(async (req, res) => {
  const { reason } = parse(z.object({ reason: zText(1000) }), req.body);
  const g = q.get<Row>(`SELECT gr.*, l.farmer_id AS lot_owner FROM grading_requests gr JOIN produce_lots l ON l.id = gr.lot_id WHERE gr.id = ?`, req.params.id);
  if (!g) throw notFound('Grading request');
  const isBuyerOnLot = !!q.get(`SELECT 1 FROM orders WHERE lot_id = ? AND buyer_id = ?`, g.lot_id, req.user!.id);
  if (g.lot_owner !== req.user!.id && !isBuyerOnLot) throw notFound('Grading request');
  if (g.status !== 'graded') throw new HttpError(409, 'Only completed inspections can be reviewed', 'bad_state');
  q.run(`UPDATE grading_requests SET status = 'review_requested', review_reason = ?, review_requested_by = ?, updated_at = datetime('now') WHERE id = ?`, reason, req.user!.id, g.id);
  if (g.assigned_to) notify(g.assigned_to, 'system', 'Grade review requested', reason.slice(0, 140), `grading-review:${g.id}:${Date.now()}`, '/grading');
  audit(req, 'grading.review_request', 'grading', g.id, { reason });
  res.json({ ok: true });
}));

gradingRouter.post('/requests/:id/cancel', ah(async (req, res) => {
  const r = q.run(`UPDATE grading_requests SET status = 'cancelled', updated_at = datetime('now') WHERE id = ? AND farmer_id = ? AND status IN ('requested','assigned')`, req.params.id, req.user!.id);
  if (!r.changes) throw notFound('Open request');
  res.json({ ok: true });
}));

import { Router } from 'express';
import { z } from 'zod';
import { q, out, insert, updateSet, type Row } from '../db/index.ts';
import { ah, HttpError, id, notFound, parse, zOptText, zText } from '../lib/http.ts';
import { requirePerm, requireRole } from '../lib/auth.ts';
import { audit } from '../lib/security.ts';

// ---------------- Crop, pest and disease field guide ----------------
export const guidesRouter = Router();

const GuideSchema = z.object({
  category: z.enum(['crop', 'pest', 'disease', 'deficiency', 'weed']), name: zText(150), scientific_name: zOptText(150),
  local_names: z.record(z.string().max(100)).default({}), crops: z.array(z.string().max(40)).max(30).default([]),
  symptoms: zText(3000), identification: zOptText(3000), management: zText(4000), seek_help: zOptText(1000),
  image_url: z.string().url().optional().nullable(), image_license: zOptText(200), image_credit: zOptText(200),
  source_name: zOptText(200), source_url: z.string().url().optional().nullable(),
}).refine((g) => !g.image_url || (g.image_license && g.image_credit), { message: 'Images need a licence and credit', path: ['image_license'] });

guidesRouter.get('/', ah(async (req, res) => {
  const { category, crop, q: s } = req.query as Record<string, string | undefined>;
  const where = [`review_status != 'rejected'`];
  const p: unknown[] = [];
  if (category) { where.push('category = ?'); p.push(category); }
  if (crop) { where.push('crops LIKE ?'); p.push(`%"${crop}"%`); }
  if (s) { where.push('(name LIKE ? OR scientific_name LIKE ? OR symptoms LIKE ?)'); p.push(`%${s}%`, `%${s}%`, `%${s}%`); }
  res.json({ guides: q.all(`SELECT id, category, name, scientific_name, local_names, crops, symptoms, image_url, review_status FROM field_guides WHERE ${where.join(' AND ')} ORDER BY category, name`, ...p).map(out) });
}));

guidesRouter.get('/:id', ah(async (req, res) => {
  const g = q.get<Row>('SELECT * FROM field_guides WHERE id = ?', req.params.id);
  if (!g) throw notFound('Guide');
  const crops: string[] = JSON.parse(g.crops);
  res.json({
    guide: out(g),
    related_advisories: crops.length ? q.all(`SELECT id, crop_id, title, topic FROM advisories WHERE crop_id IN (${crops.map(() => '?').join(',')}) AND topic IN ('pest','disease','nutrient') AND review_status != 'rejected' LIMIT 6`, ...crops) : [],
  });
}));

guidesRouter.post('/', requireRole('content_editor', 'expert', 'admin'), ah(async (req, res) => {
  const d = parse(GuideSchema, req.body);
  const gid = id();
  insert('field_guides', { id: gid, ...d, created_by: req.user!.id, review_status: 'needs_review' });
  audit(req, 'guide.create', 'guide', gid);
  res.status(201).json({ guide: out(q.get('SELECT * FROM field_guides WHERE id = ?', gid)) });
}));

guidesRouter.patch('/:id', requireRole('content_editor', 'expert', 'admin'), ah(async (req, res) => {
  const d = parse(z.object({ review_status: z.enum(['needs_review', 'approved', 'rejected']).optional() }).passthrough(), req.body);
  if (d.review_status === 'approved' && !['expert', 'admin', 'super_admin'].includes(req.user!.role)) throw new HttpError(403, 'Only a verified expert or administrator can approve guides', 'forbidden');
  const { review_status, ...rest } = d as Row;
  const fields = Object.keys(rest).length ? parse((GuideSchema as any)._def.schema.partial(), rest) : {};
  const set = updateSet({ ...fields, ...(review_status ? { review_status } : {}) });
  if (!set.empty) q.run(`UPDATE field_guides SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, req.params.id);
  audit(req, 'guide.update', 'guide', req.params.id, { review_status });
  res.json({ guide: out(q.get('SELECT * FROM field_guides WHERE id = ?', req.params.id)) });
}));

// ---------------- Official crop statistics ----------------
export const statisticsRouter = Router();

const UNITS: Record<string, string[]> = {
  area: ['hectare', 'thousand hectare'],
  production: ['tonne', 'thousand tonne', 'lakh bale (170 kg)', 'thousand bale (170 kg)'],
  yield: ['kg/hectare', 'tonne/hectare'],
};

statisticsRouter.get('/', ah(async (req, res) => {
  const f = parse(z.object({ crop: z.string().max(100).optional(), state: z.string().max(80).optional(), year: z.string().max(20).optional(), metric: z.enum(['area', 'production', 'yield']).optional() }), req.query);
  const where: string[] = []; const p: unknown[] = [];
  if (f.crop) { where.push('crop = ?'); p.push(f.crop); }
  if (f.state) { where.push('state = ?'); p.push(f.state); }
  if (f.year) { where.push('year = ?'); p.push(f.year); }
  if (f.metric) { where.push('metric = ?'); p.push(f.metric); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  res.json({
    rows: q.all(`SELECT * FROM crop_statistics ${w} ORDER BY year DESC, crop, state, district LIMIT 1000`, ...p),
    facets: {
      crops: q.all<Row>('SELECT DISTINCT crop FROM crop_statistics ORDER BY crop').map((r) => r.crop),
      states: q.all<Row>('SELECT DISTINCT state FROM crop_statistics ORDER BY state').map((r) => r.state),
      years: q.all<Row>('SELECT DISTINCT year FROM crop_statistics ORDER BY year DESC').map((r) => r.year),
    },
    sources: q.all(`SELECT source_name, source_url, publication_date, data_status, MAX(retrieved_at) retrieved_at, COUNT(*) n FROM crop_statistics ${w} GROUP BY source_name, source_url, publication_date, data_status`, ...p),
    note: 'Imported by FARMDirect administrators from the published source shown for each row. Advance estimates and provisional figures are labelled. These are not forecasts or user-submitted data.',
  });
}));

statisticsRouter.post('/import', requirePerm('data.manage'), ah(async (req, res) => {
  const b = parse(z.object({
    source_name: zText(200), source_url: z.string().url().refine((u) => u.startsWith('https://'), 'Use the https link of the official publication'),
    publication_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
    data_status: z.enum(['official', 'provisional', 'advance_estimate']),
    rows: z.array(z.object({
      crop: zText(100), state: zText(80), district: z.string().trim().max(80).optional().default(''), season: z.string().trim().max(40).optional().default(''),
      year: z.string().regex(/^\d{4}(-\d{2})?$/, 'Year like 2022-23 or 2023'), metric: z.enum(['area', 'production', 'yield']),
      value: z.number().min(0).max(1e12), unit: z.string().trim(),
    })).min(1).max(5000),
  }), req.body);
  const bad = b.rows.findIndex((r) => !UNITS[r.metric].includes(r.unit));
  if (bad >= 0) throw new HttpError(400, `Row ${bad + 1}: unit "${b.rows[bad].unit}" is not valid for ${b.rows[bad].metric}. Use one of: ${UNITS[b.rows[bad].metric].join(', ')}`, 'validation_error');
  const batch = id();
  const now = new Date().toISOString();
  let n = 0;
  q.tx(() => {
    for (const r of b.rows) {
      q.run(`INSERT INTO crop_statistics (crop, state, district, season, year, metric, value, unit, data_status, source_name, source_url, publication_date, retrieved_at, import_batch, imported_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(crop, state, district, season, year, metric, source_name) DO UPDATE SET value = excluded.value, unit = excluded.unit, data_status = excluded.data_status,
          source_url = excluded.source_url, publication_date = excluded.publication_date, retrieved_at = excluded.retrieved_at, import_batch = excluded.import_batch, imported_by = excluded.imported_by`,
        r.crop, r.state, r.district, r.season, r.year, r.metric, r.value, r.unit, b.data_status, b.source_name, b.source_url, b.publication_date ?? null, now, batch, req.user!.id);
      n++;
    }
  });
  audit(req, 'statistics.import', 'statistics', batch, { rows: n, source: b.source_name });
  res.status(201).json({ imported: n, batch });
}));

statisticsRouter.delete('/batch/:batch', requirePerm('data.manage'), ah(async (req, res) => {
  const r = q.run('DELETE FROM crop_statistics WHERE import_batch = ?', req.params.batch);
  audit(req, 'statistics.delete_batch', 'statistics', req.params.batch, { rows: r.changes });
  res.json({ deleted: r.changes });
}));

// ---------------- Government e-crop records (integration boundary) ----------------
export const ecropRouter = Router();

/**
 * State e-crop booking systems are run by state agriculture departments. Records
 * may only be retrieved through an authorised interface with the farmer's consent.
 * No such interface is configured, so FARMDirect does not show or infer e-crop data.
 * Farmer-entered crops are always labelled "reported by the farmer".
 */
ecropRouter.get('/status', (_req, res) => {
  res.json({
    available: false,
    message: 'Government e-crop records are not connected. Crop details in FARMDirect are reported by the farmer and are not government-verified.',
    requirements: [
      'A data-sharing agreement or authorised API access from the state agriculture department that runs the e-crop system',
      'Farmer consent for each retrieval, recorded with the request',
      'Server credentials stored as environment variables (never in the app)',
      'A mapping from the state record format (survey number, crop, season, area) to FARMDirect crop cycles',
    ],
  });
});

ecropRouter.post('/fetch', (_req, res) => {
  res.status(503).json({ error: 'Government e-crop records are not connected on this server.', code: 'not_configured' });
});

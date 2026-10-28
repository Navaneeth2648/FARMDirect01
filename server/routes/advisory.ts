import { Router } from 'express';
import { z } from 'zod';
import { q, out, insert, updateSet, type Row } from '../db/index.ts';
import { ah, id, notFound, parse, zOptText, zText } from '../lib/http.ts';
import { requireRole } from '../lib/auth.ts';
import { audit } from '../lib/security.ts';
import { cycleWithStage } from '../services/cropStage.ts';

export const cropsRouter = Router();

cropsRouter.get('/', ah(async (req, res) => {
  const state = typeof req.query.state === 'string' ? req.query.state : null;
  const crops = q.all<Row>('SELECT * FROM crops WHERE active = 1 ORDER BY name').map(out);
  res.json({
    crops: crops.map((c: any) => ({ ...c, regional_fit: state ? (c.regions.length ? c.regions.includes(state) : null) : null })),
  });
}));

cropsRouter.get('/:cropId', ah(async (req, res) => {
  const crop = q.get<Row>('SELECT * FROM crops WHERE id = ?', req.params.cropId);
  if (!crop) throw notFound('Crop');
  res.json({ crop: out(crop), stages: q.all('SELECT * FROM crop_stages WHERE crop_id = ? ORDER BY seq', crop.id) });
}));

// ---------- Advisories ----------
export const advisoryRouter = Router();

advisoryRouter.get('/', ah(async (req, res) => {
  const { crop_id, stage_key, topic, region } = req.query as Record<string, string | undefined>;
  const where = ["review_status != 'rejected'"];
  const params: unknown[] = [];
  if (crop_id) { where.push('crop_id = ?'); params.push(crop_id); }
  if (stage_key) { where.push('stage_key = ?'); params.push(stage_key); }
  if (topic) { where.push('topic = ?'); params.push(topic); }
  if (region) { where.push('(region IS NULL OR region = ?)'); params.push(region); }
  const rows = q.all(`SELECT * FROM advisories WHERE ${where.join(' AND ')}
    ORDER BY CASE review_status WHEN 'approved' THEN 0 ELSE 1 END, region IS NULL, topic LIMIT 200`, ...params);
  res.json({ advisories: rows });
}));

/** Stage-specific advisory for each of the user's active crop cycles. */
advisoryRouter.get('/my', ah(async (req, res) => {
  const user = q.get<Row>('SELECT state FROM users WHERE id = ?', req.user!.id);
  const cycles = q.all<Row>(
    `SELECT cc.*, c.name AS crop_name, f.state AS farm_state, f.name AS farm_name FROM crop_cycles cc
     JOIN crops c ON c.id = cc.crop_id JOIN farms f ON f.id = cc.farm_id WHERE cc.user_id = ? AND cc.status = 'active'`, req.user!.id)
    .map(cycleWithStage);
  const result = cycles.map((c: any) => {
    const region = c.farm_state || user?.state || null;
    const advisories = c.stage
      ? q.all(`SELECT * FROM advisories WHERE crop_id = ? AND stage_key = ? AND review_status != 'rejected'
               AND (region IS NULL OR region = ?) ORDER BY CASE review_status WHEN 'approved' THEN 0 ELSE 1 END, region IS NULL`,
          c.crop_id, c.stage.key, region)
      : [];
    return { cycle: c, advisories };
  });
  res.json({ items: result });
}));

const AdvisorySchema = z.object({
  crop_id: z.string().optional().nullable(), stage_key: zOptText(50),
  topic: z.enum(['general', 'soil', 'irrigation', 'nutrient', 'weed', 'pest', 'disease', 'harvest', 'post_harvest', 'sustainability']),
  title: zText(200), body: zText(5000), region: zOptText(80), language: z.enum(['en', 'hi', 'te', 'ml']).default('en'),
  source_name: zOptText(200), source_url: z.string().url().optional().nullable(),
});

advisoryRouter.post('/', requireRole('expert', 'content_editor', 'admin'), ah(async (req, res) => {
  const data = parse(AdvisorySchema, req.body);
  const aid = id();
  insert('advisories', { id: aid, ...data, created_by: req.user!.id, review_status: 'needs_review' });
  audit(req, 'advisory.create', 'advisory', aid);
  res.status(201).json({ advisory: q.get('SELECT * FROM advisories WHERE id = ?', aid) });
}));

advisoryRouter.patch('/:id', requireRole('expert', 'content_editor', 'admin'), ah(async (req, res) => {
  const a = q.get<Row>('SELECT * FROM advisories WHERE id = ?', req.params.id);
  if (!a) throw notFound('Advisory');
  const set = updateSet(parse(AdvisorySchema.partial(), req.body));
  // Any content change sends it back for review.
  if (!set.empty) q.run(`UPDATE advisories SET ${set.sql}, review_status = 'needs_review', updated_at = datetime('now') WHERE id = ?`, ...set.values, a.id);
  audit(req, 'advisory.update', 'advisory', a.id);
  res.json({ advisory: q.get('SELECT * FROM advisories WHERE id = ?', a.id) });
}));

/** Only verified experts/agronomists or admins can approve advisory content. */
advisoryRouter.post('/:id/review', requireRole('expert', 'admin'), ah(async (req, res) => {
  const { decision } = parse(z.object({ decision: z.enum(['approved', 'rejected']) }), req.body);
  const r = q.run(`UPDATE advisories SET review_status = ?, reviewed_by = ?, reviewed_at = datetime('now') WHERE id = ?`,
    decision, req.user!.id, req.params.id);
  if (!r.changes) throw notFound('Advisory');
  audit(req, `advisory.${decision}`, 'advisory', req.params.id);
  res.json({ ok: true });
}));

// ---------- Soil interpretation ----------
/**
 * Interprets a soil test against the Soil Health Card rating ranges used in
 * India. Output is a classification (low/medium/high) for education and to
 * discuss with an agronomist — not a fertiliser prescription.
 */
export function interpretSoil(t: Row) {
  const items: { parameter: string; value: number; unit: string; rating: string; note: string }[] = [];
  const add = (parameter: string, value: number | null, unit: string, rating: string, note: string) => {
    if (value !== null && value !== undefined) items.push({ parameter, value, unit, rating, note });
  };
  if (t.ph != null) {
    const r = t.ph < 5.5 ? 'strongly acidic' : t.ph < 6.5 ? 'acidic' : t.ph <= 7.5 ? 'neutral' : t.ph <= 8.5 ? 'alkaline' : 'strongly alkaline (possible sodicity)';
    add('pH', t.ph, '', r, t.ph < 6.5 ? 'Acidic soils may need liming; ask your soil lab/KVK.' : t.ph > 8.5 ? 'High pH may indicate sodic soil; gypsum treatment is sometimes advised after testing.' : 'Suitable for most crops.');
  }
  if (t.ec != null) add('Electrical conductivity', t.ec, 'dS/m', t.ec < 1 ? 'normal' : t.ec < 2 ? 'moderately saline (sensitive crops affected)' : 'saline', t.ec >= 1 ? 'Salinity can reduce yields of sensitive crops; improve drainage.' : 'No salinity concern.');
  if (t.organic_carbon != null) add('Organic carbon', t.organic_carbon, '%', t.organic_carbon < 0.5 ? 'low' : t.organic_carbon <= 0.75 ? 'medium' : 'high', t.organic_carbon < 0.5 ? 'Add compost, FYM, green manure or crop residues.' : '');
  if (t.nitrogen != null) add('Available nitrogen', t.nitrogen, 'kg/ha', t.nitrogen < 280 ? 'low' : t.nitrogen <= 560 ? 'medium' : 'high', '');
  if (t.phosphorus != null) add('Available phosphorus', t.phosphorus, 'kg/ha', t.phosphorus < 10 ? 'low' : t.phosphorus <= 25 ? 'medium' : 'high', '');
  if (t.potassium != null) add('Available potassium', t.potassium, 'kg/ha', t.potassium < 110 ? 'low' : t.potassium <= 280 ? 'medium' : 'high', '');
  if (t.zinc != null) add('Zinc (DTPA)', t.zinc, 'ppm', t.zinc < 0.6 ? 'deficient' : 'sufficient', '');
  if (t.iron != null) add('Iron (DTPA)', t.iron, 'ppm', t.iron < 4.5 ? 'deficient' : 'sufficient', '');
  if (t.boron != null) add('Boron', t.boron, 'ppm', t.boron < 0.5 ? 'deficient' : 'sufficient', '');
  if (t.sulphur != null) add('Sulphur', t.sulphur, 'ppm', t.sulphur < 10 ? 'deficient' : 'sufficient', '');
  return {
    items,
    basis: 'Soil Health Card rating ranges (Govt. of India). Educational classification only.',
    disclaimer: 'Use your Soil Health Card or a local agronomist for crop-specific fertiliser doses.',
  };
}

advisoryRouter.get('/soil/:testId', ah(async (req, res) => {
  const t = q.get<Row>('SELECT * FROM soil_tests WHERE id = ? AND user_id = ?', req.params.testId, req.user!.id);
  if (!t) throw notFound('Soil test');
  res.json(interpretSoil(t));
}));

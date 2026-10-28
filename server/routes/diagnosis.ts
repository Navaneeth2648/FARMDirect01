import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.ts';
import { q, out, insert, type Row } from '../db/index.ts';
import { ah, HttpError, id, notFound, parse, zOptText } from '../lib/http.ts';
import { isVerifiedExpert } from '../lib/auth.ts';
import { audit, rateLimit } from '../lib/security.ts';
import { aiConfigured, diagnoseImage } from '../providers/ai.ts';
import { getForecast } from '../providers/weather.ts';
import { notify } from '../services/notify.ts';

export const diagnosisRouter = Router();

const MAX_BYTES = 8 * 1024 * 1024;
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 1 } });

/** Identify the image type from its magic bytes; the client-supplied MIME type is not trusted. */
export function sniffImage(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  return null;
}

const MIN_CONFIDENCE = 0.5;

async function runDiagnosis(diagId: string, buf: Buffer, mime: string, ctx: Row) {
  try {
    let weatherSummary: string | undefined;
    if (ctx.lat != null && ctx.lon != null) {
      try {
        const w = await getForecast(ctx.lat, ctx.lon);
        const c = w.forecast.current;
        weatherSummary = `now ${c.temperature_2m}°C, humidity ${c.relative_humidity_2m}%, rain next 3 days ${w.forecast.daily.precipitation_sum.slice(0, 3).reduce<number>((a, b) => a + (b ?? 0), 0).toFixed(1)} mm`;
      } catch { /* weather is optional context */ }
    }
    const { result, model } = await diagnoseImage({
      imageBase64: buf.toString('base64'), mime, crop: ctx.crop_name, plantPart: ctx.plant_part, stage: ctx.growth_stage,
      symptoms: ctx.symptoms, language: ctx.language, weatherSummary,
    });
    const conf = result.primary_issue?.confidence ?? 0;
    let status = 'completed';
    if (result.image_quality === 'poor' || result.image_quality === 'not_a_plant') status = 'needs_better_image';
    if (status === 'completed' && (conf < MIN_CONFIDENCE || result.primary_issue?.type === 'unknown')) {
      result.expert_review_recommended = true;
    }
    q.run(`UPDATE diagnoses SET status = ?, result_json = ?, confidence = ?, model = ?, updated_at = datetime('now') WHERE id = ?`,
      status, JSON.stringify(result), conf, model, diagId);
    notify(ctx.user_id, 'expert', 'Crop Doctor result ready', status === 'completed'
      ? `Preliminary result: ${result.primary_issue?.name ?? 'see details'}` : 'Please retake the photo for a reliable result.',
      `diagnosis:${diagId}`, `/crop-doctor/${diagId}`);
  } catch (e: any) {
    q.run(`UPDATE diagnoses SET status = 'failed', error = ?, updated_at = datetime('now') WHERE id = ?`,
      'The analysis could not be completed. Please try again or ask an expert.', diagId);
    console.error(JSON.stringify({ level: 'error', msg: 'diagnosis failed', id: diagId, err: e?.message }));
  }
}

const SubmitSchema = z.object({
  farm_id: z.string().optional().nullable(), crop_cycle_id: z.string().optional().nullable(), crop_id: z.string().optional().nullable(),
  plant_part: z.enum(['leaf', 'stem', 'fruit', 'flower', 'root', 'whole_plant', 'grain', 'other']).optional().nullable(),
  growth_stage: zOptText(80), symptoms: zOptText(1000),
});

diagnosisRouter.get('/status', (_req, res) => {
  res.json({ configured: aiConfigured(), setup: aiConfigured() ? null : 'Set GEMINI_API_KEY to enable AI image analysis.' });
});

diagnosisRouter.post('/',
  rateLimit({ name: 'diagnosis', windowMs: 60 * 60_000, max: 20, key: (r) => r.user!.id }),
  upload.single('image'),
  ah(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Please attach a photo of the affected plant', 'no_image');
    const mime = sniffImage(req.file.buffer);
    if (!mime) throw new HttpError(400, 'Only JPEG, PNG or WebP photos are accepted', 'bad_image');
    const data = parse(SubmitSchema, req.body);
    const uid = req.user!.id;
    let farm: Row | undefined;
    if (data.farm_id) {
      farm = q.get<Row>('SELECT * FROM farms WHERE id = ? AND user_id = ?', data.farm_id, uid);
      if (!farm) throw notFound('Farm');
    }
    let cropId = data.crop_id ?? null;
    if (data.crop_cycle_id) {
      const c = q.get<Row>('SELECT * FROM crop_cycles WHERE id = ? AND user_id = ?', data.crop_cycle_id, uid);
      if (!c) throw notFound('Crop cycle');
      cropId = c.crop_id;
    }
    const crop = cropId ? q.get<Row>('SELECT name FROM crops WHERE id = ?', cropId) : undefined;
    const user = q.get<Row>('SELECT language, keep_diagnosis_history FROM users WHERE id = ?', uid)!;

    // Store under a random name in a per-user directory outside the web root.
    const rel = path.join(uid, `${crypto.randomBytes(16).toString('hex')}.${mime.split('/')[1]}`);
    fs.mkdirSync(path.join(config.uploadDir, uid), { recursive: true });
    fs.writeFileSync(path.join(config.uploadDir, rel), req.file.buffer);

    const did = id();
    const configured = aiConfigured();
    insert('diagnoses', {
      id: did, user_id: uid, farm_id: farm?.id ?? null, crop_cycle_id: data.crop_cycle_id ?? null, crop_id: cropId,
      plant_part: data.plant_part, growth_stage: data.growth_stage, symptoms: data.symptoms, image_path: rel, image_mime: mime,
      status: configured ? 'processing' : 'not_configured', saved: user.keep_diagnosis_history ? 1 : 0,
    });
    q.run(`INSERT INTO usage_events (user_id, module) VALUES (?, 'crop_doctor')`, uid);
    if (configured) {
      // Background processing; the client polls GET /:id.
      setImmediate(() => runDiagnosis(did, req.file!.buffer, mime, {
        user_id: uid, crop_name: crop?.name, plant_part: data.plant_part, growth_stage: data.growth_stage, symptoms: data.symptoms,
        language: user.language, lat: farm?.latitude, lon: farm?.longitude,
      }));
    }
    res.status(202).json({ diagnosis: out(q.get('SELECT * FROM diagnoses WHERE id = ?', did)) });
  }));

function canView(req: any, d: Row) {
  if (d.user_id === req.user.id) return true;
  // Reviewers may see a diagnosis only when the farmer has opened an expert case for it.
  return isVerifiedExpert(req.user) && !!q.get('SELECT 1 FROM expert_cases WHERE diagnosis_id = ?', d.id);
}

diagnosisRouter.get('/', ah(async (req, res) => {
  const rows = q.all<Row>(
    `SELECT d.*, c.name AS crop_name FROM diagnoses d LEFT JOIN crops c ON c.id = d.crop_id
     WHERE d.user_id = ? AND (d.saved = 1 OR d.created_at > datetime('now', '-1 day')) ORDER BY d.created_at DESC LIMIT 100`, req.user!.id);
  res.json({ diagnoses: rows.map(out) });
}));

diagnosisRouter.get('/:id', ah(async (req, res) => {
  const d = q.get<Row>('SELECT d.*, c.name AS crop_name FROM diagnoses d LEFT JOIN crops c ON c.id = d.crop_id WHERE d.id = ?', req.params.id);
  if (!d || !canView(req, d)) throw notFound('Diagnosis');
  res.json({
    diagnosis: out(d),
    disclaimer: 'This is a preliminary, AI-generated assessment from a photo. It does not replace laboratory testing or inspection by an agronomist. Use only products registered for your crop and always follow the label.',
  });
}));

/** Authenticated image access (owner or authorised reviewer only). */
diagnosisRouter.get('/:id/image', ah(async (req, res) => {
  const d = q.get<Row>('SELECT * FROM diagnoses WHERE id = ?', req.params.id);
  if (!d || !canView(req, d) || !d.image_path) throw notFound('Image');
  const full = path.resolve(config.uploadDir, d.image_path);
  if (!full.startsWith(path.resolve(config.uploadDir))) throw notFound('Image');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.type(d.image_mime).sendFile(full);
}));

diagnosisRouter.post('/:id/save', ah(async (req, res) => {
  const r = q.run('UPDATE diagnoses SET saved = 1 WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!r.changes) throw notFound('Diagnosis');
  res.json({ ok: true });
}));

diagnosisRouter.delete('/:id/image', ah(async (req, res) => {
  const d = q.get<Row>('SELECT * FROM diagnoses WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!d) throw notFound('Diagnosis');
  if (d.image_path) fs.rm(path.join(config.uploadDir, d.image_path), { force: true }, () => {});
  q.run('UPDATE diagnoses SET image_path = NULL WHERE id = ?', d.id);
  res.json({ ok: true });
}));

diagnosisRouter.delete('/:id', ah(async (req, res) => {
  const d = q.get<Row>('SELECT * FROM diagnoses WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!d) throw notFound('Diagnosis');
  if (d.image_path) fs.rm(path.join(config.uploadDir, d.image_path), { force: true }, () => {});
  q.run('DELETE FROM diagnoses WHERE id = ?', d.id);
  audit(req, 'diagnosis.delete', 'diagnosis', d.id);
  res.json({ ok: true });
}));

/** Farmer asks an expert to review this diagnosis (consents to sharing the image with reviewers). */
diagnosisRouter.post('/:id/expert', ah(async (req, res) => {
  const d = q.get<Row>('SELECT * FROM diagnoses WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!d) throw notFound('Diagnosis');
  const b = parse(z.object({ question: z.string().trim().min(3).max(2000), urgency: z.enum(['normal', 'urgent']).default('normal'), allow_contact: z.boolean().default(false) }), req.body);
  const existing = q.get<Row>(`SELECT id FROM expert_cases WHERE diagnosis_id = ? AND status NOT IN ('closed')`, d.id);
  if (existing) return res.json({ caseId: existing.id, existing: true });
  const cid = id();
  insert('expert_cases', {
    id: cid, farmer_id: d.user_id, diagnosis_id: d.id, farm_id: d.farm_id, crop_id: d.crop_id, question: b.question,
    urgency: b.urgency, allow_contact: b.allow_contact,
  });
  q.run(`UPDATE diagnoses SET expert_status = 'requested', saved = 1 WHERE id = ?`, d.id);
  res.status(201).json({ caseId: cid });
}));

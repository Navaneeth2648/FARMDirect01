import { Router, type Request } from 'express';
import { z } from 'zod';
import { q, type Row } from '../db/index.ts';
import { ah, HttpError, parse } from '../lib/http.ts';
import { rateLimit } from '../lib/security.ts';
import { geocode, getForecast, WEATHER_CODES } from '../providers/weather.ts';
import { evaluate, type CycleCtx, type TaskCtx } from '../services/agroRules.ts';
import { cycleWithStage } from '../services/cropStage.ts';

export const weatherRouter = Router();
const limiter = rateLimit({ name: 'weather', windowMs: 60_000, max: 60, key: (r) => r.user?.id || r.ip || '' });
weatherRouter.use(limiter);

export function activeCycleContexts(userId: string, farmId?: string): CycleCtx[] {
  const rows = q.all<Row>(
    `SELECT cc.*, c.name AS crop_name, c.category FROM crop_cycles cc JOIN crops c ON c.id = cc.crop_id
     WHERE cc.user_id = ? AND cc.status = 'active' ${farmId ? 'AND cc.farm_id = ?' : ''}`, ...(farmId ? [userId, farmId] : [userId]));
  return rows.map(cycleWithStage).map((c: any) => ({
    id: c.id, crop_id: c.crop_id, crop_name: c.crop_name, category: c.category,
    stage_key: c.stage_status === 'in_progress' ? c.stage?.key ?? null : null,
    stage_name: c.stage?.name ?? null, water_need: c.stage?.water_need ?? null,
  }));
}

export function upcomingTasks(userId: string, farmId?: string): TaskCtx[] {
  return q.all<TaskCtx>(
    `SELECT id, category, title, due_date FROM tasks WHERE user_id = ? AND status = 'pending'
     AND due_date BETWEEN date('now', '-1 day') AND date('now', '+3 day') ${farmId ? 'AND farm_id = ?' : ''}`,
    ...(farmId ? [userId, farmId] : [userId]));
}

export function resolveLocation(req: Request): { lat: number; lon: number; label: string; farmId?: string } {
  const farmId = typeof req.query.farm_id === 'string' ? req.query.farm_id : undefined;
  if (farmId) {
    const f = q.get<Row>('SELECT * FROM farms WHERE id = ? AND user_id = ?', farmId, req.user!.id);
    if (!f) throw new HttpError(404, 'Farm not found', 'not_found');
    if (f.latitude == null || f.longitude == null) {
      throw new HttpError(400, 'This farm has no location yet. Add a location to the farm to see its weather.', 'no_location');
    }
    return { lat: f.latitude, lon: f.longitude, label: f.name, farmId };
  }
  if (req.query.lat !== undefined && req.query.lon !== undefined) {
    const { lat, lon } = parse(z.object({ lat: z.coerce.number().min(-90).max(90), lon: z.coerce.number().min(-180).max(180) }), req.query);
    return { lat, lon, label: typeof req.query.label === 'string' ? req.query.label.slice(0, 100) : `${lat.toFixed(2)}, ${lon.toFixed(2)}` };
  }
  const f = q.get<Row>('SELECT * FROM farms WHERE user_id = ? AND latitude IS NOT NULL ORDER BY created_at LIMIT 1', req.user!.id);
  if (f) return { lat: f.latitude, lon: f.longitude, label: f.name, farmId: f.id };
  const u = q.get<Row>('SELECT latitude, longitude, village, district FROM users WHERE id = ?', req.user!.id);
  if (u?.latitude != null) return { lat: u.latitude, lon: u.longitude, label: u.village || u.district || 'My location' };
  throw new HttpError(400, 'No location set. Search for your village or add a farm location.', 'no_location');
}

weatherRouter.get('/', ah(async (req, res) => {
  const loc = resolveLocation(req);
  let w;
  try {
    w = await getForecast(loc.lat, loc.lon);
  } catch {
    throw new HttpError(503, 'Weather service is temporarily unavailable. Please try again shortly.', 'provider_unavailable');
  }
  const cycles = activeCycleContexts(req.user!.id, loc.farmId);
  const recommendations = evaluate(w.forecast, cycles, upcomingTasks(req.user!.id, loc.farmId));
  res.json({
    location: { ...loc },
    provider: w.provider,
    providerNote: 'Model forecast from Open-Meteo. Not an official IMD warning.',
    fetchedAt: w.fetchedAt,
    stale: w.stale,
    forecast: w.forecast,
    codes: WEATHER_CODES,
    recommendations,
    cyclesConsidered: cycles,
  });
}));

weatherRouter.get('/geocode', ah(async (req, res) => {
  const { name } = parse(z.object({ name: z.string().trim().min(2).max(100) }), req.query);
  try {
    res.json({ places: await geocode(name) });
  } catch {
    throw new HttpError(503, 'Location search is temporarily unavailable', 'provider_unavailable');
  }
}));

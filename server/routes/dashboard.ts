import { Router } from 'express';
import { z } from 'zod';
import { q, out, type Row } from '../db/index.ts';
import { ah, HttpError, notFound, parse } from '../lib/http.ts';
import { cycleWithStage } from '../services/cropStage.ts';
import { getForecast } from '../providers/weather.ts';
import { evaluate } from '../services/agroRules.ts';
import { activeCycleContexts, upcomingTasks } from './weather.ts';
import { alertsForUser } from './alerts.ts';
import { satelliteConfigured, ndviSeries } from '../providers/satellite.ts';
import { NotConfiguredError } from '../providers/fetcher.ts';

export const dashboardRouter = Router();

/** One call for the home screen; each section degrades independently. */
dashboardRouter.get('/', ah(async (req, res) => {
  const uid = req.user!.id;
  const user = out(q.get<Row>('SELECT * FROM users WHERE id = ?', uid))!;
  const farms = q.all<Row>('SELECT * FROM farms WHERE user_id = ? ORDER BY created_at', uid);
  const cycles = q.all<Row>(`SELECT cc.*, c.name AS crop_name, f.name AS farm_name FROM crop_cycles cc JOIN crops c ON c.id = cc.crop_id
    JOIN farms f ON f.id = cc.farm_id WHERE cc.user_id = ? AND cc.status = 'active' ORDER BY cc.sowing_date`, uid).map(cycleWithStage);
  const tasks = q.all(`SELECT t.*, CASE WHEN t.due_date < date('now') THEN 1 ELSE 0 END AS overdue FROM tasks t
    WHERE t.user_id = ? AND t.status = 'pending' AND t.due_date <= date('now', '+7 day') ORDER BY t.due_date LIMIT 12`, uid);

  let weather: any = null;
  const located = farms.find((f) => f.latitude != null) || (user.latitude != null ? { latitude: user.latitude, longitude: user.longitude, id: undefined, name: 'My location' } : null);
  if (located) {
    try {
      const w = await getForecast(located.latitude, located.longitude);
      weather = {
        location: located.name, farmId: located.id, fetchedAt: w.fetchedAt, stale: w.stale, provider: w.provider,
        current: w.forecast.current, daily: w.forecast.daily,
        recommendations: evaluate(w.forecast, activeCycleContexts(uid, located.id), upcomingTasks(uid, located.id)),
      };
    } catch {
      weather = { error: 'Weather service unavailable' };
    }
  }

  const watch = q.all<Row>('SELECT * FROM market_watchlist WHERE user_id = ? LIMIT 5', uid);
  const cropNames = q.all<Row>(`SELECT DISTINCT c.agmarknet_name FROM crop_cycles cc JOIN crops c ON c.id = cc.crop_id WHERE cc.user_id = ? AND cc.status = 'active'`, uid)
    .map((r) => r.agmarknet_name).filter(Boolean);
  const commodities = [...new Set([...watch.map((w) => w.commodity), ...cropNames])].slice(0, 6);
  const state = farms[0]?.state || user.state;
  const prices = commodities.map((c) =>
    q.get(`SELECT * FROM market_prices WHERE commodity = ? ${state ? 'AND state = ?' : ''} ORDER BY arrival_date DESC, modal_price DESC LIMIT 1`,
      ...(state ? [c, state] : [c])) ?? { commodity: c, missing: true });

  res.json({
    user,
    farms: farms.length,
    cycles,
    tasks,
    weather,
    alerts: alertsForUser(uid, 5),
    prices,
    news: q.all(`SELECT id, title, type, summary, published_at, event_date FROM content WHERE status = 'published'
      AND type IN ('news','event','webinar','training') ORDER BY COALESCE(event_date, published_at) DESC LIMIT 4`),
    schemes: q.all(`SELECT id, name, level, scheme_type, official_url FROM schemes WHERE active = 1 AND (level = 'central' OR state = ?) LIMIT 4`, state ?? null).map(out),
    saved: q.all('SELECT * FROM saved_items WHERE user_id = ? ORDER BY created_at DESC LIMIT 5', uid),
    recent: q.all('SELECT * FROM recent_views WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 5', uid),
    unreadNotifications: q.get<Row>('SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND read_at IS NULL', uid)!.n,
  });
}));

// ---------- Satellite / remote sensing ----------
export const satelliteRouter = Router();

satelliteRouter.get('/status', (_req, res) => {
  res.json({
    configured: satelliteConfigured(),
    setup: satelliteConfigured() ? null : 'Set SENTINELHUB_CLIENT_ID and SENTINELHUB_CLIENT_SECRET to enable Sentinel-2 NDVI.',
    note: 'NDVI shows vegetation vigour. It is an indicator only — low values can have many causes and must be checked in the field.',
  });
});

satelliteRouter.get('/plots/:plotId/ndvi', ah(async (req, res) => {
  const plot = q.get<Row>('SELECT p.* FROM plots p JOIN farms f ON f.id = p.farm_id WHERE p.id = ? AND f.user_id = ?', req.params.plotId, req.user!.id);
  if (!plot) throw notFound('Plot');
  if (!plot.boundary_geojson) throw new HttpError(400, 'Draw the plot boundary first', 'no_boundary');
  const { days } = parse(z.object({ days: z.coerce.number().int().min(15).max(365).default(90) }), req.query);
  const to = new Date();
  const from = new Date(Date.now() - days * 86400_000);
  try {
    const series = await ndviSeries(JSON.parse(plot.boundary_geojson), from.toISOString(), to.toISOString());
    res.json({
      provider: 'Sentinel Hub – Copernicus Sentinel-2 L2A (10 m)', series,
      cloudNote: 'Intervals with no valid (cloud-free) pixels are shown as missing.',
    });
  } catch (e) {
    if (e instanceof NotConfiguredError) throw new HttpError(503, 'Satellite imagery is not configured on this server', 'not_configured', { setup: e.setup });
    throw new HttpError(503, 'Satellite service is unavailable right now', 'provider_unavailable');
  }
}));

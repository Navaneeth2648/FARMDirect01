import { Router } from 'express';
import { z } from 'zod';
import { q, type Row } from '../db/index.ts';
import { ah, HttpError, id, parse, zOptText } from '../lib/http.ts';
import { rateLimit } from '../lib/security.ts';
import { mandiConfigured, refreshPrices } from '../providers/mandi.ts';
import { NotConfiguredError } from '../providers/fetcher.ts';

export const marketRouter = Router();
marketRouter.use(rateLimit({ name: 'market', windowMs: 60_000, max: 60, key: (r) => r.user?.id || r.ip || '' }));

const SearchSchema = z.object({
  commodity: z.string().max(100).optional(), state: z.string().max(80).optional(), district: z.string().max(80).optional(),
  market: z.string().max(120).optional(), variety: z.string().max(100).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  min_price: z.coerce.number().min(0).optional(), max_price: z.coerce.number().min(0).optional(),
  refresh: z.enum(['0', '1']).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100), offset: z.coerce.number().int().min(0).default(0),
});

marketRouter.get('/status', (_req, res) => {
  const last = q.get<Row>('SELECT MAX(fetched_at) AS last_fetch, MAX(arrival_date) AS latest_date, COUNT(*) AS n FROM market_prices');
  res.json({
    configured: mandiConfigured(),
    source: 'Agmarknet via data.gov.in (Open Government Data Platform India)',
    setup: mandiConfigured() ? null : 'Set DATA_GOV_IN_API_KEY (free key from https://data.gov.in) to load official mandi prices.',
    lastFetch: last?.last_fetch ?? null, latestArrivalDate: last?.latest_date ?? null, storedRecords: last?.n ?? 0,
  });
});

marketRouter.get('/prices', ah(async (req, res) => {
  const f = parse(SearchSchema, req.query);
  let refreshError: string | null = null;
  if (f.refresh !== '0' && (f.commodity || f.state)) {
    try {
      await refreshPrices({ commodity: f.commodity, state: f.state, district: f.district, market: f.market });
    } catch (e) {
      refreshError = e instanceof NotConfiguredError ? 'not_configured' : 'Provider unavailable – showing stored data only';
    }
  }
  const where: string[] = [];
  const params: unknown[] = [];
  const like = (col: string, v?: string) => { if (v) { where.push(`${col} LIKE ?`); params.push(`%${v}%`); } };
  like('commodity', f.commodity); like('state', f.state); like('district', f.district); like('market', f.market); like('variety', f.variety);
  if (f.from) { where.push('arrival_date >= ?'); params.push(f.from); }
  if (f.to) { where.push('arrival_date <= ?'); params.push(f.to); }
  if (f.min_price !== undefined) { where.push('modal_price >= ?'); params.push(f.min_price); }
  if (f.max_price !== undefined) { where.push('modal_price <= ?'); params.push(f.max_price); }
  const w = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = q.all(`SELECT * FROM market_prices ${w} ORDER BY arrival_date DESC, modal_price DESC LIMIT ? OFFSET ?`, ...params, f.limit, f.offset);
  const total = q.get<Row>(`SELECT COUNT(*) AS n FROM market_prices ${w}`, ...params)?.n ?? 0;
  res.json({
    prices: rows, total, configured: mandiConfigured(), refreshError,
    note: 'Prices are as published by the mandi on the arrival date shown. They are not live.',
    unit: 'INR per quintal (100 kg)',
  });
}));

/** Daily modal-price history for one commodity across markets (from stored records). */
marketRouter.get('/history', ah(async (req, res) => {
  const f = parse(z.object({
    commodity: z.string().min(1).max(100), state: z.string().max(80).optional(), market: z.string().max(120).optional(),
    days: z.coerce.number().int().min(7).max(365).default(60),
  }), req.query);
  const params: unknown[] = [f.commodity, `-${f.days} day`];
  let extra = '';
  if (f.state) { extra += ' AND state = ?'; params.push(f.state); }
  if (f.market) { extra += ' AND market = ?'; params.push(f.market); }
  const rows = q.all<Row>(
    `SELECT arrival_date, market, AVG(modal_price) AS modal, MIN(min_price) AS min, MAX(max_price) AS max
     FROM market_prices WHERE commodity = ? AND arrival_date >= date('now', ?) ${extra} AND modal_price IS NOT NULL
     GROUP BY arrival_date, market ORDER BY arrival_date`, ...params);
  // Simple trend summary from the overall daily average.
  const daily = new Map<string, number[]>();
  for (const r of rows) daily.set(r.arrival_date, [...(daily.get(r.arrival_date) || []), r.modal]);
  const series = [...daily.entries()].map(([d, v]) => ({ date: d, modal: v.reduce((a, b) => a + b, 0) / v.length }));
  let trend: string | null = null;
  if (series.length >= 4) {
    const half = Math.floor(series.length / 2);
    const a = series.slice(0, half).reduce((s, x) => s + x.modal, 0) / half;
    const b = series.slice(half).reduce((s, x) => s + x.modal, 0) / (series.length - half);
    const pct = ((b - a) / a) * 100;
    trend = `Average modal price ${pct >= 0 ? 'rose' : 'fell'} ${Math.abs(pct).toFixed(1)}% between the first and second half of the period (${series.length} reporting days).`;
  }
  res.json({ rows, series, trend, note: 'History is built from records stored each time prices are fetched; gaps mean no data was published or fetched.' });
}));

marketRouter.get('/compare', ah(async (req, res) => {
  const f = parse(z.object({ commodity: z.string().min(1).max(100), markets: z.string().max(1000) }), req.query);
  const markets = f.markets.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const latest = markets.map((m) => q.get(
    `SELECT * FROM market_prices WHERE commodity = ? AND market = ? ORDER BY arrival_date DESC LIMIT 1`, f.commodity, m) ?? { market: m, missing: true });
  res.json({ comparison: latest });
}));

marketRouter.get('/facets', ah(async (_req, res) => {
  res.json({
    commodities: q.all<Row>('SELECT DISTINCT commodity FROM market_prices ORDER BY commodity').map((r) => r.commodity),
    states: q.all<Row>('SELECT DISTINCT state FROM market_prices ORDER BY state').map((r) => r.state),
    crops: q.all<Row>('SELECT id, name, agmarknet_name FROM crops WHERE active = 1 ORDER BY name'),
  });
}));

// ---------- Watchlist ----------
const WatchSchema = z.object({
  commodity: z.string().min(1).max(100), state: zOptText(80), district: zOptText(80), market: zOptText(120),
  alert_change_pct: z.number().min(1).max(100).optional().nullable(),
});

marketRouter.get('/watchlist', ah(async (req, res) => {
  const items = q.all<Row>('SELECT * FROM market_watchlist WHERE user_id = ? ORDER BY created_at DESC', req.user!.id);
  res.json({
    items: items.map((w) => ({
      ...w,
      latest: q.get(`SELECT * FROM market_prices WHERE commodity = ? ${w.state ? 'AND state = ?' : ''} ${w.market ? 'AND market = ?' : ''}
        ORDER BY arrival_date DESC LIMIT 1`, ...[w.commodity, ...(w.state ? [w.state] : []), ...(w.market ? [w.market] : [])]) ?? null,
    })),
  });
}));

marketRouter.post('/watchlist', ah(async (req, res) => {
  const d = parse(WatchSchema, req.body);
  q.run(`INSERT OR IGNORE INTO market_watchlist (id, user_id, commodity, state, district, market, alert_change_pct) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id(), req.user!.id, d.commodity, d.state ?? null, d.district ?? null, d.market ?? null, d.alert_change_pct ?? null);
  res.status(201).json({ ok: true });
}));

marketRouter.delete('/watchlist/:id', ah(async (req, res) => {
  q.run('DELETE FROM market_watchlist WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  res.json({ ok: true });
}));

marketRouter.post('/feedback', ah(async (req, res) => {
  const d = parse(z.object({ price_id: z.number().int(), message: z.string().trim().min(5).max(1000) }), req.body);
  if (!q.get('SELECT 1 FROM market_prices WHERE id = ?', d.price_id)) throw new HttpError(404, 'Price record not found', 'not_found');
  q.run('INSERT INTO market_feedback (id, user_id, price_id, message) VALUES (?, ?, ?, ?)', id(), req.user!.id, d.price_id, d.message);
  res.status(201).json({ ok: true });
}));

import { z } from 'zod';
import { config } from '../config.ts';
import { q } from '../db/index.ts';
import { fetchJson, NotConfiguredError } from './fetcher.ts';

/**
 * Agmarknet "Current daily price of various commodities from various markets"
 * via the official Open Government Data platform (data.gov.in). Prices are in
 * INR per quintal as published. Every fetched row is stored so price history
 * accumulates over time.
 */

const RecordSchema = z.object({
  state: z.string(),
  district: z.string().optional().nullable(),
  market: z.string(),
  commodity: z.string(),
  variety: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  arrival_date: z.string(),
  min_price: z.union([z.string(), z.number()]).optional().nullable(),
  max_price: z.union([z.string(), z.number()]).optional().nullable(),
  modal_price: z.union([z.string(), z.number()]).optional().nullable(),
});

export type MandiRecord = {
  state: string; district: string | null; market: string; commodity: string; variety: string | null; grade: string | null;
  arrival_date: string; min_price: number | null; max_price: number | null; modal_price: number | null; unit: string;
};

const num = (v: unknown) => {
  if (v === null || v === undefined || v === '' || v === 'NR') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** Agmarknet publishes dates as DD/MM/YYYY. */
export function normaliseDate(s: string) {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

export function parseRecords(raw: unknown): MandiRecord[] {
  const records = (raw as any)?.records;
  if (!Array.isArray(records)) return [];
  const out: MandiRecord[] = [];
  for (const r of records) {
    const p = RecordSchema.safeParse(r);
    if (!p.success) continue;
    const date = normaliseDate(p.data.arrival_date);
    if (!date) continue;
    const rec: MandiRecord = {
      state: p.data.state.trim(), district: p.data.district?.trim() || null, market: p.data.market.trim(),
      commodity: p.data.commodity.trim(), variety: p.data.variety?.trim() || null, grade: p.data.grade?.trim() || null,
      arrival_date: date, min_price: num(p.data.min_price), max_price: num(p.data.max_price), modal_price: num(p.data.modal_price),
      unit: 'INR/quintal',
    };
    // Drop obviously inconsistent rows rather than displaying them.
    if (rec.min_price !== null && rec.max_price !== null && rec.min_price > rec.max_price) continue;
    out.push(rec);
  }
  return out;
}

export function mandiConfigured() {
  return !!config.mandi.apiKey;
}

const lastFetch = new Map<string, number>();

export async function refreshPrices(filters: { commodity?: string; state?: string; district?: string; market?: string }) {
  if (!config.mandi.apiKey) {
    throw new NotConfiguredError('Agmarknet (data.gov.in)', 'Register at https://data.gov.in, generate an API key and set DATA_GOV_IN_API_KEY.');
  }
  const key = JSON.stringify(filters);
  const last = lastFetch.get(key);
  if (last && Date.now() - last < config.mandi.cacheMinutes * 60_000) return { fetched: 0, cached: true };

  const params = new URLSearchParams({ 'api-key': config.mandi.apiKey, format: 'json', limit: '500' });
  if (filters.commodity) params.set('filters[commodity]', filters.commodity);
  if (filters.state) params.set('filters[state]', filters.state);
  if (filters.district) params.set('filters[district]', filters.district);
  if (filters.market) params.set('filters[market]', filters.market);

  const raw = await fetchJson('agmarknet', 'prices', `https://api.data.gov.in/resource/${config.mandi.resourceId}?${params}`, { timeoutMs: 15_000 });
  const rows = parseRecords(raw);
  const fetchedAt = new Date().toISOString();
  const ins = `INSERT INTO market_prices (source, state, district, market, commodity, variety, grade, arrival_date, min_price, max_price, modal_price, unit, fetched_at)
    VALUES ('agmarknet', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, state, market, commodity, variety, grade, arrival_date)
    DO UPDATE SET min_price = excluded.min_price, max_price = excluded.max_price, modal_price = excluded.modal_price, fetched_at = excluded.fetched_at`;
  q.tx(() => {
    for (const r of rows) {
      q.run(ins, r.state, r.district, r.market, r.commodity, r.variety ?? '', r.grade ?? '', r.arrival_date, r.min_price, r.max_price, r.modal_price, r.unit, fetchedAt);
    }
  });
  lastFetch.set(key, Date.now());
  return { fetched: rows.length, cached: false };
}

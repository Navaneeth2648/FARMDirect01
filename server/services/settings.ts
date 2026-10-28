import { q, type Row } from '../db/index.ts';

/**
 * Marketplace rules editable by authorised administrators (every change is audited).
 * Defaults deliberately charge no platform fee: fees are never invented.
 */
export const SETTING_DEFAULTS = {
  platform_fee_buyer_pct: 0,
  platform_fee_farmer_pct: 0,
  tax_on_fees_pct: 18,              // GST applied only to platform fees, if any fee is set
  order_confirm_hours: 48,          // accepted offers must be confirmed by both sides within this time
  offer_expiry_hours: 72,
  lot_expiry_days: 30,
  stepup_threshold_inr: 100000,     // OTP re-confirmation above this order value
  profile_level_max_order_inr: 200000, // farmers without identity verification
  unverified_buyer_max_order_inr: 0,   // unverified buyers cannot transact
  storage_hold_hours: 48,           // capacity held while the facility reviews a request
  transport_rate_per_qtl_km: null as number | null, // optional platform default estimate; null = ask for quotes
  road_distance_factor: 1.3,        // straight-line → road distance estimate
} as const;
export type SettingKey = keyof typeof SETTING_DEFAULTS;

/** Assumed monthly quality/weight loss by crop category (editable). Used only in clearly labelled estimates. */
export const DEFAULT_SPOILAGE_PCT_PER_MONTH: Record<string, number> = {
  cereal: 0.5, pulse: 0.5, oilseed: 1, spice: 1, cash: 1, vegetable: 15, fruit: 10, other: 2,
};

export function getSetting<K extends SettingKey>(key: K): (typeof SETTING_DEFAULTS)[K] {
  const r = q.get<Row>('SELECT value FROM platform_settings WHERE key = ?', key);
  return r ? JSON.parse(r.value) : SETTING_DEFAULTS[key];
}

export function allSettings() {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(SETTING_DEFAULTS) as SettingKey[]) out[k] = getSetting(k);
  return out;
}

export function setSetting(key: SettingKey, value: unknown, userId: string) {
  q.run(`INSERT INTO platform_settings (key, value, updated_by) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_by = excluded.updated_by, updated_at = datetime('now')`,
    key, JSON.stringify(value), userId);
}

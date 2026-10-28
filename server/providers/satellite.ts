import { config } from '../config.ts';
import { fetchJson, NotConfiguredError } from './fetcher.ts';

/**
 * Sentinel Hub (Copernicus Sentinel-2 L2A) NDVI statistics for a plot boundary.
 * Requires OAuth client credentials from https://www.sentinel-hub.com/ (or the
 * Copernicus Data Space Ecosystem equivalent). NDVI is an indicator only and
 * requires ground verification.
 */

export const satelliteConfigured = () => !!(config.sentinelHub.clientId && config.sentinelHub.clientSecret);

let token: { value: string; exp: number } | null = null;

async function getToken() {
  if (!satelliteConfigured()) {
    throw new NotConfiguredError('Sentinel Hub', 'Create OAuth credentials at sentinel-hub.com and set SENTINELHUB_CLIENT_ID / SENTINELHUB_CLIENT_SECRET.');
  }
  if (token && token.exp > Date.now() + 60_000) return token.value;
  const body = new URLSearchParams({
    grant_type: 'client_credentials', client_id: config.sentinelHub.clientId, client_secret: config.sentinelHub.clientSecret,
  });
  const res = await fetchJson<{ access_token: string; expires_in: number }>('sentinelhub', 'token',
    'https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token',
    { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' }, retries: 1 });
  token = { value: res.access_token, exp: Date.now() + res.expires_in * 1000 };
  return token.value;
}

const EVALSCRIPT = `//VERSION=3
function setup(){return{input:[{bands:["B04","B08","SCL","dataMask"]}],output:[{id:"ndvi",bands:1},{id:"dataMask",bands:1}]}}
function evaluatePixel(s){var cloud=[3,8,9,10].indexOf(s.SCL)>=0;var ndvi=(s.B08-s.B04)/(s.B08+s.B04);return{ndvi:[ndvi],dataMask:[s.dataMask&&!cloud?1:0]}}`;

export interface NdviPoint { from: string; to: string; mean: number | null; min: number | null; max: number | null; validPct: number }

export async function ndviSeries(geometry: unknown, fromIso: string, toIso: string): Promise<NdviPoint[]> {
  const t = await getToken();
  const body = {
    input: {
      bounds: { geometry, properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' } },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { maxCloudCoverage: 60 } }],
    },
    aggregation: {
      timeRange: { from: fromIso, to: toIso },
      aggregationInterval: { of: 'P5D' },
      evalscript: EVALSCRIPT,
      resx: 10, resy: 10,
    },
  };
  const res = await fetchJson<any>('sentinelhub', 'statistics', 'https://services.sentinel-hub.com/api/v1/statistics', {
    method: 'POST', body: JSON.stringify(body), headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' }, timeoutMs: 30_000,
  });
  return (res.data || []).map((d: any) => {
    const st = d.outputs?.ndvi?.bands?.B0?.stats;
    const total = st?.sampleCount || 0;
    const valid = total - (st?.noDataCount || 0);
    return {
      from: d.interval.from, to: d.interval.to,
      mean: valid > 0 ? st.mean : null, min: valid > 0 ? st.min : null, max: valid > 0 ? st.max : null,
      validPct: total ? Math.round((valid / total) * 100) : 0,
    };
  });
}

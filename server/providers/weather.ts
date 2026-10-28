import { z } from 'zod';
import { config } from '../config.ts';
import { q } from '../db/index.ts';
import { fetchJson } from './fetcher.ts';

/**
 * Open-Meteo adapter (https://open-meteo.com). Free for non-commercial use
 * without a key; commercial deployments must use a paid key (OPEN_METEO_API_KEY).
 * Data are model forecasts, not official IMD warnings.
 */

const ForecastSchema = z.object({
  latitude: z.number(),
  longitude: z.number(),
  timezone: z.string(),
  current: z.object({
    time: z.string(),
    temperature_2m: z.number().nullable(),
    apparent_temperature: z.number().nullable(),
    relative_humidity_2m: z.number().nullable(),
    precipitation: z.number().nullable(),
    weather_code: z.number().nullable(),
    cloud_cover: z.number().nullable(),
    wind_speed_10m: z.number().nullable(),
    wind_direction_10m: z.number().nullable(),
  }),
  hourly: z.object({
    time: z.array(z.string()),
    temperature_2m: z.array(z.number().nullable()),
    relative_humidity_2m: z.array(z.number().nullable()),
    precipitation_probability: z.array(z.number().nullable()),
    precipitation: z.array(z.number().nullable()),
    wind_speed_10m: z.array(z.number().nullable()),
  }),
  daily: z.object({
    time: z.array(z.string()),
    weather_code: z.array(z.number().nullable()),
    temperature_2m_max: z.array(z.number().nullable()),
    temperature_2m_min: z.array(z.number().nullable()),
    precipitation_sum: z.array(z.number().nullable()),
    precipitation_probability_max: z.array(z.number().nullable()),
    wind_speed_10m_max: z.array(z.number().nullable()),
    wind_gusts_10m_max: z.array(z.number().nullable()).optional(),
    uv_index_max: z.array(z.number().nullable()).optional(),
    sunrise: z.array(z.string()),
    sunset: z.array(z.string()),
    et0_fao_evapotranspiration: z.array(z.number().nullable()).optional(),
  }),
});

export type Forecast = z.infer<typeof ForecastSchema>;
export interface WeatherResult {
  forecast: Forecast;
  provider: string;
  fetchedAt: string;
  cached: boolean;
  stale: boolean;
}

const BASE = () => (config.weather.apiKey ? 'https://customer-api.open-meteo.com/v1' : 'https://api.open-meteo.com/v1');

export async function getForecast(lat: number, lon: number): Promise<WeatherResult> {
  // Round to ~1km so nearby farms share cache entries.
  const la = Math.round(lat * 100) / 100;
  const lo = Math.round(lon * 100) / 100;
  const key = `om:${la}:${lo}`;
  const cached = q.get<{ payload: string; fetched_at: string }>('SELECT payload, fetched_at FROM weather_cache WHERE cache_key = ?', key);
  const ageMin = cached ? (Date.now() - new Date(cached.fetched_at).getTime()) / 60000 : Infinity;
  if (cached && ageMin < config.weather.cacheMinutes) {
    return { forecast: JSON.parse(cached.payload), provider: 'Open-Meteo', fetchedAt: cached.fetched_at, cached: true, stale: false };
  }

  const params = new URLSearchParams({
    latitude: String(la),
    longitude: String(lo),
    timezone: 'auto',
    forecast_days: '9',
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset,et0_fao_evapotranspiration',
  });
  if (config.weather.apiKey) params.set('apikey', config.weather.apiKey);

  try {
    const raw = await fetchJson('open-meteo', 'forecast', `${BASE()}/forecast?${params}`);
    const forecast = ForecastSchema.parse(raw);
    const fetchedAt = new Date().toISOString();
    q.run('INSERT OR REPLACE INTO weather_cache (cache_key, provider, payload, fetched_at) VALUES (?, ?, ?, ?)',
      key, 'open-meteo', JSON.stringify(forecast), fetchedAt);
    return { forecast, provider: 'Open-Meteo', fetchedAt, cached: false, stale: false };
  } catch (e) {
    // Serve stale data (clearly flagged) if we have any, rather than failing outright.
    if (cached && ageMin < 24 * 60) {
      return { forecast: JSON.parse(cached.payload), provider: 'Open-Meteo', fetchedAt: cached.fetched_at, cached: true, stale: true };
    }
    throw e;
  }
}

export interface Place { name: string; admin1?: string; admin2?: string; country?: string; latitude: number; longitude: number }

export async function geocode(name: string): Promise<Place[]> {
  const params = new URLSearchParams({ name, count: '8', language: 'en', format: 'json', countryCode: 'IN' });
  const raw = await fetchJson<{ results?: any[] }>('open-meteo', 'geocode', `https://geocoding-api.open-meteo.com/v1/search?${params}`);
  return (raw.results || []).map((r) => ({
    name: r.name, admin1: r.admin1, admin2: r.admin2, country: r.country, latitude: r.latitude, longitude: r.longitude,
  }));
}

// WMO weather interpretation codes
export const WEATHER_CODES: Record<number, string> = {
  0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Rime fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Dense drizzle', 61: 'Light rain', 63: 'Moderate rain', 65: 'Heavy rain',
  66: 'Freezing rain', 67: 'Heavy freezing rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers',
  81: 'Heavy rain showers', 82: 'Violent rain showers', 95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Severe thunderstorm with hail',
};

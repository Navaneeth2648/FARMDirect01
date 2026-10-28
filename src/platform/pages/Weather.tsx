import { useState } from 'react';
import { Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSun, Droplets, Sun, Sunrise, Sunset, Thermometer, Wind } from 'lucide-react';
import { api, qs } from '../api';
import { Badge, Bars, Empty, ErrorBox, LineChart, PageHeader, Section, Skeleton, SourceNote, SpeakButton, severityTone, useAsync } from '../ui';
import { FarmSelect, LocationPicker, useFarms } from '../shared';

export function weatherIcon(code: number | null, cls = 'h-6 w-6') {
  if (code == null) return <Cloud className={cls} aria-hidden />;
  if (code === 0 || code === 1) return <Sun className={cls} aria-hidden />;
  if (code === 2) return <CloudSun className={cls} aria-hidden />;
  if (code === 3) return <Cloud className={cls} aria-hidden />;
  if (code === 45 || code === 48) return <CloudFog className={cls} aria-hidden />;
  if (code >= 51 && code <= 57) return <CloudDrizzle className={cls} aria-hidden />;
  if (code >= 95) return <CloudLightning className={cls} aria-hidden />;
  return <CloudRain className={cls} aria-hidden />;
}

const compass = (deg: number | null) => (deg == null ? '' : ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]);
const hhmm = (s: string) => s.slice(11, 16);

export function WeatherPage() {
  const farms = useFarms();
  const [farmId, setFarmId] = useState('');
  const [place, setPlace] = useState<{ lat: number; lon: number; label: string } | null>(null);
  const w = useAsync(() => api.get(`/v1/weather${qs(place ? { lat: place.lat, lon: place.lon, label: place.label } : { farm_id: farmId })}`), [farmId, place]);

  const f = w.data?.forecast;
  const codes = w.data?.codes || {};
  return (
    <div className="space-y-4">
      <PageHeader title="Weather" icon={<CloudSun />} subtitle="Forecast and crop-aware recommendations for your farm" />
      <Section>
        <div className="grid gap-3 md:grid-cols-2">
          {farms.data && farms.data.length > 0 && (
            <div>
              <p className="mb-1 text-sm font-medium">Saved farm</p>
              <FarmSelect farms={farms.data.filter((x) => x.latitude != null)} value={farmId} onChange={(v) => { setFarmId(v); setPlace(null); }} />
            </div>
          )}
          <LocationPicker label="Or search any location" onPick={(p) => setPlace({ lat: p.latitude, lon: p.longitude, label: p.name })} />
        </div>
      </Section>

      {w.loading ? <Skeleton lines={8} /> : w.error ? (
        w.error.code === 'no_location' ? <Empty title="No location yet">{w.error.message}</Empty> : <ErrorBox error={w.error} onRetry={w.reload} />
      ) : f && (
        <>
          <Section>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-3">
                <div className="text-amber-500">{weatherIcon(f.current.weather_code, 'h-16 w-16')}</div>
                <div>
                  <p className="text-4xl font-bold">{Math.round(f.current.temperature_2m)}°C</p>
                  <p className="text-sm text-gray-600">{codes[f.current.weather_code] || ''} · Feels like {Math.round(f.current.apparent_temperature)}°C</p>
                  <p className="text-sm font-medium">{w.data.location.label}</p>
                </div>
              </div>
              <dl className="grid flex-1 grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                <div><dt className="flex items-center gap-1 text-gray-500"><Droplets className="h-4 w-4" />Humidity</dt><dd className="font-semibold">{f.current.relative_humidity_2m}%</dd></div>
                <div><dt className="flex items-center gap-1 text-gray-500"><Wind className="h-4 w-4" />Wind</dt><dd className="font-semibold">{Math.round(f.current.wind_speed_10m)} km/h {compass(f.current.wind_direction_10m)}</dd></div>
                <div><dt className="flex items-center gap-1 text-gray-500"><Cloud className="h-4 w-4" />Cloud cover</dt><dd className="font-semibold">{f.current.cloud_cover}%</dd></div>
                <div><dt className="flex items-center gap-1 text-gray-500"><Sun className="h-4 w-4" />UV max today</dt><dd className="font-semibold">{f.daily.uv_index_max?.[0] ?? '–'}</dd></div>
                <div><dt className="flex items-center gap-1 text-gray-500"><Sunrise className="h-4 w-4" />Sunrise</dt><dd className="font-semibold">{hhmm(f.daily.sunrise[0])}</dd></div>
                <div><dt className="flex items-center gap-1 text-gray-500"><Sunset className="h-4 w-4" />Sunset</dt><dd className="font-semibold">{hhmm(f.daily.sunset[0])}</dd></div>
                <div><dt className="flex items-center gap-1 text-gray-500"><Thermometer className="h-4 w-4" />Today</dt><dd className="font-semibold">{Math.round(f.daily.temperature_2m_min[0])}–{Math.round(f.daily.temperature_2m_max[0])}°C</dd></div>
                <div><dt className="flex items-center gap-1 text-gray-500"><CloudRain className="h-4 w-4" />Rain today</dt><dd className="font-semibold">{f.daily.precipitation_sum[0]} mm</dd></div>
              </dl>
            </div>
            <SourceNote source={`${w.data.provider} (${w.data.providerNote})`} updated={w.data.fetchedAt} stale={w.data.stale} />
          </Section>

          <Section title="Recommendations for your crops" description={w.data.cyclesConsidered.length ? `Considering: ${w.data.cyclesConsidered.map((c: any) => `${c.crop_name} (${c.stage_name || 'not started'})`).join(', ')}` : 'Add active crops to this farm to get crop-specific recommendations.'}>
            {w.data.recommendations.length === 0 ? <p className="text-sm text-gray-600">No weather-related action needed for your crops right now.</p> : (
              <ul className="space-y-3">
                {w.data.recommendations.map((r: any) => (
                  <li key={r.id} className="rounded-xl border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2"><Badge tone={severityTone(r.severity)}>{r.severity}</Badge><span className="font-semibold">{r.title}</span><SpeakButton text={`${r.title}. ${r.detail}`} /></div>
                    <p className="mt-1 text-sm text-gray-700">{r.detail}</p>
                    <p className="mt-1 text-xs text-gray-500">Why: {r.basis} {r.crops.length > 0 && `Crops: ${r.crops.join(', ')}.`}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Next 9 days">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-9">
              {f.daily.time.map((d: string, i: number) => (
                <div key={d} className="rounded-xl bg-gray-50 p-2 text-center text-sm">
                  <p className="font-semibold">{i === 0 ? 'Today' : new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })}</p>
                  <div className="my-1 flex justify-center text-amber-500" title={codes[f.daily.weather_code[i]]}>{weatherIcon(f.daily.weather_code[i])}</div>
                  <p>{Math.round(f.daily.temperature_2m_max[i])}° / {Math.round(f.daily.temperature_2m_min[i])}°</p>
                  <p className="text-xs text-sky-700">{f.daily.precipitation_probability_max[i] ?? '–'}% · {f.daily.precipitation_sum[i]} mm</p>
                  <p className="text-xs text-gray-500">{Math.round(f.daily.wind_speed_10m_max[i])} km/h</p>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Temperature (°C)">
              <LineChart unit="°" series={[
                { name: 'Max', color: '#dc2626', points: f.daily.time.map((d: string, i: number) => ({ x: d.slice(5), y: f.daily.temperature_2m_max[i] })) },
                { name: 'Min', color: '#2563eb', points: f.daily.time.map((d: string, i: number) => ({ x: d.slice(5), y: f.daily.temperature_2m_min[i] })) },
              ]} />
            </Section>
            <Section title="Expected rainfall (mm)">
              <Bars data={f.daily.time.map((d: string, i: number) => ({ label: d.slice(8), value: f.daily.precipitation_sum[i] }))} />
            </Section>
          </div>

          <Section title="Next 24 hours">
            <div className="overflow-x-auto">
              <table className="min-w-full text-center text-xs">
                <thead><tr className="text-gray-500"><th className="p-1 text-left">Hour</th>{f.hourly.time.slice(0, 24).filter((_: any, i: number) => i % 2 === 0).map((t: string) => <th key={t} className="p-1">{hhmm(t)}</th>)}</tr></thead>
                <tbody>
                  {[['°C', 'temperature_2m'], ['Rain %', 'precipitation_probability'], ['mm', 'precipitation'], ['km/h', 'wind_speed_10m'], ['RH %', 'relative_humidity_2m']].map(([label, key]) => (
                    <tr key={key} className="border-t"><th className="p-1 text-left font-medium text-gray-600">{label}</th>
                      {f.hourly[key].slice(0, 24).filter((_: any, i: number) => i % 2 === 0).map((v: number, i: number) => <td key={i} className="p-1">{v == null ? '–' : Math.round(v * 10) / 10}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}

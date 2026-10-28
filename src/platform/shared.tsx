import { useEffect, useState } from 'react';
import { Crosshair, MapPin, Search } from 'lucide-react';
import { api, qs } from './api';
import { Button, Input, Select, Spinner, useAsync } from './ui';
import { useAuth } from './auth';

export interface Crop { id: string; name: string; local_names: Record<string, string>; category: string; regions: string[]; agmarknet_name?: string; regional_fit?: boolean | null }
export interface Farm { id: string; name: string; state?: string; district?: string; village?: string; latitude?: number | null; longitude?: number | null; total_area?: number; area_unit: string; plots: any[]; updated_at: string; [k: string]: any }

let cropCache: Crop[] | null = null;
const CROP_EMOJI: Record<string, string> = {
  paddy: '🌾', wheat: '🌾', maize: '🌽', cotton: '🌿', chilli: '🌶️', tomato: '🍅', chickpea: '🫘', groundnut: '🥜',
  soybean: '🫛', sugarcane: '🎋', turmeric: '🫚', redgram: '🫘', onion: '🧅', banana: '🍌',
};
/** Simple picture for a crop (emoji, so it works offline and in every theme). */
export const cropEmoji = (id?: string | null) => (id && CROP_EMOJI[id]) || '🌱';

/** Round crop chips in a horizontal scroller, like a crop picker on a phone. */
export function CropChips({ items, value, onChange, label }: { items: { id: string; value: string; name: string }[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <div role="listbox" aria-label={label} className="-mx-3 flex gap-3 overflow-x-auto px-3 pb-1 sm:mx-0 sm:px-0">
      {items.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value} type="button" role="option" aria-selected={on} onClick={() => onChange(on ? '' : c.value)}
            className={`flex w-[72px] shrink-0 flex-col items-center gap-1 border-b-2 pb-1.5 text-xs font-medium ${on ? 'border-emerald-600 text-gray-900' : 'border-transparent text-gray-600'}`}>
            <span className={`flex h-14 w-14 items-center justify-center rounded-full text-2xl ${on ? 'bg-emerald-50 ring-2 ring-emerald-600' : 'bg-gray-100'}`} aria-hidden>{cropEmoji(c.id)}</span>
            <span className="w-full truncate text-center">{c.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export function useCrops() {
  const [crops, setCrops] = useState<Crop[]>(cropCache || []);
  useEffect(() => {
    if (cropCache) return;
    api.get('/v1/crops').then((r) => { cropCache = r.crops; setCrops(r.crops); }).catch(() => {});
  }, []);
  return crops;
}

export function useCropName() {
  const crops = useCrops();
  const { lang } = useAuth();
  return (id?: string | null, fallback?: string) => {
    const c = crops.find((x) => x.id === id);
    if (!c) return fallback || id || '';
    return lang !== 'en' && c.local_names?.[lang] ? `${c.local_names[lang]} (${c.name})` : c.name;
  };
}

export function useFarms() {
  return useAsync(() => api.get<{ farms: Farm[] }>('/v1/farms').then((r) => r.farms));
}

export function CropSelect({ value, onChange, state, id, required }: { value: string; onChange: (v: string) => void; state?: string | null; id?: string; required?: boolean }) {
  const crops = useCrops();
  const name = useCropName();
  const sorted = [...crops].sort((a, b) => {
    const fa = state && a.regions.includes(state) ? 0 : 1;
    const fb = state && b.regions.includes(state) ? 0 : 1;
    return fa - fb || a.name.localeCompare(b.name);
  });
  return (
    <Select id={id} required={required} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Select crop"
      options={sorted.map((c) => ({ value: c.id, label: `${name(c.id)}${state && c.regions.length && !c.regions.includes(state) ? ' – not configured for your state' : ''}` }))} />
  );
}

export function FarmSelect({ farms, value, onChange, id, allowAll }: { farms: Farm[]; value: string; onChange: (v: string) => void; id?: string; allowAll?: boolean }) {
  return <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={allowAll ? 'All farms' : 'Select farm'} options={farms.map((f) => ({ value: f.id, label: f.name }))} />;
}

/** Village search (Open-Meteo geocoding) or GPS with explicit consent. */
export function LocationPicker({ onPick, label = 'Find your village or town' }: { onPick: (p: { latitude: number; longitude: number; name: string; state?: string; district?: string; gps?: boolean }) => void; label?: string }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const search = async () => {
    if (q.trim().length < 2) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.get(`/v1/weather/geocode${qs({ name: q })}`);
      setResults(r.places);
      if (!r.places.length) setErr('No places found. Try a nearby town or district name.');
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const gps = () => {
    if (!navigator.geolocation) { setErr('Location is not available on this device. Please search instead.'); return; }
    if (!confirm('Allow FARMDirect to use your current GPS location for this farm? It is used only for weather and advisory, and you can remove it later.')) return;
    setBusy(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); onPick({ latitude: +p.coords.latitude.toFixed(5), longitude: +p.coords.longitude.toFixed(5), name: 'Current location', gps: true }); },
      () => { setBusy(false); setErr('Location permission was denied. You can search for your village instead.'); },
      { enableHighAccuracy: false, timeout: 15000 },
    );
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-800">{label}</p>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), search())} placeholder="e.g. Warangal" aria-label={label} />
        <Button type="button" variant="outline" onClick={search} disabled={busy} aria-label="Search location">{busy ? <Spinner /> : <Search className="h-4 w-4" />}</Button>
        <Button type="button" variant="outline" onClick={gps} disabled={busy} title="Use my GPS location" aria-label="Use my GPS location"><Crosshair className="h-4 w-4" /></Button>
      </div>
      {err && <p className="text-xs text-red-700">{err}</p>}
      {results.length > 0 && (
        <ul className="max-h-48 divide-y overflow-y-auto rounded-lg border">
          {results.map((p, i) => (
            <li key={i}>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-emerald-50"
                onClick={() => { onPick({ latitude: p.latitude, longitude: p.longitude, name: p.name, state: p.admin1, district: p.admin2 }); setResults([]); setQ(p.name); }}>
                <MapPin className="h-4 w-4 text-gray-400" aria-hidden />{[p.name, p.admin2, p.admin1].filter(Boolean).join(', ')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'gray' | 'blue'> = {
  completed: 'green', processing: 'blue', needs_better_image: 'amber', failed: 'red', not_configured: 'gray',
  open: 'amber', assigned: 'blue', answered: 'green', closed: 'gray', escalated: 'red',
};

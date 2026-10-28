import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Satellite } from 'lucide-react';
import { api, fmtDate } from '../api';
import { Button, Empty, ErrorBox, LineChart, Notice, PageHeader, Section, Select, SetupNotice, Skeleton, Spinner, useAsync, useToast } from '../ui';
import { useFarms } from '../shared';

/** Click on the map to add boundary points; the polygon is saved as GeoJSON on the plot. */
function BoundaryEditor({ center, initial, onSave }: { center: [number, number]; initial?: [number, number][]; onSave: (pts: [number, number][]) => Promise<void> }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [pts, setPts] = useState<[number, number][]>(initial || []); // [lat, lon]
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current).setView(center, 16);
    // OpenStreetMap tiles (light use; see OSM tile usage policy). Swap for a licensed imagery provider in production.
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    m.on('click', (e: L.LeafletMouseEvent) => setPts((p) => [...p, [+e.latlng.lat.toFixed(6), +e.latlng.lng.toFixed(6)]]));
    map.current = m;
    return () => { m.remove(); map.current = null; };
  }, [center]);

  useEffect(() => {
    const g = layer.current;
    if (!g) return;
    g.clearLayers();
    pts.forEach((p) => L.circleMarker(p, { radius: 5, color: '#047857' }).addTo(g));
    if (pts.length >= 3) L.polygon(pts, { color: '#047857', fillOpacity: 0.2 }).addTo(g);
    else if (pts.length === 2) L.polyline(pts, { color: '#047857' }).addTo(g);
  }, [pts]);

  return (
    <div>
      <div ref={el} className="h-80 w-full rounded-xl border" role="application" aria-label="Map – click to add boundary points" />
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-600">{pts.length} points{pts.length < 3 && ' (need at least 3)'}</span>
        <Button size="sm" variant="outline" onClick={() => setPts((p) => p.slice(0, -1))} disabled={!pts.length}>Undo</Button>
        <Button size="sm" variant="outline" onClick={() => setPts([])} disabled={!pts.length}>Clear</Button>
        <Button size="sm" disabled={pts.length < 3 || busy} onClick={async () => { setBusy(true); try { await onSave(pts); } finally { setBusy(false); } }}>{busy ? <Spinner /> : 'Save boundary'}</Button>
      </div>
    </div>
  );
}

export function SatellitePage() {
  const toast = useToast();
  const farms = useFarms();
  const status = useAsync(() => api.get('/v1/satellite/status'));
  const [plotKey, setPlotKey] = useState('');
  const [ndvi, setNdvi] = useState<any>(null);
  const [ndviErr, setNdviErr] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  if (farms.loading) return <Skeleton />;
  const plots = (farms.data || []).flatMap((f) => f.plots.map((p: any) => ({ ...p, farm: f })));
  const plot = plots.find((p) => p.id === plotKey);
  const initial: [number, number][] | undefined = plot?.boundary_geojson
    ? JSON.parse(plot.boundary_geojson).coordinates[0].slice(0, -1).map(([lon, lat]: number[]) => [lat, lon]) : undefined;
  const center: [number, number] | null = initial?.[0] || (plot?.farm.latitude != null ? [plot.farm.latitude, plot.farm.longitude] : null);

  const loadNdvi = async () => {
    setLoading(true); setNdviErr(null); setNdvi(null);
    try { setNdvi(await api.get(`/v1/satellite/plots/${plotKey}/ndvi?days=120`)); } catch (e) { setNdviErr(e); } finally { setLoading(false); }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Satellite & Remote Sensing" icon={<Satellite />} subtitle="Map plot boundaries and track vegetation vigour (NDVI) from Sentinel-2 imagery" />
      {status.data && <Notice>{status.data.note}</Notice>}
      {status.data && !status.data.configured && <SetupNotice service="Satellite imagery (Sentinel Hub)" setup={status.data.setup} />}

      {plots.length === 0 ? <Empty title="No plots yet">Create a plot on My Farm first, then draw its boundary here.</Empty> : (
        <>
          <Section>
            <Select aria-label="Plot" value={plotKey} onChange={(e) => { setPlotKey(e.target.value); setNdvi(null); setNdviErr(null); }} placeholder="Choose a plot"
              options={plots.map((p) => ({ value: p.id, label: `${p.farm.name} – ${p.name}${p.boundary_geojson ? ' ✓' : ''}` }))} />
          </Section>
          {plot && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Section title="Plot boundary" description="Click the corners of your plot on the map, then save.">
                {center ? (
                  <BoundaryEditor key={plot.id} center={center} initial={initial} onSave={async (pts) => {
                    const ring = [...pts.map(([lat, lon]) => [lon, lat]), [pts[0][1], pts[0][0]]];
                    await api.patch(`/v1/farms/${plot.farm_id}/plots/${plot.id}`, { boundary_geojson: { type: 'Polygon', coordinates: [ring] }, updated_at: plot.updated_at });
                    toast('Boundary saved'); farms.reload();
                  }} />
                ) : <Empty title="Farm has no location">Add a location to the farm so the map can open in the right place.</Empty>}
              </Section>
              <Section title="Vegetation index (NDVI)" description="Higher values mean denser, greener vegetation. Compare over time rather than reading a single value.">
                {!plot.boundary_geojson ? <p className="text-sm text-gray-500">Save a boundary first.</p> : (
                  <>
                    <Button onClick={loadNdvi} disabled={loading || !status.data?.configured}>{loading ? <Spinner /> : 'Load last 120 days'}</Button>
                    {ndviErr && <div className="mt-3"><ErrorBox error={ndviErr} /></div>}
                    {ndvi && (
                      <div className="mt-3">
                        <LineChart series={[{ name: 'Mean NDVI', color: '#16a34a', points: ndvi.series.map((s: any) => ({ x: s.from.slice(5, 10), y: s.mean == null ? null : s.mean * 100 })) }]} unit="" yLabel="NDVI x100" />
                        <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-gray-600">
                          {ndvi.series.map((s: any) => <li key={s.from}>{fmtDate(s.from)}: {s.mean == null ? 'no cloud-free image' : `mean ${s.mean.toFixed(2)} (min ${s.min.toFixed(2)}, max ${s.max.toFixed(2)})`} · {s.validPct}% clear</li>)}
                        </ul>
                        <p className="mt-2 text-xs text-gray-500">{ndvi.provider}. {ndvi.cloudNote} A drop in NDVI can mean stress, harvest, or cloud effects; check in the field and ask an expert if needed.</p>
                      </div>
                    )}
                  </>
                )}
              </Section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

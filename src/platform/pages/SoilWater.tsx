import { useState, type FormEvent } from 'react';
import { Droplets, FlaskConical, Plus } from 'lucide-react';
import { api, fmtDate, today } from '../api';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, Notice, PageHeader, Section, Select, Skeleton, Tabs, Textarea, fieldErrors, useAsync, useToast } from '../ui';
import { FarmSelect, useFarms } from '../shared';

const SOIL_FIELDS: [key: string, label: string, unit: string][] = [
  ['ph', 'pH', ''], ['ec', 'EC', 'dS/m'], ['organic_carbon', 'Organic carbon', '%'], ['nitrogen', 'Nitrogen (N)', 'kg/ha'],
  ['phosphorus', 'Phosphorus (P)', 'kg/ha'], ['potassium', 'Potassium (K)', 'kg/ha'], ['sulphur', 'Sulphur (S)', 'ppm'],
  ['zinc', 'Zinc (Zn)', 'ppm'], ['iron', 'Iron (Fe)', 'ppm'], ['boron', 'Boron (B)', 'ppm'],
];

const ratingTone = (r: string) => (/low|deficient|acidic|saline|alkaline/.test(r) ? 'amber' : /high/.test(r) ? 'blue' : 'green');

function SoilInterpretation({ testId }: { testId: string }) {
  const r = useAsync(() => api.get(`/v1/advisory/soil/${testId}`), [testId]);
  if (r.loading) return <Skeleton lines={2} />;
  if (r.error) return <ErrorBox error={r.error} />;
  return (
    <div className="mt-2">
      <ul className="grid gap-1 sm:grid-cols-2">
        {r.data.items.map((i: any) => (
          <li key={i.parameter} className="text-sm">
            <span className="font-medium">{i.parameter}</span>: {i.value} {i.unit} <Badge tone={ratingTone(i.rating) as any}>{i.rating}</Badge>
            {i.note && <p className="text-xs text-gray-600">{i.note}</p>}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-gray-500">{r.data.basis} {r.data.disclaimer}</p>
    </div>
  );
}

export function SoilWaterPage() {
  const toast = useToast();
  const farms = useFarms();
  const [tab, setTab] = useState<'soil' | 'water'>('soil');
  const [farmId, setFarmId] = useState('');
  const soil = useAsync(() => api.get(`/v1/records/soil-tests${farmId ? `?farm_id=${farmId}` : ''}`).then((r) => r.items), [farmId]);
  const water = useAsync(() => api.get(`/v1/records/irrigation${farmId ? `?farm_id=${farmId}` : ''}`).then((r) => r.items), [farmId]);
  const [form, setForm] = useState<any>(null);
  const [err, setErr] = useState<any>(null);
  const fe = fieldErrors(err);

  const save = async (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    const { type, ...d } = form;
    const body: any = { ...d, plot_id: d.plot_id || null };
    for (const [k] of SOIL_FIELDS) if (k in body) body[k] = body[k] === '' ? null : Number(body[k]);
    for (const k of ['duration_hours', 'water_mm']) if (k in body) body[k] = body[k] === '' ? null : Number(body[k]);
    if (body.texture === '') body.texture = null;
    try {
      await api.post(`/v1/records/${type}`, body);
      toast('Saved'); setForm(null);
      type === 'soil-tests' ? soil.reload() : water.reload();
    } catch (e) { setErr(e); }
  };

  if (farms.loading) return <Skeleton />;
  if (!farms.data?.length) return <><PageHeader title="Soil & Water" icon={<Droplets />} /><Empty title="Add a farm first" /></>;
  const plotsFor = (fid: string) => (farms.data!.find((f) => f.id === fid)?.plots || []).map((p: any) => ({ value: p.id, label: p.name }));
  const totalWater = (water.data || []).reduce((s: number, r: any) => s + (r.water_mm || 0), 0);

  return (
    <div>
      <PageHeader title="Soil & Water" icon={<Droplets />} subtitle="Record soil tests and irrigation. Ratings are educational; fertiliser doses come from your Soil Health Card or agronomist."
        actions={<Button onClick={() => { setErr(null); setForm(tab === 'soil' ? { type: 'soil-tests', farm_id: farmId || farms.data![0].id, sample_date: today() } : { type: 'irrigation', farm_id: farmId || farms.data![0].id, date: today(), waterlogging_observed: false }); }}><Plus className="mr-1 h-4 w-4" />{tab === 'soil' ? 'Soil test' : 'Irrigation'}</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onChange={setTab} tabs={[{ id: 'soil', label: 'Soil tests' }, { id: 'water', label: 'Irrigation log' }]} />
        <div className="w-56"><FarmSelect farms={farms.data} value={farmId} onChange={setFarmId} allowAll /></div>
      </div>

      {tab === 'soil' ? (soil.loading ? <Skeleton /> : soil.error ? <ErrorBox error={soil.error} /> : !soil.data?.length ? (
        <Empty title="No soil tests recorded" icon={<FlaskConical className="h-8 w-8" />}>Get a free test under the Soil Health Card scheme and enter the results here.</Empty>
      ) : (
        <div className="space-y-3">
          {soil.data.length > 1 && (
            <Section title="Comparison">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs text-gray-500"><tr><th className="p-2">Date</th>{SOIL_FIELDS.slice(0, 6).map(([k, l]) => <th key={k} className="p-2">{l}</th>)}</tr></thead>
                  <tbody>{soil.data.map((t: any) => <tr key={t.id} className="border-t"><td className="p-2">{fmtDate(t.sample_date)}</td>{SOIL_FIELDS.slice(0, 6).map(([k]) => <td key={k} className="p-2">{t[k] ?? '–'}</td>)}</tr>)}</tbody>
                </table>
              </div>
            </Section>
          )}
          {soil.data.map((t: any) => (
            <Section key={t.id} title={`Soil test – ${fmtDate(t.sample_date)}`} description={[t.lab_name, t.texture].filter(Boolean).join(' · ')}>
              <SoilInterpretation testId={t.id} />
            </Section>
          ))}
        </div>
      )) : (water.loading ? <Skeleton /> : water.error ? <ErrorBox error={water.error} /> : !water.data?.length ? <Empty title="No irrigation logged yet" /> : (
        <Section title="Irrigation log" description={totalWater ? `Total recorded: ${totalWater.toFixed(0)} mm` : undefined}>
          {water.data.some((r: any) => r.waterlogging_observed) && <div className="mb-3"><Notice tone="warn">Waterlogging was recorded. Open field drains and avoid irrigating until the soil drains.</Notice></div>}
          <ul className="divide-y text-sm">
            {water.data.map((r: any) => (
              <li key={r.id} className="py-2">
                <p className="font-medium">{fmtDate(r.date)} · {r.method || 'irrigation'}{r.duration_hours && ` · ${r.duration_hours} h`}{r.water_mm && ` · ${r.water_mm} mm`} {r.waterlogging_observed ? <Badge tone="amber">waterlogging</Badge> : null}</p>
                {r.notes && <p className="text-xs text-gray-600">{r.notes}</p>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">For irrigation timing against the forecast, see the Weather page recommendations.</p>
        </Section>
      ))}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.type === 'soil-tests' ? 'Add soil test' : 'Log irrigation'} wide>
        {form && (
          <form onSubmit={save} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Farm">{(id) => <FarmSelect id={id} farms={farms.data!} value={form.farm_id} onChange={(v) => setForm({ ...form, farm_id: v, plot_id: '' })} />}</Field>
              <Field label="Plot">{(id) => <Select id={id} value={form.plot_id || ''} onChange={(e) => setForm({ ...form, plot_id: e.target.value })} placeholder="Whole farm" options={plotsFor(form.farm_id)} />}</Field>
              {form.type === 'soil-tests' ? (
                <>
                  <Field label="Sample date" required>{(id) => <Input id={id} type="date" value={form.sample_date} onChange={(e) => setForm({ ...form, sample_date: e.target.value })} required />}</Field>
                  <Field label="Laboratory">{(id) => <Input id={id} value={form.lab_name || ''} onChange={(e) => setForm({ ...form, lab_name: e.target.value })} />}</Field>
                  <Field label="Texture">{(id) => <Select id={id} value={form.texture || ''} onChange={(e) => setForm({ ...form, texture: e.target.value })} placeholder="Unknown"
                    options={['sandy', 'loamy', 'clay', 'clay_loam', 'sandy_loam', 'silt', 'black_cotton', 'red', 'laterite', 'alluvial'].map((v) => ({ value: v, label: v.replace('_', ' ') }))} />}</Field>
                  {SOIL_FIELDS.map(([k, l, u]) => (
                    <Field key={k} label={`${l}${u ? ` (${u})` : ''}`} error={fe[k]}>{(id) => <Input id={id} type="number" step="any" min="0" value={form[k] ?? ''} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />}</Field>
                  ))}
                </>
              ) : (
                <>
                  <Field label="Date" required>{(id) => <Input id={id} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />}</Field>
                  <Field label="Method">{(id) => <Select id={id} value={form.method || ''} onChange={(e) => setForm({ ...form, method: e.target.value })} placeholder="Select" options={['flood', 'furrow', 'drip', 'sprinkler', 'canal', 'other'].map((v) => ({ value: v, label: v }))} />}</Field>
                  <Field label="Duration (hours)">{(id) => <Input id={id} type="number" min="0" step="0.1" value={form.duration_hours ?? ''} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })} />}</Field>
                  <Field label="Water applied (mm), if known">{(id) => <Input id={id} type="number" min="0" step="0.1" value={form.water_mm ?? ''} onChange={(e) => setForm({ ...form, water_mm: e.target.value })} />}</Field>
                  <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={form.waterlogging_observed} onChange={(e) => setForm({ ...form, waterlogging_observed: e.target.checked })} />Waterlogging seen</label>
                </>
              )}
            </div>
            <Field label="Notes">{(id) => <Textarea id={id} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
            {err && <ErrorBox error={err} />}
            <div className="flex justify-end"><Button type="submit">Save</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

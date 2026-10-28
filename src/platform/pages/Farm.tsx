import { useEffect, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MapPin, Pencil, Plus, Sprout, Trash2, Tractor } from 'lucide-react';
import { api, ApiError, fmtDate, today } from '../api';
import { useAuth } from '../auth';
import {
  Badge, Button, Empty, ErrorBox, Field, Input, INDIAN_STATES, Modal, Notice, PageHeader, Section, Select, Skeleton, Spinner, Textarea,
  fieldErrors, useAsync, useConfirm, useToast,
} from '../ui';
import { CropSelect, FarmSelect, LocationPicker, useCropName, useFarms, type Farm } from '../shared';

const UNITS = ['acre', 'hectare', 'guntha', 'cent', 'bigha'].map((u) => ({ value: u, label: u }));

function FarmForm({ farm, onSaved, onCancel }: { farm?: Farm; onSaved: () => void; onCancel: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState<any>(farm ? { ...farm } : { name: '', state: user?.state || '', district: user?.district || '', area_unit: 'acre' });
  const [err, setErr] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const fe = fieldErrors(err);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    const body = {
      name: f.name, state: f.state || null, district: f.district || null, subdistrict: f.subdistrict || null, village: f.village || null,
      pincode: f.pincode || null, total_area: f.total_area ? Number(f.total_area) : null, area_unit: f.area_unit,
      ownership: f.ownership || null, irrigation_method: f.irrigation_method || null, water_source: f.water_source || null, soil_type: f.soil_type || null,
      latitude: f.latitude ?? null, longitude: f.longitude ?? null,
    };
    try {
      if (farm) await api.patch(`/v1/farms/${farm.id}`, { ...body, updated_at: farm.updated_at });
      else await api.post('/v1/farms', body);
      toast('Farm saved');
      onSaved();
    } catch (e) {
      setErr(e);
      if (e instanceof ApiError && e.code === 'conflict') toast('This farm was changed elsewhere. Reload and try again.', 'error');
    } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      <Field label="Farm name" required error={fe.name}>{(id) => <Input id={id} value={f.name} onChange={set('name')} required />}</Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="State">{(id) => <Select id={id} value={f.state || ''} onChange={set('state')} options={INDIAN_STATES} placeholder="Select" />}</Field>
        <Field label="District">{(id) => <Input id={id} value={f.district || ''} onChange={set('district')} />}</Field>
        <Field label="Mandal / Taluka">{(id) => <Input id={id} value={f.subdistrict || ''} onChange={set('subdistrict')} />}</Field>
        <Field label="Village">{(id) => <Input id={id} value={f.village || ''} onChange={set('village')} />}</Field>
        <Field label="PIN code" error={fe.pincode}>{(id) => <Input id={id} inputMode="numeric" maxLength={6} value={f.pincode || ''} onChange={set('pincode')} />}</Field>
        <Field label="Total area">{(id) => <div className="flex gap-1"><Input id={id} type="number" min="0" step="0.01" value={f.total_area ?? ''} onChange={set('total_area')} /><Select aria-label="unit" value={f.area_unit} onChange={set('area_unit')} options={UNITS} className="w-28" /></div>}</Field>
        <Field label="Irrigation">{(id) => <Select id={id} value={f.irrigation_method || ''} onChange={set('irrigation_method')} placeholder="Select" options={['rainfed', 'canal', 'borewell', 'drip', 'sprinkler', 'flood', 'tank', 'other'].map((v) => ({ value: v, label: v }))} />}</Field>
        <Field label="Soil type">{(id) => <Input id={id} value={f.soil_type || ''} onChange={set('soil_type')} />}</Field>
      </div>
      <LocationPicker label="Farm location (for weather & satellite)" onPick={(p) => setF({ ...f, latitude: p.latitude, longitude: p.longitude, state: f.state || p.state || '', district: f.district || p.district || '' })} />
      {f.latitude != null && (
        <p className="flex items-center gap-2 text-xs text-gray-600"><MapPin className="h-4 w-4" />{Number(f.latitude).toFixed(4)}, {Number(f.longitude).toFixed(4)}
          <button type="button" className="text-red-700 underline" onClick={() => setF({ ...f, latitude: null, longitude: null })}>Remove location</button></p>
      )}
      {err && <ErrorBox error={err} />}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? <Spinner /> : 'Save'}</Button></div>
    </form>
  );
}

function CycleForm({ farms, cycle, onSaved, onCancel }: { farms: Farm[]; cycle?: any; onSaved: () => void; onCancel: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<any>(cycle ? { ...cycle } : { farm_id: farms[0]?.id || '', crop_id: '', sowing_date: today(), area_unit: 'acre', status: 'active' });
  const [err, setErr] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const farm = farms.find((x) => x.id === f.farm_id);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const body = {
        plot_id: f.plot_id || null, variety: f.variety || null, season: f.season || null, sowing_date: f.sowing_date,
        area: f.area ? Number(f.area) : null, area_unit: f.area_unit, status: f.status, notes: f.notes || null,
        actual_harvest_date: f.actual_harvest_date || null,
      };
      if (cycle) await api.patch(`/v1/cycles/${cycle.id}`, { ...body, updated_at: cycle.updated_at });
      else {
        const r = await api.post('/v1/cycles', { ...body, farm_id: f.farm_id, crop_id: f.crop_id });
        if (r.warning) toast(r.warning, 'info');
      }
      toast(cycle ? 'Crop updated – calendar rescheduled' : 'Crop added – calendar created');
      onSaved();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-3">
      {!cycle && (
        <>
          <Field label="Farm" required>{(id) => <FarmSelect id={id} farms={farms} value={f.farm_id} onChange={(v) => setF({ ...f, farm_id: v, plot_id: '' })} />}</Field>
          <Field label="Crop" required>{(id) => <CropSelect id={id} required value={f.crop_id} onChange={(v) => setF({ ...f, crop_id: v })} state={farm?.state} />}</Field>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Plot">{(id) => <Select id={id} value={f.plot_id || ''} onChange={(e) => setF({ ...f, plot_id: e.target.value })} placeholder="Whole farm" options={(farm?.plots || []).map((p: any) => ({ value: p.id, label: p.name }))} />}</Field>
        <Field label="Variety">{(id) => <Input id={id} value={f.variety || ''} onChange={(e) => setF({ ...f, variety: e.target.value })} />}</Field>
        <Field label="Sowing / transplant date" required>{(id) => <Input id={id} type="date" value={f.sowing_date} onChange={(e) => setF({ ...f, sowing_date: e.target.value })} required />}</Field>
        <Field label="Season">{(id) => <Select id={id} value={f.season || ''} onChange={(e) => setF({ ...f, season: e.target.value })} placeholder="Select" options={['kharif', 'rabi', 'zaid', 'annual'].map((s) => ({ value: s, label: s }))} />}</Field>
        <Field label="Area">{(id) => <Input id={id} type="number" min="0" step="0.01" value={f.area ?? ''} onChange={(e) => setF({ ...f, area: e.target.value })} />}</Field>
        <Field label="Status">{(id) => <Select id={id} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={['planned', 'active', 'harvested', 'abandoned'].map((s) => ({ value: s, label: s }))} />}</Field>
        {f.status === 'harvested' && <Field label="Harvest date">{(id) => <Input id={id} type="date" value={f.actual_harvest_date || ''} onChange={(e) => setF({ ...f, actual_harvest_date: e.target.value })} />}</Field>}
      </div>
      <Field label="Notes">{(id) => <Textarea id={id} value={f.notes || ''} onChange={(e) => setF({ ...f, notes: e.target.value })} />}</Field>
      {cycle && <p className="text-xs text-gray-500">Changing the sowing date reschedules suggested tasks. Tasks you completed or edited are kept.</p>}
      {err && <ErrorBox error={err} />}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? <Spinner /> : 'Save'}</Button></div>
    </form>
  );
}

export function FarmPage() {
  const farms = useFarms();
  const cycles = useAsync(() => api.get('/v1/cycles').then((r) => r.cycles));
  const cropName = useCropName();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const [params, setParams] = useSearchParams();
  const [modal, setModal] = useState<null | { kind: 'farm'; farm?: Farm } | { kind: 'plot'; farm: Farm } | { kind: 'cycle'; cycle?: any }>(null);
  const [plotName, setPlotName] = useState(''); const [plotArea, setPlotArea] = useState('');

  useEffect(() => {
    if (params.get('add') === 'crop' && farms.data) {
      setModal(farms.data.length ? { kind: 'cycle' } : { kind: 'farm' });
      setParams({}, { replace: true });
    }
  }, [params, farms.data, setParams]);

  const reload = () => { farms.reload(); cycles.reload(); setModal(null); };

  if (farms.loading) return <Skeleton lines={6} />;
  if (farms.error) return <ErrorBox error={farms.error} onRetry={farms.reload} />;
  const list = farms.data!;

  return (
    <div>
      {node}
      <PageHeader title="My Farm" icon={<Tractor />} subtitle="Farms, plots and crops. Everything here is saved to your account."
        actions={<><Button variant="outline" onClick={() => setModal({ kind: 'farm' })}><Plus className="mr-1 h-4 w-4" />Farm</Button>
          {list.length > 0 && <Button onClick={() => setModal({ kind: 'cycle' })}><Sprout className="mr-1 h-4 w-4" />Add crop</Button>}</>} />

      {list.length === 0 ? (
        <Empty title="No farms yet" icon={<Tractor className="h-8 w-8" />} action={<Button onClick={() => setModal({ kind: 'farm' })}>Add your first farm</Button>}>
          Add a farm to get local weather, crop calendars and advice.
        </Empty>
      ) : (
        <div className="space-y-4">
          {list.map((farm) => {
            const fc = (cycles.data || []).filter((c: any) => c.farm_id === farm.id);
            return (
              <Section key={farm.id} title={farm.name}
                description={[farm.village, farm.district, farm.state].filter(Boolean).join(', ') + (farm.total_area ? ` · ${farm.total_area} ${farm.area_unit}` : '')}
                actions={<div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setModal({ kind: 'farm', farm })} aria-label={`Edit ${farm.name}`}><Pencil className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" aria-label={`Delete ${farm.name}`} onClick={async () => {
                    if (!(await ask('Delete farm?', `This permanently deletes "${farm.name}", its plots, crops, tasks and records.`, { danger: true, label: 'Delete' }))) return;
                    await api.del(`/v1/farms/${farm.id}`); toast('Farm deleted'); reload();
                  }}><Trash2 className="h-4 w-4 text-red-600" /></Button></div>}>
                {farm.latitude == null && <div className="mb-3"><Notice tone="warn">No location set. Edit the farm to add one so weather and alerts work.</Notice></div>}
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">Plots</h3>
                      <Button size="sm" variant="outline" onClick={() => { setPlotName(''); setPlotArea(''); setModal({ kind: 'plot', farm }); }}><Plus className="mr-1 h-3 w-3" />Plot</Button></div>
                    {farm.plots.length === 0 ? <p className="text-sm text-gray-500">No plots. Crops can be added to the whole farm.</p> : (
                      <ul className="divide-y rounded-lg border text-sm">
                        {farm.plots.map((p: any) => (
                          <li key={p.id} className="flex items-center justify-between px-3 py-2">
                            <span>{p.name}{p.area && <span className="text-gray-500"> · {p.area} {p.area_unit}</span>}{p.boundary_geojson && <Badge tone="green">boundary</Badge>}</span>
                            <button className="text-xs text-red-700 underline" onClick={async () => {
                              if (!(await ask('Delete plot?', `Delete plot "${p.name}"?`, { danger: true, label: 'Delete' }))) return;
                              await api.del(`/v1/farms/${farm.id}/plots/${p.id}`); reload();
                            }}>Delete</button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <h3 className="mb-2 text-sm font-semibold">Crops</h3>
                    {fc.length === 0 ? <p className="text-sm text-gray-500">No crops on this farm.</p> : (
                      <ul className="space-y-2">
                        {fc.map((c: any) => (
                          <li key={c.id} className="rounded-lg border p-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold">{cropName(c.crop_id, c.crop_name)}{c.variety && <span className="font-normal text-gray-500"> ({c.variety})</span>}</span>
                              <Badge tone={c.status === 'active' ? 'green' : 'gray'}>{c.status}</Badge>
                            </div>
                            <p className="text-xs text-gray-600">Sown {fmtDate(c.sowing_date)}{c.plot_name && ` · ${c.plot_name}`} · {c.stage_status === 'in_progress' ? `${c.stage?.name} (day ${c.current_day})` : c.stage_status.replace('_', ' ')}</p>
                            <div className="mt-1 flex gap-3 text-xs">
                              <button className="text-emerald-700 underline" onClick={() => setModal({ kind: 'cycle', cycle: c })}>Edit</button>
                              <button className="text-red-700 underline" onClick={async () => {
                                if (!(await ask('Delete crop?', 'This removes the crop and its calendar tasks.', { danger: true, label: 'Delete' }))) return;
                                await api.del(`/v1/cycles/${c.id}`); reload();
                              }}>Delete</button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </Section>
            );
          })}
        </div>
      )}

      <Modal open={modal?.kind === 'farm'} onClose={() => setModal(null)} title={(modal as any)?.farm ? 'Edit farm' : 'Add farm'} wide>
        {modal?.kind === 'farm' && <FarmForm farm={modal.farm} onSaved={reload} onCancel={() => setModal(null)} />}
      </Modal>
      <Modal open={modal?.kind === 'cycle'} onClose={() => setModal(null)} title={(modal as any)?.cycle ? 'Edit crop' : 'Add crop'}>
        {modal?.kind === 'cycle' && <CycleForm farms={list} cycle={modal.cycle} onSaved={reload} onCancel={() => setModal(null)} />}
      </Modal>
      <Modal open={modal?.kind === 'plot'} onClose={() => setModal(null)} title="Add plot">
        {modal?.kind === 'plot' && (
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            try { await api.post(`/v1/farms/${modal.farm.id}/plots`, { name: plotName, area: plotArea ? Number(plotArea) : null }); toast('Plot added'); reload(); }
            catch (err: any) { toast(err.message, 'error'); }
          }}>
            <Field label="Plot name" required>{(id) => <Input id={id} value={plotName} onChange={(e) => setPlotName(e.target.value)} required />}</Field>
            <Field label="Area (acre)">{(id) => <Input id={id} type="number" min="0" step="0.01" value={plotArea} onChange={(e) => setPlotArea(e.target.value)} />}</Field>
            <p className="text-xs text-gray-500">Draw the plot boundary on the Satellite page.</p>
            <div className="flex justify-end"><Button type="submit">Save</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

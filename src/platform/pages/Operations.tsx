import { useState, type FormEvent } from 'react';
import { Briefcase, Plus, Trash2 } from 'lucide-react';
import { api, fmtDate, inr, today } from '../api';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Section, Select, Skeleton, Tabs, Textarea, useAsync, useToast } from '../ui';
import { FarmSelect, useFarms } from '../shared';

type Kind = 'expenses' | 'harvests' | 'activities';

const EXPENSE_CATS = ['seeds', 'fertilizer', 'crop_protection', 'labor', 'irrigation', 'electricity', 'equipment', 'transport', 'other'];
const ACTIVITY_KINDS = ['input_application', 'scouting', 'labor', 'equipment', 'irrigation', 'sowing', 'harvest', 'other'];

export function OperationsPage() {
  const toast = useToast();
  const farms = useFarms();
  const cycles = useAsync(() => api.get('/v1/cycles').then((r) => r.cycles));
  const [tab, setTab] = useState<Kind | 'summary'>('summary');
  const [farmId, setFarmId] = useState('');
  const records = useAsync(() => (tab === 'summary' ? Promise.resolve([]) : api.get(`/v1/records/${tab}${farmId ? `?farm_id=${farmId}` : ''}`).then((r) => r.items)), [tab, farmId]);
  const summary = useAsync(() => api.get('/v1/finance/summary'), [tab]);
  const [form, setForm] = useState<any>(null);

  const cycleLabel = (id?: string) => { const c = (cycles.data || []).find((x: any) => x.id === id); return c ? `${c.crop_name} (${fmtDate(c.sowing_date)})` : ''; };
  const farmCycles = (fid: string) => (cycles.data || []).filter((c: any) => c.farm_id === fid).map((c: any) => ({ value: c.id, label: `${c.crop_name} – sown ${fmtDate(c.sowing_date)}` }));

  const save = async (e: FormEvent) => {
    e.preventDefault();
    const { kind, ...data } = form;
    const num = (v: any) => (v === '' || v == null ? null : Number(v));
    const body: any = { ...data, crop_cycle_id: data.crop_cycle_id || null };
    if (kind === 'expenses') body.amount_inr = num(data.amount_inr);
    if (kind === 'harvests') { body.quantity = num(data.quantity); body.sold_quantity = num(data.sold_quantity); body.price_per_unit_inr = num(data.price_per_unit_inr); }
    if (kind === 'activities') { body.quantity = num(data.quantity); body.kind = data.kind_ || 'scouting'; delete body.kind_; }
    try { await api.post(`/v1/records/${kind}`, body); toast('Saved'); setForm(null); records.reload(); summary.reload(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  if (farms.loading) return <Skeleton lines={6} />;
  if (!farms.data?.length) return <><PageHeader title="Farm Operations" icon={<Briefcase />} /><Empty title="Add a farm first">Records are linked to a farm.</Empty></>;

  const s = summary.data;
  return (
    <div>
      <PageHeader title="Farm Operations" icon={<Briefcase />} subtitle="Expenses, harvests, sales and field activities. Estimates are kept separate from confirmed figures."
        actions={tab !== 'summary' && <Button onClick={() => setForm({ kind: tab, farm_id: farmId || farms.data![0].id, date: today(), is_estimate: false, unit: tab === 'harvests' ? 'quintal' : undefined, category: 'seeds', kind_: undefined })}><Plus className="mr-1 h-4 w-4" />Add</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'summary', label: 'Profit summary' }, { id: 'expenses', label: 'Expenses' }, { id: 'harvests', label: 'Harvest & sales' }, { id: 'activities', label: 'Activity log' }]} />

      {tab === 'summary' ? (summary.loading ? <Skeleton /> : summary.error ? <ErrorBox error={summary.error} /> : (
        <div className="space-y-4">
          <Section title="By crop cycle">
            {s.byCycle.length === 0 ? <Empty title="No crops yet" /> : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-xs text-gray-500"><tr><th className="p-2">Crop</th><th className="p-2 text-right">Cost (actual)</th><th className="p-2 text-right">Cost (estimated)</th><th className="p-2 text-right">Sales (actual)</th><th className="p-2 text-right">Revenue (estimated)</th><th className="p-2 text-right">Profit (actual)</th></tr></thead>
                  <tbody>
                    {s.byCycle.map((r: any) => (
                      <tr key={r.cycle_id} className="border-t">
                        <td className="p-2"><p className="font-medium">{r.crop_name}</p><p className="text-xs text-gray-500">{r.farm_name}{r.plot_name && ` · ${r.plot_name}`} · {r.season || ''} {fmtDate(r.sowing_date)}</p></td>
                        <td className="p-2 text-right">{inr(r.cost_actual)}</td>
                        <td className="p-2 text-right text-gray-500">{inr(r.cost_estimated)}</td>
                        <td className="p-2 text-right">{inr(r.revenue_actual)}</td>
                        <td className="p-2 text-right text-gray-500">{inr(r.revenue_estimated)}</td>
                        <td className={`p-2 text-right font-semibold ${r.profit_actual < 0 ? 'text-red-700' : 'text-emerald-700'}`}>{inr(r.profit_actual)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {s.unassignedActualCost > 0 && <p className="mt-2 text-xs text-gray-500">Plus {inr(s.unassignedActualCost)} of expenses not linked to a crop.</p>}
          </Section>
          <Section title="Expenses by category">
            <ul className="grid gap-2 sm:grid-cols-3">
              {s.byCategory.map((c: any, i: number) => <li key={i} className="flex justify-between rounded-lg bg-gray-50 p-2 text-sm"><span>{c.category.replace('_', ' ')} {c.is_estimate ? <Badge tone="amber">estimate</Badge> : null}</span><b>{inr(c.total)}</b></li>)}
            </ul>
          </Section>
        </div>
      )) : (
        <Section actions={<div className="w-48"><FarmSelect farms={farms.data} value={farmId} onChange={setFarmId} allowAll /></div>}>
          {records.loading ? <Skeleton /> : records.error ? <ErrorBox error={records.error} /> : !records.data?.length ? <Empty title="No records yet" /> : (
            <ul className="divide-y">
              {records.data.map((r: any) => (
                <li key={r.id} className="flex items-start justify-between gap-2 py-2 text-sm">
                  <div>
                    {tab === 'expenses' && <p className="font-medium">{r.category.replace('_', ' ')} – {inr(r.amount_inr)} {r.is_estimate ? <Badge tone="amber">estimate</Badge> : <Badge tone="green">confirmed</Badge>}</p>}
                    {tab === 'harvests' && <p className="font-medium">{r.quantity} {r.unit} harvested{r.sold_quantity != null && `, ${r.sold_quantity} sold @ ${inr(r.price_per_unit_inr)}`} {r.is_estimate ? <Badge tone="amber">estimate</Badge> : null}</p>}
                    {tab === 'activities' && <p className="font-medium">{r.kind.replace('_', ' ')}: {r.details}</p>}
                    <p className="text-xs text-gray-500">{fmtDate(r.date)} {cycleLabel(r.crop_cycle_id) && `· ${cycleLabel(r.crop_cycle_id)}`} {r.notes && `· ${r.notes}`}</p>
                  </div>
                  <button aria-label="Delete" className="p-1 text-gray-400 hover:text-red-600" onClick={async () => { if (confirm('Delete this record?')) { await api.del(`/v1/records/${tab}/${r.id}`); records.reload(); } }}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Modal open={!!form} onClose={() => setForm(null)} title="Add record">
        {form && (
          <form className="space-y-3" onSubmit={save}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Farm">{(id) => <FarmSelect id={id} farms={farms.data!} value={form.farm_id} onChange={(v) => setForm({ ...form, farm_id: v, crop_cycle_id: '' })} />}</Field>
              <Field label="Crop">{(id) => <Select id={id} value={form.crop_cycle_id || ''} onChange={(e) => setForm({ ...form, crop_cycle_id: e.target.value })} placeholder="Not linked" options={farmCycles(form.farm_id)} />}</Field>
              <Field label="Date" required>{(id) => <Input id={id} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />}</Field>
              {form.kind === 'expenses' && <>
                <Field label="Category">{(id) => <Select id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={EXPENSE_CATS.map((c) => ({ value: c, label: c.replace('_', ' ') }))} />}</Field>
                <Field label="Amount (₹)" required>{(id) => <Input id={id} type="number" min="0" step="1" value={form.amount_inr ?? ''} onChange={(e) => setForm({ ...form, amount_inr: e.target.value })} required />}</Field>
              </>}
              {form.kind === 'harvests' && <>
                <Field label="Quantity harvested" required>{(id) => <Input id={id} type="number" min="0" step="0.01" value={form.quantity ?? ''} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />}</Field>
                <Field label="Unit">{(id) => <Select id={id} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} options={['quintal', 'kg', 'tonne'].map((u) => ({ value: u, label: u }))} />}</Field>
                <Field label="Quantity sold">{(id) => <Input id={id} type="number" min="0" step="0.01" value={form.sold_quantity ?? ''} onChange={(e) => setForm({ ...form, sold_quantity: e.target.value })} />}</Field>
                <Field label="Price per unit (₹)">{(id) => <Input id={id} type="number" min="0" value={form.price_per_unit_inr ?? ''} onChange={(e) => setForm({ ...form, price_per_unit_inr: e.target.value })} />}</Field>
                <Field label="Buyer / mandi">{(id) => <Input id={id} value={form.buyer || ''} onChange={(e) => setForm({ ...form, buyer: e.target.value })} />}</Field>
              </>}
              {form.kind === 'activities' && <>
                <Field label="Activity">{(id) => <Select id={id} value={form.kind_ || 'scouting'} onChange={(e) => setForm({ ...form, kind_: e.target.value })} options={ACTIVITY_KINDS.map((c) => ({ value: c, label: c.replace('_', ' ') }))} />}</Field>
                <Field label="Quantity (optional)">{(id) => <Input id={id} type="number" min="0" step="0.01" value={form.quantity ?? ''} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />}</Field>
              </>}
            </div>
            {form.kind === 'activities' && <Field label="Details" required>{(id) => <Textarea id={id} value={form.details || ''} onChange={(e) => setForm({ ...form, details: e.target.value })} required />}</Field>}
            {form.kind !== 'activities' && <>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!form.is_estimate} onChange={(e) => setForm({ ...form, is_estimate: e.target.checked })} />This is an estimate, not a confirmed amount</label>
              <Field label="Notes">{(id) => <Textarea id={id} value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}</Field>
            </>}
            <div className="flex justify-end"><Button type="submit">Save</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

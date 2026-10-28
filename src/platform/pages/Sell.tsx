import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, Download, Plus, Scale, Sprout, Warehouse } from 'lucide-react';
import { api, fmtDate, fmtDateTime, inr, today } from '../api';
import { useAuth } from '../auth';
import { Badge, Button, Empty, ErrorBox, Field, Input, MicButton, Notice, PageHeader, Section, Select, Skeleton, Spinner, Textarea, useAsync, useConfirm, useToast } from '../ui';
import { CropSelect, useCrops } from '../shared';
import { PrivateImage, StatusBadge, VoiceHint } from '../trade-ui';
import { RequestGradingPanel } from './Grading';
import { INITIAL_PRODUCE } from '../../data/mockData';

const UNITS = [{ value: 'quintal', label: 'Quintal (100 kg)' }, { value: 'kg', label: 'Kilogram' }, { value: 'tonne', label: 'Tonne (1000 kg)' }];

/** Listings the farmer created on this device in the earlier, browser-only marketplace (not the demo data). */
function legacyItems() {
  try {
    const all = JSON.parse(localStorage.getItem('fc_produce_list') || '[]');
    const demo = new Set(INITIAL_PRODUCE.map((p) => p.id));
    return (Array.isArray(all) ? all : []).filter((p: any) => p && !demo.has(p.id) && p.cropName && p.quantity > 0);
  } catch { return []; }
}

export function SellPage() {
  const toast = useToast();
  const { user } = useAuth();
  const r = useAsync(() => api.get('/v1/marketplace/lots/mine'));
  const legacy = legacyItems();
  if (r.loading) return <Skeleton lines={6} />;
  if (r.error) return <ErrorBox error={r.error} onRetry={r.reload} />;
  const standing = r.data.standing ?? user?.farmer_standing;
  return (
    <div className="space-y-4">
      <PageHeader title="Sell Produce" icon={<Sprout />} subtitle="List your harvest, get offers from verified buyers, and track every sale"
        actions={<Link to="/sell/new"><Button size="lg"><Plus className="mr-1 h-5 w-5" />Sell my crop</Button></Link>} />
      {standing && !standing.transaction_eligible && (
        <Notice tone="warn" title="One step before you can publish">{standing.restriction ? `Your account is restricted: ${standing.restriction.reason}.` : standing.next_step} <Link to="/account/verification" className="underline">Open account status</Link></Notice>
      )}
      {legacy.length > 0 && (
        <Notice title="Listings from the old marketplace on this phone">
          You created {legacy.length} listing(s) in the earlier version. Import them as drafts to check and publish.
          <Button size="sm" variant="outline" className="ml-2" onClick={async () => {
            const res = await api.post('/v1/marketplace/lots/import-legacy', { items: legacy.map((p: any) => ({ id: p.id, cropName: p.cropName, quantity: Number(p.quantity), pricePerKg: Number(p.pricePerKg) || 0, negotiable: !!p.negotiable })) });
            toast(`${res.created} draft(s) imported`); r.reload();
          }}>Import as drafts</Button>
        </Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link to="/market?tab=demand" className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-emerald-400"><p className="font-semibold">Buyer requirements</p><p className="text-sm text-gray-600">See what verified buyers want and respond</p></Link>
        <Link to="/market?tab=prices" className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-emerald-400"><p className="font-semibold">Compare prices</p><p className="text-sm text-gray-600">Mandi, buyer bids and recent sales</p></Link>
        <Link to="/storage" className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-emerald-400"><p className="font-semibold">Store and wait</p><p className="text-sm text-gray-600">Book a nearby verified warehouse</p></Link>
      </div>
      <Section title="My lots">
        {r.data.lots.length === 0 ? <Empty title="No produce listed yet" action={<Link to="/sell/new"><Button>Sell my crop</Button></Link>}>Create a lot in a few simple steps.</Empty> : (
          <ul className="divide-y">
            {r.data.lots.map((l: any) => (
              <li key={l.id}>
                <Link to={`/sell/${l.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-gray-50">
                  <div>
                    <p className="text-lg font-semibold">{l.commodity}{l.variety && <span className="font-normal text-gray-500"> · {l.variety}</span>}</p>
                    <p className="text-sm text-gray-600">{l.quantity_available} of {l.quantity_total} {l.unit} available{l.quantity_reserved > 0 && ` · ${l.quantity_reserved} reserved`}{l.price_per_unit != null && ` · ${inr(l.price_per_unit)}/${l.unit}`}</p>
                  </div>
                  <div className="flex items-center gap-2">{l.pending_offers > 0 && <Badge tone="blue">{l.pending_offers} offer(s)</Badge>}<StatusBadge status={l.status} /></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

const DRAFT = 'fd_lot_draft';

/** One question per screen, with voice help and a draft saved on the phone. */
export function SellWizardPage() {
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const crops = useCrops();
  const saved = (() => { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { return null; } })();
  const [step, setStep] = useState<number>(saved?.step ?? 0);
  const [f, setF] = useState<any>(saved?.f ?? { crop_id: '', commodity: '', variety: '', quantity_total: '', unit: 'quintal', price_per_unit: '', negotiable: true, allow_partial: true, min_order_qty: '', harvest_date: today(), preferred_sale_date: '', quality_grade: '', moisture_pct: '', packaging: '', notes: '', storage_required: false });
  const [photos, setPhotos] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { try { localStorage.setItem(DRAFT, JSON.stringify({ step, f })); } catch { /* ignore */ } }, [step, f]);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  const submit = async (publish: boolean) => {
    setBusy(true); setErr(null);
    try {
      const num = (v: any) => (v === '' || v == null ? null : Number(v));
      const r = await api.post('/v1/marketplace/lots', {
        crop_id: f.crop_id || null, commodity: f.commodity || crops.find((c) => c.id === f.crop_id)?.name || '', variety: f.variety || null,
        quantity_total: Number(f.quantity_total), unit: f.unit, price_per_unit: num(f.price_per_unit), negotiable: f.negotiable, allow_partial: f.allow_partial,
        min_order_qty: num(f.min_order_qty), harvest_date: f.harvest_date || null, preferred_sale_date: f.preferred_sale_date || null,
        quality_grade: f.quality_grade || null, moisture_pct: num(f.moisture_pct), packaging: f.packaging || null, notes: f.notes || null,
        storage_required: f.storage_required, publish,
      });
      for (const p of photos) { const fd = new FormData(); fd.append('file', p); await api.post(`/v1/marketplace/lots/${r.lot.id}/photos`, fd).catch(() => toast('One photo could not be uploaded', 'error')); }
      try { localStorage.removeItem(DRAFT); } catch { /* ignore */ }
      toast(publish ? 'Your crop is now listed for buyers' : 'Saved as draft');
      nav(`/sell/${r.lot.id}`, { replace: true });
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const big = 'py-3 text-lg';
  const steps = [
    { title: 'Which crop?', voice: 'Choose the crop you want to sell.', valid: !!(f.crop_id || f.commodity), body: (
      <div className="space-y-3">
        <Field label="Crop">{(id) => <CropSelect id={id} value={f.crop_id} onChange={(v) => { set('crop_id', v); set('commodity', crops.find((c) => c.id === v)?.name ?? ''); }} state={user?.state} />}</Field>
        {!f.crop_id && <Field label="Or type the crop name">{(id) => <Input id={id} className={big} value={f.commodity} onChange={(e) => set('commodity', e.target.value)} placeholder="Example: Groundnut" />}</Field>}
        <Field label="Variety (if you know it)" hint="Example: BPT 5204">{(id) => <div className="flex gap-2"><Input id={id} className={big} value={f.variety} onChange={(e) => set('variety', e.target.value)} /><MicButton onText={(t) => set('variety', t)} /></div>}</Field>
      </div>) },
    { title: 'How much?', voice: 'Type how much you have to sell, and choose quintal, kilogram or tonne.', valid: Number(f.quantity_total) > 0, body: (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity" hint="Example: 20">{(id) => <Input id={id} className={big} type="number" min="0" step="0.01" inputMode="decimal" value={f.quantity_total} onChange={(e) => set('quantity_total', e.target.value)} />}</Field>
          <Field label="Unit">{(id) => <Select id={id} className={big} value={f.unit} onChange={(e) => set('unit', e.target.value)} options={UNITS} />}</Field>
        </div>
        <label className="flex items-center gap-3 text-base"><input type="checkbox" className="h-6 w-6" checked={f.allow_partial} onChange={(e) => set('allow_partial', e.target.checked)} />Buyers can buy part of it</label>
        {f.allow_partial && <Field label="Smallest order you accept (optional)">{(id) => <Input id={id} type="number" min="0" value={f.min_order_qty} onChange={(e) => set('min_order_qty', e.target.value)} />}</Field>}
      </div>) },
    { title: 'Your price', voice: 'Type the price you want for each unit. You can let buyers make offers.', valid: true, body: (
      <div className="space-y-3">
        <Field label={`Price per ${f.unit} (₹)`} hint="Leave empty if you want buyers to offer a price">{(id) => <Input id={id} className={big} type="number" min="0" inputMode="numeric" value={f.price_per_unit} onChange={(e) => set('price_per_unit', e.target.value)} />}</Field>
        <label className="flex items-center gap-3 text-base"><input type="checkbox" className="h-6 w-6" checked={f.negotiable} onChange={(e) => set('negotiable', e.target.checked)} />Price can be negotiated</label>
        {f.crop_id && <Link to={`/market?tab=prices&crop=${f.crop_id}`} target="_blank" className="text-sm text-emerald-700 underline">Check today's mandi and buyer prices</Link>}
      </div>) },
    { title: 'When and where?', voice: 'Tell us the harvest date and when you want to sell. Pickup is from your village.', valid: true, body: (
      <div className="space-y-3">
        <Field label="Harvest date (or expected)">{(id) => <Input id={id} className={big} type="date" value={f.harvest_date} onChange={(e) => set('harvest_date', e.target.value)} />}</Field>
        <Field label="Preferred sale date (optional)">{(id) => <Input id={id} className={big} type="date" value={f.preferred_sale_date} onChange={(e) => set('preferred_sale_date', e.target.value)} />}</Field>
        <Notice>Pickup location: {[user?.village, user?.district, user?.state].filter(Boolean).join(', ') || 'add your village in Settings'}. Buyers see only the village and district – never your phone number or address.</Notice>
        <label className="flex items-center gap-3 text-base"><input type="checkbox" className="h-6 w-6" checked={f.storage_required} onChange={(e) => set('storage_required', e.target.checked)} />I may need storage before selling</label>
      </div>) },
    { title: 'Quality (optional)', voice: 'Add the grade, moisture and photos if you have them. This helps buyers trust your crop.', valid: true, body: (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grade" hint="Example: FAQ, A">{(id) => <Input id={id} value={f.quality_grade} onChange={(e) => set('quality_grade', e.target.value)} />}</Field>
          <Field label="Moisture %" hint="If measured">{(id) => <Input id={id} type="number" min="0" max="100" value={f.moisture_pct} onChange={(e) => set('moisture_pct', e.target.value)} />}</Field>
        </div>
        <Field label="Packaging" hint="Example: 50 kg gunny bags">{(id) => <Input id={id} value={f.packaging} onChange={(e) => set('packaging', e.target.value)} />}</Field>
        <Field label="Notes for buyers">{(id) => <div className="flex gap-2"><Textarea id={id} value={f.notes} onChange={(e) => set('notes', e.target.value)} /><MicButton onText={(t) => set('notes', `${f.notes} ${t}`.trim())} /></div>}</Field>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const fl = e.target.files?.[0]; if (fl) setPhotos((p) => [...p, fl].slice(0, 6)); }} />
        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Camera className="mr-1 h-4 w-4" />Add photo ({photos.length}/6)</Button>
      </div>) },
    { title: 'Check and publish', voice: 'Check the details. Press Publish to show your crop to verified buyers, or save as draft.', valid: true, body: (
      <dl className="grid grid-cols-2 gap-2 rounded-xl bg-gray-50 p-4 text-base">
        <dt className="text-gray-500">Crop</dt><dd className="font-semibold">{f.commodity}{f.variety && ` (${f.variety})`}</dd>
        <dt className="text-gray-500">Quantity</dt><dd className="font-semibold">{f.quantity_total} {f.unit}</dd>
        <dt className="text-gray-500">Price</dt><dd className="font-semibold">{f.price_per_unit ? `${inr(Number(f.price_per_unit))}/${f.unit}` : 'Buyers offer'}{f.negotiable && ' · negotiable'}</dd>
        <dt className="text-gray-500">Harvest</dt><dd>{fmtDate(f.harvest_date)}</dd>
        <dt className="text-gray-500">Photos</dt><dd>{photos.length}</dd>
      </dl>) },
  ];
  const s = steps[step];
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Step {step + 1} of {steps.length}</p><VoiceHint text={s.voice} /></div>
        <div className="my-3 h-2 rounded bg-gray-100"><div className="h-2 rounded bg-emerald-600" style={{ width: `${((step + 1) / steps.length) * 100}%` }} /></div>
        <h1 className="mb-4 text-2xl font-bold">{s.title}</h1>
        {s.body}
        {err && <div className="mt-3"><ErrorBox error={err} /></div>}
        <div className="mt-6 flex flex-wrap justify-between gap-2">
          {step > 0 ? <Button variant="outline" size="lg" onClick={() => setStep(step - 1)}>Back</Button> : <Link to="/sell"><Button variant="ghost">Cancel</Button></Link>}
          {step < steps.length - 1
            ? <Button size="lg" disabled={!s.valid} onClick={() => setStep(step + 1)}>Next</Button>
            : <div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => submit(false)}>Save draft</Button><Button size="lg" disabled={busy} onClick={() => submit(true)}>{busy ? <Spinner /> : 'Publish'}</Button></div>}
        </div>
        <p className="mt-3 text-xs text-gray-500">Your answers are saved on this phone until you publish.</p>
      </div>
    </div>
  );
}

export function LotManagePage() {
  const { id } = useParams();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const lot = useAsync(() => api.get(`/v1/marketplace/lots/${id}`), [id]);
  const threads = useAsync(() => api.get('/v1/offers/threads').then((r) => r.threads.filter((t: any) => t.lot_id === id)), [id]);
  const [months, setMonths] = useState(2);
  const opts = useAsync(() => api.get(`/v1/marketplace/lots/${id}/sell-options?months=${months}`), [id, months]);
  const [price, setPrice] = useState('');
  if (lot.loading) return <Skeleton lines={8} />;
  if (lot.error) return <ErrorBox error={lot.error} />;
  const l = lot.data.lot;
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); lot.reload(); } catch (e: any) { toast(e.message, 'error'); } };
  return (
    <div className="space-y-4">
      {node}
      <PageHeader title={`${l.commodity}${l.variety ? ` · ${l.variety}` : ''}`} icon={<Sprout />} subtitle={<span className="flex items-center gap-2"><StatusBadge status={l.status} /> {l.quantity_available} of {l.quantity_total} {l.unit} available</span>}
        actions={<>
          {['draft', 'expired', 'withdrawn'].includes(l.status) && <Button onClick={() => act(() => api.post(`/v1/marketplace/lots/${l.id}/publish`), 'Published')}>Publish</Button>}
          {!['draft', 'withdrawn', 'sold'].includes(l.status) && <Button variant="outline" onClick={async () => { if (await ask('Withdraw this lot?', 'Pending offers will be closed. Reserved quantity must be handled first.', { danger: true, label: 'Withdraw' })) act(() => api.post(`/v1/marketplace/lots/${l.id}/withdraw`), 'Withdrawn'); }}>Withdraw</Button>}
          <Link to={`/storage?lot=${l.id}`}><Button variant="outline"><Warehouse className="mr-1 h-4 w-4" />Book storage</Button></Link>
        </>} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Details" className="lg:col-span-1">
          {l.photos.length > 0 && <div className="mb-3 grid grid-cols-3 gap-2">{l.photos.map((p: string) => <PrivateImage key={p} id={p} alt="Produce" className="h-20 w-full rounded-lg object-cover" />)}</div>}
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Price</dt><dd>{l.price_per_unit != null ? `${inr(l.price_per_unit)}/${l.unit}` : 'Open to offers'}{l.negotiable && ' (negotiable)'}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Reserved / sold</dt><dd>{l.quantity_reserved ?? 0} / {l.quantity_sold} {l.unit}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Harvest</dt><dd>{fmtDate(l.harvest_date)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Pickup</dt><dd>{[l.location.village, l.location.district].filter(Boolean).join(', ')}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-500">Listing expires</dt><dd>{fmtDate(l.expires_at)}</dd></div>
          </dl>
          {!['sold', 'withdrawn'].includes(l.status) && (
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); act(() => api.patch(`/v1/marketplace/lots/${l.id}`, { price_per_unit: Number(price) }), 'Price updated'); }}>
              <Input type="number" min="0" placeholder="New price" value={price} onChange={(e) => setPrice(e.target.value)} aria-label="New price" />
              <Button type="submit" variant="outline" disabled={!price}>Update</Button>
            </form>
          )}
          <label className="mt-3 block text-sm">
            <span className="text-gray-600">Add a photo</span>
            <input type="file" accept="image/*" className="mt-1 block text-sm" onChange={async (e) => {
              const fl = e.target.files?.[0]; if (!fl) return;
              const fd = new FormData(); fd.append('file', fl);
              act(() => api.post(`/v1/marketplace/lots/${l.id}/photos`, fd), 'Photo added');
            }} />
          </label>
        </Section>

        <Section title="Offers from buyers" className="lg:col-span-2">
          {threads.loading ? <Skeleton /> : !threads.data?.length ? <Empty title="No offers yet">Verified buyers will see your lot. You can also respond to buyer requirements.</Empty> : (
            <ul className="divide-y">
              {threads.data.map((t: any) => (
                <li key={t.thread_id}>
                  <Link to={`/trade/threads/${t.thread_id}`} className="flex items-center justify-between gap-2 py-3 hover:bg-gray-50">
                    <div><p className="font-semibold">{t.quantity} {t.unit} @ {inr(t.price_per_unit)}/{t.unit}</p><p className="text-xs text-gray-500">{fmtDateTime(t.created_at)} · {t.awaiting_me ? 'Waiting for your reply' : 'Waiting for buyer'}</p></div>
                    <div className="flex items-center gap-2">{t.awaiting_me && <Badge tone="red">Reply</Badge>}<StatusBadge status={t.status} /></div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <RequestGradingPanel lot={l} onChange={lot.reload} />

      <Section title={<span className="flex items-center gap-2"><Scale className="h-5 w-5" />Compare selling options</span>}
        description="Estimated net amount after the costs we know. Missing costs are shown as unknown, not guessed."
        actions={<Select aria-label="Storage months" className="w-40" value={String(months)} onChange={(e) => setMonths(Number(e.target.value))} options={[1, 2, 3, 4, 6].map((m) => ({ value: String(m), label: `Store ${m} month(s)` }))} />}>
        {opts.loading ? <Skeleton /> : opts.error ? <ErrorBox error={opts.error} /> : (
          <div className="space-y-3">
            <Notice tone="ok">{opts.data.recommendation}</Notice>
            {opts.data.options.length === 0 && <p className="text-sm text-gray-600">No offers, buyer requirements, mandi records or nearby storage found yet.</p>}
            {opts.data.options.map((o: any) => (
              <div key={o.key} className="rounded-xl border border-gray-200 p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{o.title}</p>
                  <p className="text-lg font-bold">{o.net_realization != null ? `${inr(o.net_realization)} net` : o.break_even_price_per_qtl ? `Break-even ₹${o.break_even_price_per_qtl}/qtl` : o.revenue != null ? `${inr(o.revenue)} gross` : '—'}</p>
                </div>
                <ul className="mt-1 space-y-0.5 text-gray-600">
                  {o.revenue != null && <li>Revenue: {inr(o.revenue)}</li>}
                  {o.costs.map((c: any, i: number) => <li key={i}>{c.label}: {c.amount != null ? inr(c.amount) : <span className="text-amber-700">unknown</span>} <span className="text-xs text-gray-400">({c.source})</span></li>)}
                </ul>
                <p className="mt-1 text-xs text-gray-500">{o.certainty}{o.data_time && ` · data from ${fmtDate(o.data_time)}`}</p>
                {o.thread_id && <Link to={`/trade/threads/${o.thread_id}`} className="text-sm text-emerald-700 underline">Open this offer</Link>}
                {o.demand_id && <Link to={`/market/demand/${o.demand_id}`} className="text-sm text-emerald-700 underline">Respond to this buyer</Link>}
                {o.facility_id && <Link to={`/storage/facilities/${o.facility_id}?lot=${l.id}`} className="text-sm text-emerald-700 underline">See this storage</Link>}
              </div>
            ))}
            <p className="text-xs text-gray-500">{opts.data.disclaimer}</p>
          </div>
        )}
      </Section>
      <button className="inline-flex items-center gap-1 text-xs text-gray-500 underline" onClick={() => window.print()}><Download className="h-3 w-3" />Print this page</button>
    </div>
  );
}

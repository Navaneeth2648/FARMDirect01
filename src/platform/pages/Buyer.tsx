import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheck, CheckCircle2, ClipboardList, Circle, ShoppingBasket } from 'lucide-react';
import { api, fmtDate, inr } from '../api';
import { useAuth } from '../auth';
import { Button, Empty, ErrorBox, Field, Input, INDIAN_STATES, Notice, PageHeader, Section, Select, Skeleton, Tabs, Textarea, useAsync, useToast } from '../ui';
import { CropSelect, useCrops } from '../shared';
import { DocLink, StatusBadge } from '../trade-ui';

export function BuyerHomePage() {
  const { user, t } = useAuth();
  const prof = useAsync(() => api.get('/v1/buyer/profile'));
  const threads = useAsync(() => api.get('/v1/offers/threads').then((r) => r.threads));
  const orders = useAsync(() => api.get('/v1/orders').then((r) => r.orders));
  const demand = useAsync(() => api.get('/v1/marketplace/demand/mine').then((r) => r.demand));
  const payments = useAsync(() => api.get('/v1/payments').then((r) => r.payments));
  if (prof.loading) return <Skeleton lines={6} />;
  if (prof.error) return <ErrorBox error={prof.error} />;
  const s = prof.data.standing;
  const due = (payments.data || []).filter((p: any) => p.payer_id === user?.id && ['required', 'refund_pending'].includes(p.status));
  const activeOrders = (orders.data || []).filter((o: any) => !['completed', 'cancelled'].includes(o.status));
  const awaiting = (threads.data || []).filter((x: any) => x.awaiting_me);
  return (
    <div className="space-y-4">
      <PageHeader title={`${t('buyerHome')}${prof.data.profile.business_name ? ` – ${prof.data.profile.business_name}` : ''}`} icon={<ShoppingBasket />}
        subtitle={<span className="flex items-center gap-2">Verification: <StatusBadge status={s.status} /></span>} />
      {!s.can_transact && (
        <Notice tone="warn" title={s.status_text}>
          <ul className="list-disc pl-5">{s.next_steps.map((x: string) => <li key={x}>{x}</li>)}</ul>
          <Link to="/buyer/verification" className="mt-2 inline-block font-semibold underline">Continue verification</Link>
        </Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-4">
        {[['/market', 'Search produce'], ['/buyer/demand', 'Post a requirement'], ['/trade', 'Negotiations & orders'], ['/trade?tab=payments', 'Payments due']].map(([to, label]) => (
          <Link key={to} to={to} className="rounded-2xl border border-gray-200 bg-white p-4 text-center font-semibold hover:border-sky-400">{label}</Link>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title={`Waiting for your reply (${awaiting.length})`}>
          {!awaiting.length ? <p className="text-sm text-gray-500">Nothing waiting.</p> : <ul className="divide-y text-sm">{awaiting.map((x: any) => <li key={x.thread_id}><Link to={`/trade/threads/${x.thread_id}`} className="flex justify-between py-2 hover:bg-gray-50"><span>{x.commodity} · {x.quantity} {x.unit} @ {inr(x.price_per_unit)}</span><StatusBadge status={x.status} /></Link></li>)}</ul>}
        </Section>
        <Section title={`Active orders (${activeOrders.length})`}>
          {!activeOrders.length ? <p className="text-sm text-gray-500">No active orders.</p> : <ul className="divide-y text-sm">{activeOrders.map((o: any) => <li key={o.id}><Link to={`/trade/orders/${o.id}`} className="flex justify-between py-2 hover:bg-gray-50"><span>{o.order_no} · {o.commodity} · {inr(o.buyer_payable)}</span><StatusBadge status={o.status} /></Link></li>)}</ul>}
        </Section>
        <Section title="Payments due">
          {!due.length ? <p className="text-sm text-gray-500">No payments due.</p> : <ul className="divide-y text-sm">{due.map((p: any) => <li key={p.id} className="flex justify-between py-2"><Link className="hover:underline" to={`/trade/orders/${p.order_id}`}>{p.order_no} · {p.kind}</Link><b>{inr(p.amount)}</b></li>)}</ul>}
        </Section>
        <Section title="My requirements">
          {!demand.data?.length ? <p className="text-sm text-gray-500">No requirements posted.</p> : <ul className="divide-y text-sm">{demand.data.map((d: any) => <li key={d.id}><Link to={`/market/demand/${d.id}`} className="flex justify-between py-2 hover:bg-gray-50"><span>{d.commodity} · {d.quantity_committed}/{d.quantity} {d.unit} · {d.responses} response(s)</span><StatusBadge status={d.status} /></Link></li>)}</ul>}
        </Section>
      </div>
    </div>
  );
}

const STEPS = ['Business details', 'Purchasing needs', 'Documents & submit'];

export function BuyerVerificationPage() {
  const toast = useToast();
  const { refresh } = useAuth();
  const crops = useCrops();
  const r = useAsync(() => api.get('/v1/buyer/profile'));
  const [step, setStep] = useState(0);
  const [f, setF] = useState<any>(null);
  const [docType, setDocType] = useState('representative_authorisation');
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<any>(null);
  if (r.loading) return <Skeleton lines={8} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const p = r.data.profile;
  const s = r.data.standing;
  const form = f ?? {
    buyer_type: p.buyer_type, business_name: p.business_name ?? '', contact_email: p.contact_email ?? '', address: p.address ?? '', state: p.state ?? '', district: p.district ?? '', pincode: p.pincode ?? '',
    registration_type: p.registration_type ?? 'individual', gstin: '', pan: '', fssai: '', trade_license: p.trade_license ?? '', operating_locations: (p.operating_locations || []).join(', '),
    commodities: p.commodities || [], varieties: p.varieties ?? '', quality_grades: p.quality_grades ?? '', min_qty: p.min_qty ?? '', max_qty: p.max_qty ?? '', qty_unit: p.qty_unit ?? 'quintal',
    sourcing_regions: (p.sourcing_regions || []).join(', '), delivery_preference: p.delivery_preference ?? 'either', purchase_frequency: p.purchase_frequency ?? 'monthly', storage_packaging_reqs: p.storage_packaging_reqs ?? '',
  };
  const set = (k: string) => (e: any) => setF({ ...form, [k]: e.target.value });
  const locked = s.status === 'under_review';
  const save = async (fields: string[]) => {
    setErr(null);
    const body: any = {};
    for (const k of fields) {
      const v = form[k];
      if (['operating_locations', 'sourcing_regions'].includes(k)) body[k] = String(v || '').split(',').map((x: string) => x.trim()).filter(Boolean);
      else if (['min_qty', 'max_qty'].includes(k)) body[k] = v === '' ? null : Number(v);
      else if (['gstin', 'pan', 'fssai'].includes(k)) { if (v) body[k] = v; }
      else body[k] = v === '' ? null : v;
    }
    try { await api.patch('/v1/buyer/profile', body); await r.reload(); toast('Saved'); return true; } catch (e) { setErr(e); return false; }
  };
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Business verification" icon={<BadgeCheck />} subtitle={<span className="flex items-center gap-2"><StatusBadge status={s.status} /> {s.status_text}</span>} />
      <Section title="What happens next">
        <ul className="space-y-1 text-sm">{s.next_steps.length ? s.next_steps.map((x: string) => <li key={x}>• {x}</li>) : <li>✓ You are verified and can make offers.</li>}</ul>
        <p className="mt-2 text-xs text-gray-500">Unverified buyers can browse produce. Making offers, posting requirements and seeing farmer phone numbers (after an order is confirmed) need verification. Uploading documents alone does not verify you – a reviewer checks them.</p>
      </Section>
      {locked ? <Notice>Your application is under review. Business details are locked until a decision is made.</Notice> : (
        <>
          <div className="flex gap-2">{STEPS.map((name, i) => <button key={name} onClick={() => setStep(i)} className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium ${step === i ? 'bg-sky-700 text-white' : 'bg-gray-100 text-gray-700'}`}>{i + 2}. {name}</button>)}</div>
          {step === 0 && (
            <Section>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Business / organisation name" required>{(id) => <Input id={id} value={form.business_name} onChange={set('business_name')} />}</Field>
                <Field label="Buyer type">{(id) => <Select id={id} value={form.buyer_type} onChange={set('buyer_type')} options={['trader', 'wholesaler', 'retailer', 'processor', 'exporter', 'institutional', 'cooperative', 'other'].map((v) => ({ value: v, label: v }))} />}</Field>
                <Field label="Registration type">{(id) => <Select id={id} value={form.registration_type} onChange={set('registration_type')} options={['individual', 'proprietorship', 'partnership', 'llp', 'company', 'cooperative', 'fpo', 'other'].map((v) => ({ value: v, label: v }))} />}</Field>
                <Field label="Business email">{(id) => <Input id={id} type="email" value={form.contact_email} onChange={set('contact_email')} />}</Field>
                <div className="sm:col-span-2"><Field label="Operating address" required>{(id) => <Input id={id} value={form.address} onChange={set('address')} />}</Field></div>
                <Field label="State" required>{(id) => <Select id={id} value={form.state} onChange={set('state')} options={INDIAN_STATES} placeholder="Select" />}</Field>
                <Field label="District" required>{(id) => <Input id={id} value={form.district} onChange={set('district')} />}</Field>
                <Field label="PIN code">{(id) => <Input id={id} inputMode="numeric" maxLength={6} value={form.pincode} onChange={set('pincode')} />}</Field>
                <Field label="Other operating locations" hint="Comma separated">{(id) => <Input id={id} value={form.operating_locations} onChange={set('operating_locations')} />}</Field>
                <Field label={`GSTIN${p.gstin_masked ? ` (on file: ${p.gstin_masked})` : ''}`} hint="Required for registered businesses and large purchases">{(id) => <Input id={id} value={form.gstin} onChange={set('gstin')} placeholder="15 characters" />}</Field>
                <Field label={`PAN${p.pan_masked ? ` (on file: ${p.pan_masked})` : ''}`}>{(id) => <Input id={id} value={form.pan} onChange={set('pan')} placeholder="ABCDE1234F" />}</Field>
                <Field label={`FSSAI licence/registration${p.fssai_masked ? ` (on file: ${p.fssai_masked})` : ''}`} hint="For food businesses">{(id) => <Input id={id} value={form.fssai} onChange={set('fssai')} placeholder="14 digits" />}</Field>
                <Field label="Trade / mandi licence (if applicable)">{(id) => <Input id={id} value={form.trade_license} onChange={set('trade_license')} />}</Field>
              </div>
              {err && <div className="mt-3"><ErrorBox error={err} /></div>}
              <div className="mt-4 flex justify-end"><Button onClick={async () => { if (await save(['business_name', 'buyer_type', 'registration_type', 'contact_email', 'address', 'state', 'district', 'pincode', 'operating_locations', 'gstin', 'pan', 'fssai', 'trade_license'])) setStep(1); }}>Save & continue</Button></div>
            </Section>
          )}
          {step === 1 && (
            <Section>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Crops you buy">{(id) => <select id={id} multiple className="h-32 w-full rounded-lg border p-2" value={form.commodities} onChange={(e) => setF({ ...form, commodities: Array.from(e.target.selectedOptions).map((o) => o.value) })}>{crops.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}</select>}</Field>
                <div className="space-y-3">
                  <Field label="Varieties">{(id) => <Input id={id} value={form.varieties} onChange={set('varieties')} />}</Field>
                  <Field label="Quality grades expected">{(id) => <Input id={id} value={form.quality_grades} onChange={set('quality_grades')} />}</Field>
                </div>
                <Field label="Minimum per purchase">{(id) => <Input id={id} type="number" min="0" value={form.min_qty} onChange={set('min_qty')} />}</Field>
                <Field label="Maximum per purchase">{(id) => <Input id={id} type="number" min="0" value={form.max_qty} onChange={set('max_qty')} />}</Field>
                <Field label="Unit">{(id) => <Select id={id} value={form.qty_unit} onChange={set('qty_unit')} options={['kg', 'quintal', 'tonne'].map((u) => ({ value: u, label: u }))} />}</Field>
                <Field label="Sourcing regions" hint="Comma separated states/districts">{(id) => <Input id={id} value={form.sourcing_regions} onChange={set('sourcing_regions')} />}</Field>
                <Field label="Delivery or pickup">{(id) => <Select id={id} value={form.delivery_preference} onChange={set('delivery_preference')} options={[{ value: 'pickup', label: 'I pick up' }, { value: 'delivery', label: 'Delivered to me' }, { value: 'either', label: 'Either' }]} />}</Field>
                <Field label="How often">{(id) => <Select id={id} value={form.purchase_frequency} onChange={set('purchase_frequency')} options={['one_time', 'weekly', 'monthly', 'seasonal'].map((v) => ({ value: v, label: v.replace('_', ' ') }))} />}</Field>
                <div className="sm:col-span-2"><Field label="Storage & packaging requirements">{(id) => <Textarea id={id} value={form.storage_packaging_reqs} onChange={set('storage_packaging_reqs')} />}</Field></div>
              </div>
              {err && <div className="mt-3"><ErrorBox error={err} /></div>}
              <div className="mt-4 flex justify-between"><Button variant="outline" onClick={() => setStep(0)}>Back</Button><Button onClick={async () => { if (await save(['commodities', 'varieties', 'quality_grades', 'min_qty', 'max_qty', 'qty_unit', 'sourcing_regions', 'delivery_preference', 'purchase_frequency', 'storage_packaging_reqs'])) setStep(2); }}>Save & continue</Button></div>
            </Section>
          )}
          {step === 2 && (
            <Section title="Required for your business type">
              <ul className="space-y-2 text-sm">
                {s.required_documents.map((d: any) => (
                  <li key={d.field} className="flex items-start gap-2">{d.provided ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <Circle className="h-5 w-5 text-gray-400" />}<span><b>{d.label}</b><span className="block text-xs text-gray-500">{d.why}</span></span></li>
                ))}
              </ul>
              <form className="mt-4 flex flex-wrap items-center gap-2" onSubmit={async (e) => {
                e.preventDefault(); if (!file) return;
                const fd = new FormData(); fd.append('doc_type', docType); fd.append('file', file);
                try { await api.post('/v1/buyer/documents', fd); setFile(null); toast('Document uploaded (stored privately)'); r.reload(); } catch (er: any) { toast(er.message, 'error'); }
              }}>
                <Select aria-label="Document type" className="w-64" value={docType} onChange={(e) => setDocType(e.target.value)} options={[
                  { value: 'representative_authorisation', label: 'Representative ID / authorisation' }, { value: 'registration_certificate', label: 'Business registration certificate' },
                  { value: 'gst_certificate', label: 'GST certificate' }, { value: 'pan_card', label: 'PAN card' }, { value: 'fssai_licence', label: 'FSSAI licence' }, { value: 'trade_licence', label: 'Trade licence' },
                  { value: 'bank_proof', label: 'Bank account proof' }, { value: 'other', label: 'Other' },
                ]} />
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Document file" className="text-sm" />
                <Button type="submit" size="sm" disabled={!file}>Upload</Button>
              </form>
              {r.data.documents.length > 0 && <ul className="mt-3 space-y-1 text-sm">{r.data.documents.map((d: any) => <li key={d.id} className="flex items-center gap-3"><DocLink id={d.id} label={`${d.doc_type.replace(/_/g, ' ')} · ${fmtDate(d.created_at)}`} /><button className="text-xs text-red-700 underline" onClick={async () => { await api.del(`/v1/documents/${d.id}`); r.reload(); }}>Remove</button></li>)}</ul>}
              <label className="mt-4 flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm">
                <input type="checkbox" className="mt-1 h-5 w-5" checked={!!p.terms_accepted_at} disabled={!!p.terms_accepted_at} onChange={async () => { await api.post('/v1/buyer/accept-terms'); r.reload(); }} />
                <span>I accept the marketplace transaction and dispute rules: offers I accept are binding once both sides confirm; I pay as agreed; quality disputes go through FARMDirect's dispute process; I will not ask farmers to pay or share codes outside the app.</span>
              </label>
              {err && <div className="mt-3"><ErrorBox error={err} /></div>}
              <div className="mt-4 flex justify-between"><Button variant="outline" onClick={() => setStep(1)}>Back</Button>
                <Button disabled={!s.ready_to_submit} onClick={async () => { try { await api.post('/v1/buyer/submit'); toast('Submitted for review'); await refresh(); r.reload(); } catch (e) { setErr(e); } }}>Submit for review</Button></div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

export function BuyerDemandPage() {
  const toast = useToast();
  const { user } = useAuth();
  const r = useAsync(() => api.get('/v1/marketplace/demand/mine').then((x) => x.demand));
  const [tab, setTab] = useState<'list' | 'new'>('list');
  const [f, setF] = useState<any>({ crop_id: '', commodity: '', variety: '', quantity: '', unit: 'quintal', quality_spec: '', price_min: '', price_max: '', delivery_location: '', district: '', state: user?.state ?? '', delivery_date: '', packaging: '', frequency: 'one_time', payment_terms: 'on_delivery', allow_aggregation: true, expires_days: 30 });
  const crops = useCrops();
  const [err, setErr] = useState<any>(null);
  return (
    <div className="space-y-4">
      <PageHeader title="My requirements" icon={<ClipboardList />} subtitle="Tell farmers what you want to buy. Several farmers or an FPO can fill one requirement together." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'list', label: 'Posted' }, { id: 'new', label: 'Post a requirement' }]} />
      {tab === 'list' ? (r.loading ? <Skeleton /> : !r.data?.length ? <Empty title="No requirements yet" /> : (
        <Section><ul className="divide-y text-sm">{r.data.map((d: any) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <Link to={`/market/demand/${d.id}`} className="hover:underline"><b>{d.commodity}</b> · {d.quantity_committed}/{d.quantity} {d.unit} · {d.responses} response(s)<span className="block text-xs text-gray-500">Expires {fmtDate(d.expires_at)}</span></Link>
            <span className="flex items-center gap-2"><StatusBadge status={d.status} />{['open', 'partially_filled'].includes(d.status) && <button className="text-xs text-red-700 underline" onClick={async () => { await api.post(`/v1/marketplace/demand/${d.id}/close`); r.reload(); }}>Close</button>}</span>
          </li>))}</ul></Section>
      )) : (
        <Section>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault(); setErr(null);
            const num = (v: any) => (v === '' ? null : Number(v));
            try {
              await api.post('/v1/marketplace/demand', { ...f, commodity: f.commodity || crops.find((c) => c.id === f.crop_id)?.name, crop_id: f.crop_id || null, quantity: Number(f.quantity), price_min: num(f.price_min), price_max: num(f.price_max), delivery_date: f.delivery_date || null, expires_days: Number(f.expires_days) });
              toast('Requirement posted'); setTab('list'); r.reload();
            } catch (er) { setErr(er); }
          }}>
            <Field label="Crop" required>{(id) => <CropSelect id={id} value={f.crop_id} onChange={(v) => setF({ ...f, crop_id: v, commodity: crops.find((c) => c.id === v)?.name ?? '' })} />}</Field>
            <Field label="Variety">{(id) => <Input id={id} value={f.variety} onChange={(e) => setF({ ...f, variety: e.target.value })} />}</Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Quantity" required>{(id) => <Input id={id} type="number" min="0" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} required />}</Field><Field label="Unit">{(id) => <Select id={id} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} options={['kg', 'quintal', 'tonne'].map((u) => ({ value: u, label: u }))} />}</Field></div>
            <div className="grid grid-cols-2 gap-2"><Field label="Min price/unit">{(id) => <Input id={id} type="number" min="0" value={f.price_min} onChange={(e) => setF({ ...f, price_min: e.target.value })} />}</Field><Field label="Max price/unit">{(id) => <Input id={id} type="number" min="0" value={f.price_max} onChange={(e) => setF({ ...f, price_max: e.target.value })} />}</Field></div>
            <div className="sm:col-span-2"><Field label="Quality specification">{(id) => <Textarea id={id} value={f.quality_spec} onChange={(e) => setF({ ...f, quality_spec: e.target.value })} placeholder="Moisture, grade, size…" />}</Field></div>
            <Field label="Delivery location">{(id) => <Input id={id} value={f.delivery_location} onChange={(e) => setF({ ...f, delivery_location: e.target.value })} />}</Field>
            <Field label="State">{(id) => <Select id={id} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} options={INDIAN_STATES} placeholder="Any" />}</Field>
            <Field label="District">{(id) => <Input id={id} value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} />}</Field>
            <Field label="Needed by">{(id) => <Input id={id} type="date" value={f.delivery_date} onChange={(e) => setF({ ...f, delivery_date: e.target.value })} />}</Field>
            <Field label="Packaging">{(id) => <Input id={id} value={f.packaging} onChange={(e) => setF({ ...f, packaging: e.target.value })} />}</Field>
            <Field label="Frequency">{(id) => <Select id={id} value={f.frequency} onChange={(e) => setF({ ...f, frequency: e.target.value })} options={['one_time', 'weekly', 'monthly', 'seasonal'].map((v) => ({ value: v, label: v.replace('_', ' ') }))} />}</Field>
            <Field label="Payment terms">{(id) => <Select id={id} value={f.payment_terms} onChange={(e) => setF({ ...f, payment_terms: e.target.value })} options={[{ value: 'on_delivery', label: 'On delivery' }, { value: 'advance_and_balance', label: 'Advance + balance' }, { value: 'within_days', label: 'Within days of delivery' }]} />}</Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.allow_aggregation} onChange={(e) => setF({ ...f, allow_aggregation: e.target.checked })} />Accept supply from several farmers</label>
            {err && <div className="sm:col-span-2"><ErrorBox error={err} /></div>}
            <div className="flex justify-end sm:col-span-2"><Button type="submit">Post requirement</Button></div>
          </form>
        </Section>
      )}
    </div>
  );
}

export function AccountVerificationPage() {
  const toast = useToast();
  const { user } = useAuth();
  const v = useAsync(() => api.get('/v1/verification/mine'));
  const tr = useAsync(() => api.get('/v1/trust/restrictions'));
  const [docType, setDocType] = useState('voter_id');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [appeal, setAppeal] = useState<{ type: string; id: string } | null>(null);
  const [statement, setStatement] = useState('');
  if (v.loading) return <Skeleton lines={6} />;
  if (v.error) return <ErrorBox error={v.error} />;
  const st = v.data.farmer_standing;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Account & verification" icon={<BadgeCheck />} />
      {st && (
        <Section title="Your verification level">
          <ol className="space-y-2">{st.levels.map((l: any) => <li key={l.level} className="flex items-center gap-2 text-base">{l.done ? <CheckCircle2 className="h-6 w-6 text-emerald-600" /> : <Circle className="h-6 w-6 text-gray-300" />}Level {l.level}: {l.name}</li>)}</ol>
          <p className="mt-2 text-sm">{st.transaction_eligible ? '✓ You can sell on the marketplace.' : st.next_step}{st.max_order_value_inr ? ` Per-order limit until identity is verified: ${inr(st.max_order_value_inr)}.` : ''}</p>
          {st.missing_profile_fields.length > 0 && <Link to="/settings" className="text-sm text-emerald-700 underline">Add {st.missing_profile_fields.join(', ')} in Settings</Link>}
          {st.level === 2 && !st.identity_application?.status?.match(/submitted|under_review/) && (
            <form className="mt-4 space-y-2 rounded-xl border p-3" onSubmit={async (e) => {
              e.preventDefault(); if (!file) return;
              const fd = new FormData(); fd.append('doc_type', docType); fd.append('consent', String(consent)); fd.append('file', file);
              try { await api.post('/v1/verification/farmer-identity', fd); toast('Submitted for review'); v.reload(); } catch (er: any) { toast(er.message, 'error'); }
            }}>
              <p className="font-semibold">Optional: verify your identity</p>
              <p className="text-xs text-gray-600">Removes the per-order limit. Any government photo ID works. Aadhaar is not required; if you use it, upload a masked Aadhaar (only last 4 digits visible). The file is stored privately and seen only by our verification team.</p>
              <Select aria-label="ID type" value={docType} onChange={(e) => setDocType(e.target.value)} options={[{ value: 'voter_id', label: 'Voter ID' }, { value: 'pan_card', label: 'PAN card' }, { value: 'driving_licence', label: 'Driving licence' }, { value: 'ration_card', label: 'Ration card' }, { value: 'kisan_credit_card', label: 'Kisan Credit Card' }, { value: 'masked_aadhaar', label: 'Masked Aadhaar' }, { value: 'other_government_id', label: 'Other government ID' }]} />
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="ID document" />
              <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />I consent to FARMDirect using this document only to verify my identity.</label>
              <Button type="submit" size="sm" disabled={!file || !consent}>Submit</Button>
            </form>
          )}
        </Section>
      )}
      {user?.role === 'buyer' && <Notice>Buyer business verification is on the <Link to="/buyer/verification" className="underline">verification page</Link>.</Notice>}
      <Section title="Applications">
        {!v.data.applications.length ? <p className="text-sm text-gray-500">None yet.</p> : (
          <ul className="space-y-3 text-sm">{v.data.applications.map((a: any) => (
            <li key={a.id} className="rounded-lg border p-2">
              <div className="flex justify-between"><span>{a.kind.replace(/_/g, ' ')} · {fmtDate(a.submitted_at)}</span><StatusBadge status={a.status} /></div>
              {a.decision_reason && <p className="text-gray-600">Reviewer: {a.decision_reason}</p>}
              {a.status === 'rejected' && <button className="text-xs text-emerald-700 underline" onClick={() => setAppeal({ type: 'verification', id: a.id })}>Appeal this decision</button>}
            </li>))}</ul>
        )}
      </Section>
      <Section title="Restrictions & appeals">
        {!tr.data?.restrictions?.length ? <p className="text-sm text-gray-500">No restrictions on your account.</p> : (
          <ul className="space-y-2 text-sm">{tr.data.restrictions.map((x: any) => (
            <li key={x.id} className="rounded-lg border p-2"><b>{x.kind.replace('_', ' ')}</b> – {x.reason} · {fmtDate(x.created_at)} {x.lifted_at ? <span className="text-emerald-700">(lifted {fmtDate(x.lifted_at)})</span> : <button className="ml-2 text-xs text-emerald-700 underline" onClick={() => setAppeal({ type: 'restriction', id: x.id })}>Appeal</button>}</li>
          ))}</ul>
        )}
        {tr.data?.appeals?.length > 0 && <ul className="mt-3 space-y-1 text-sm">{tr.data.appeals.map((a: any) => <li key={a.id}>Appeal {fmtDate(a.created_at)}: <StatusBadge status={a.status === 'upheld' ? 'approved' : a.status === 'denied' ? 'rejected' : 'open'} /> {a.decision_note}</li>)}</ul>}
        {appeal && (
          <form className="mt-3 space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            try { await api.post('/v1/trust/appeals', { subject_type: appeal.type, subject_id: appeal.id, statement }); toast('Appeal submitted. A different reviewer will decide.'); setAppeal(null); setStatement(''); tr.reload(); }
            catch (er: any) { toast(er.message, 'error'); }
          }}>
            <Textarea aria-label="Appeal statement" value={statement} onChange={(e) => setStatement(e.target.value)} required placeholder="Explain why the decision should change" />
            <Button type="submit" size="sm">Submit appeal</Button>
          </form>
        )}
      </Section>
    </div>
  );
}

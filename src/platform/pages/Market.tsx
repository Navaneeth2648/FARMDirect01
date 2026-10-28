import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Flag, MapPin, Search, ShoppingBasket } from 'lucide-react';
import { api, fmtDate, inr, qs } from '../api';
import { useAuth } from '../auth';
import { Badge, Button, Empty, ErrorBox, Field, Input, INDIAN_STATES, LineChart, Modal, Notice, PageHeader, Section, Select, Skeleton, SourceNote, Spinner, Tabs, Textarea, useAsync, useToast } from '../ui';
import { CropSelect, useCrops } from '../shared';
import { Breakdown, PrivateImage, StatusBadge, VerifiedSeller } from '../trade-ui';
import { InspectionCard } from './Grading';

export function ReportButton({ type, id: targetId }: { type: string; id: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('misleading_quality');
  const [details, setDetails] = useState('');
  return (
    <>
      <button className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-700" onClick={() => setOpen(true)}><Flag className="h-3 w-3" />Report</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Report a problem">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          try { await api.post('/v1/trust/reports', { target_type: type, target_id: targetId, reason, details }); toast('Thank you. Our team will review it.'); setOpen(false); }
          catch (er: any) { toast(er.message, 'error'); }
        }}>
          <Select aria-label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} options={[
            { value: 'fake_listing', label: 'Fake listing' }, { value: 'misleading_quality', label: 'Misleading quality or photos' }, { value: 'impersonation', label: 'Pretending to be someone else' },
            { value: 'payment_fraud', label: 'Payment fraud / asks for money outside the app' }, { value: 'fake_facility', label: 'Facility does not exist' }, { value: 'other', label: 'Other' },
          ]} />
          <Textarea aria-label="Details" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What happened?" />
          <div className="flex justify-end"><Button type="submit">Send report</Button></div>
        </form>
      </Modal>
    </>
  );
}

function Browse() {
  const { user } = useAuth();
  const [f, setF] = useState({ crop_id: '', state: '', grade: '', min_qty: '', price_max: '', partial: false, verified: false, sort: 'newest' });
  const [geo, setGeo] = useState<{ lat: number; lon: number } | null>(user?.latitude != null ? { lat: user.latitude!, lon: user.longitude! } : null);
  const [query, setQuery] = useState(f);
  const r = useAsync(() => api.get(`/v1/marketplace/lots${qs({ ...query, partial: query.partial ? '1' : '', verified: query.verified ? '1' : '', lat: geo?.lat, lon: geo?.lon })}`), [query, geo]);
  return (
    <div className="space-y-4">
      <Section>
        <form className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6" onSubmit={(e) => { e.preventDefault(); setQuery(f); }}>
          <CropSelect value={f.crop_id} onChange={(v) => setF({ ...f, crop_id: v })} />
          <Select aria-label="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} options={INDIAN_STATES} placeholder="Any state" />
          <Input aria-label="Grade" placeholder="Grade" value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} />
          <Input aria-label="Minimum quantity" type="number" placeholder="Min quantity" value={f.min_qty} onChange={(e) => setF({ ...f, min_qty: e.target.value })} />
          <Input aria-label="Maximum price" type="number" placeholder="Max price/unit" value={f.price_max} onChange={(e) => setF({ ...f, price_max: e.target.value })} />
          <Select aria-label="Sort" value={f.sort} onChange={(e) => setF({ ...f, sort: e.target.value })} options={[{ value: 'newest', label: 'Newest' }, { value: 'price', label: 'Lowest price' }, { value: 'distance', label: 'Nearest' }]} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.partial} onChange={(e) => setF({ ...f, partial: e.target.checked })} />Partial orders OK</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.verified} onChange={(e) => setF({ ...f, verified: e.target.checked })} />ID-verified sellers</label>
          <Button type="button" variant="outline" size="sm" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setGeo({ lat: p.coords.latitude, lon: p.coords.longitude }))}><MapPin className="mr-1 h-4 w-4" />{geo ? 'Location set' : 'Use my location'}</Button>
          <Button type="submit" size="sm"><Search className="mr-1 h-4 w-4" />Search</Button>
        </form>
      </Section>
      {r.loading ? <Skeleton lines={6} /> : r.error ? <ErrorBox error={r.error} /> : r.data.lots.length === 0 ? <Empty title="No produce matches">Try fewer filters, or post a requirement so farmers can come to you.</Empty> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.data.lots.map((l: any) => (
            <Link key={l.id} to={`/market/lots/${l.id}`} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 hover:border-emerald-400">
              {l.photos[0] && <PrivateImage id={l.photos[0]} alt={l.commodity} className="mb-2 h-32 w-full rounded-lg object-cover" />}
              <div className="flex items-start justify-between gap-2"><p className="text-lg font-semibold">{l.commodity}</p><VerifiedSeller level={l.seller.level} /></div>
              {l.variety && <p className="text-sm text-gray-600">{l.variety}{l.quality.grade && ` · Grade ${l.quality.grade}`}</p>}
              <p className="mt-1 text-base">{l.quantity_available} {l.unit} · <b>{l.price_per_unit != null ? `${inr(l.price_per_unit)}/${l.unit}` : 'Make an offer'}</b></p>
              <p className="text-xs text-gray-500">{[l.location.village, l.location.district, l.location.state].filter(Boolean).join(', ')}{l.transport && ` · ~${l.transport.distance_km} km`}</p>
              <div className="mt-2 flex flex-wrap gap-1">{l.negotiable && <Badge>Negotiable</Badge>}{l.allow_partial ? <Badge tone="blue">Partial OK</Badge> : <Badge tone="amber">Full lot only</Badge>}{l.harvest_date && <Badge>Harvest {fmtDate(l.harvest_date)}</Badge>}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function DemandBoard() {
  const { user } = useAuth();
  const r = useAsync(() => api.get('/v1/marketplace/demand'));
  if (r.loading) return <Skeleton lines={5} />;
  if (r.error) return <ErrorBox error={r.error} />;
  return (
    <Section title="What verified buyers are looking for" description={user?.role === 'farmer' ? 'Respond with one of your lots. Several farmers can fill one requirement together.' : undefined}>
      {r.data.demand.length === 0 ? <Empty title="No open requirements right now" /> : (
        <ul className="divide-y">
          {r.data.demand.map((d: any) => (
            <li key={d.id}>
              <Link to={`/market/demand/${d.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-gray-50">
                <div>
                  <p className="font-semibold">{d.commodity}{d.variety && ` · ${d.variety}`} – {d.remaining} {d.unit} needed</p>
                  <p className="text-sm text-gray-600">{d.business_name} · {[d.district, d.state].filter(Boolean).join(', ') || 'Any location'}{d.delivery_date && ` · by ${fmtDate(d.delivery_date)}`}</p>
                </div>
                <div className="text-right"><p className="font-semibold">{d.price_max ? `up to ${inr(d.price_max)}/${d.unit}` : 'Price open'}</p><Badge tone="green">Verified buyer</Badge></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Prices({ initialCrop }: { initialCrop?: string }) {
  const { user } = useAuth();
  const [crop, setCrop] = useState(initialCrop || '');
  const [state, setState] = useState(user?.state || '');
  const r = useAsync(() => (crop ? api.get(`/v1/marketplace/prices${qs({ crop_id: crop, state })}`) : Promise.resolve(null)), [crop, state]);
  const stat = (title: string, s: any, tone: string) => (
    <div className={`rounded-xl border p-3 ${tone}`}>
      <p className="text-sm font-semibold">{title}</p>
      {s.count ? <p className="text-xl font-bold">{inr(s.avg)} <span className="text-sm font-normal">avg/qtl</span></p> : <p className="text-sm text-gray-500">No data</p>}
      {s.count > 0 && <p className="text-xs text-gray-600">{inr(s.min)} – {inr(s.max)} · {s.count} record(s)</p>}
      <p className="mt-1 text-xs text-gray-500">{s.source}</p>
    </div>
  );
  return (
    <div className="space-y-4">
      <Section><div className="grid gap-2 sm:grid-cols-2"><CropSelect value={crop} onChange={setCrop} /><Select aria-label="State" value={state} onChange={(e) => setState(e.target.value)} options={INDIAN_STATES} placeholder="All states" /></div></Section>
      {!crop ? <Empty title="Choose a crop to compare prices" /> : r.loading ? <Skeleton /> : r.error ? <ErrorBox error={r.error} /> : r.data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {stat('Buyer bids (open)', r.data.buyer_bids, 'border-sky-200 bg-sky-50')}
            {stat('Completed sales (90 days)', r.data.completed_sales, 'border-emerald-200 bg-emerald-50')}
            {stat('Farmer asking prices', r.data.marketplace_asking, 'border-gray-200 bg-white')}
          </div>
          <Section title="Official mandi prices" description={r.data.official_mandi.source}>
            {r.data.official_mandi.records.length === 0 ? <p className="text-sm text-gray-600">No stored official prices for this crop{state ? ` in ${state}` : ''}. Open Mandi Prices to fetch them (needs the data.gov.in key).</p> : (
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-gray-500"><tr><th className="p-1">Mandi</th><th className="p-1">Date</th><th className="p-1 text-right">Min</th><th className="p-1 text-right">Modal</th><th className="p-1 text-right">Max</th></tr></thead>
                <tbody>{r.data.official_mandi.records.map((m: any, i: number) => <tr key={i} className="border-t"><td className="p-1">{m.market}<span className="block text-xs text-gray-500">{m.district}</span></td><td className="p-1">{fmtDate(m.arrival_date)}</td><td className="p-1 text-right">{inr(m.min_price)}</td><td className="p-1 text-right font-semibold">{inr(m.modal_price)}</td><td className="p-1 text-right">{inr(m.max_price)}</td></tr>)}</tbody>
              </table>
            )}
            {r.data.history.length > 1 && <div className="mt-3"><LineChart series={[{ name: 'Modal', color: '#059669', points: r.data.history.map((h: any) => ({ x: h.date.slice(5), y: h.modal })) }]} /></div>}
            <SourceNote updated={r.data.official_mandi.last_fetched} note="Official prices are past arrivals, not live. Marketplace bids and asks are not completed sales." />
          </Section>
        </>
      )}
    </div>
  );
}

export function MarketPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as 'browse' | 'demand' | 'prices') || 'browse';
  return (
    <div>
      <PageHeader title="Market" icon={<ShoppingBasket />} subtitle="Produce from farmers, requirements from verified buyers, and price comparisons"
        actions={user?.role === 'buyer' ? <Link to="/buyer/demand"><Button>Post a requirement</Button></Link> : user?.role === 'farmer' ? <Link to="/sell/new"><Button>Sell my crop</Button></Link> : undefined} />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[{ id: 'browse', label: 'Available produce' }, { id: 'demand', label: 'Buyer requirements' }, { id: 'prices', label: 'Compare prices' }]} />
      {tab === 'browse' && <Browse />}
      {tab === 'demand' && <DemandBoard />}
      {tab === 'prices' && <Prices initialCrop={params.get('crop') ?? undefined} />}
    </div>
  );
}

export function OfferForm({ unit, maxQty, initial, onSubmit, submitLabel = 'Send offer', minQty, fullLotOnly }: {
  unit: string; maxQty: number; initial?: any; onSubmit: (body: any) => Promise<void>; submitLabel?: string; minQty?: number | null; fullLotOnly?: boolean;
}) {
  const [f, setF] = useState<any>(initial ?? { quantity: fullLotOnly ? maxQty : '', price_per_unit: '', delivery_mode: 'buyer_pickup', payment_terms: 'on_delivery', advance_pct: '', payment_due_days: '', note: '', charges: [] });
  const [preview, setPreview] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const body = () => ({
    quantity: Number(f.quantity), price_per_unit: Number(f.price_per_unit), delivery_mode: f.delivery_mode, payment_terms: f.payment_terms,
    advance_pct: f.advance_pct ? Number(f.advance_pct) : null, payment_due_days: f.payment_due_days ? Number(f.payment_due_days) : null,
    note: f.note || null, charges: f.charges.filter((c: any) => c.label && c.amount !== '').map((c: any) => ({ ...c, amount: Number(c.amount) })),
  });
  const refresh = async () => { if (Number(f.quantity) > 0 && f.price_per_unit !== '') setPreview(await api.post('/v1/offers/preview', body()).catch(() => null)); };
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setErr(null); try { await onSubmit(body()); } catch (er) { setErr(er); } finally { setBusy(false); } };
  return (
    <form onSubmit={submit} onBlur={refresh} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={`Quantity (${unit})`} hint={fullLotOnly ? 'Full lot only' : `Up to ${maxQty}${minQty ? `, minimum ${minQty}` : ''}`}>{(id) => <Input id={id} type="number" min="0" step="0.01" max={maxQty} value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} required disabled={fullLotOnly} />}</Field>
        <Field label={`Price per ${unit} (₹)`}>{(id) => <Input id={id} type="number" min="0" value={f.price_per_unit} onChange={(e) => setF({ ...f, price_per_unit: e.target.value })} required />}</Field>
        <Field label="Delivery">{(id) => <Select id={id} value={f.delivery_mode} onChange={(e) => setF({ ...f, delivery_mode: e.target.value })} options={[{ value: 'buyer_pickup', label: 'Buyer picks up' }, { value: 'farmer_delivery', label: 'Farmer delivers' }, { value: 'arranged_transport', label: 'Arrange transport here' }, { value: 'from_storage', label: 'Collect from storage' }]} />}</Field>
        <Field label="Payment terms">{(id) => <Select id={id} value={f.payment_terms} onChange={(e) => setF({ ...f, payment_terms: e.target.value })} options={[{ value: 'on_delivery', label: 'Full on delivery' }, { value: 'advance_and_balance', label: 'Advance + balance on delivery' }, { value: 'within_days', label: 'Within N days of delivery' }]} />}</Field>
        {f.payment_terms === 'advance_and_balance' && <Field label="Advance %">{(id) => <Input id={id} type="number" min="1" max="100" value={f.advance_pct} onChange={(e) => setF({ ...f, advance_pct: e.target.value })} required />}</Field>}
        {f.payment_terms === 'within_days' && <Field label="Days after delivery">{(id) => <Input id={id} type="number" min="1" max="90" value={f.payment_due_days} onChange={(e) => setF({ ...f, payment_due_days: e.target.value })} required />}</Field>}
      </div>
      <div>
        <p className="text-sm font-medium">Other charges (packaging, loading…)</p>
        {f.charges.map((c: any, i: number) => (
          <div key={i} className="mt-1 grid grid-cols-4 gap-1">
            <Input aria-label="Charge" placeholder="Label" value={c.label} onChange={(e) => { const ch = [...f.charges]; ch[i] = { ...c, label: e.target.value }; setF({ ...f, charges: ch }); }} />
            <Input aria-label="Amount" type="number" placeholder="₹" value={c.amount} onChange={(e) => { const ch = [...f.charges]; ch[i] = { ...c, amount: e.target.value }; setF({ ...f, charges: ch }); }} />
            <Select aria-label="Who pays" value={c.payer} onChange={(e) => { const ch = [...f.charges]; ch[i] = { ...c, payer: e.target.value }; setF({ ...f, charges: ch }); }} options={[{ value: 'buyer', label: 'Buyer pays' }, { value: 'farmer', label: 'Farmer pays' }]} />
            <Select aria-label="Type" value={c.kind} onChange={(e) => { const ch = [...f.charges]; ch[i] = { ...c, kind: e.target.value }; setF({ ...f, charges: ch }); }} options={['packaging', 'transport', 'handling', 'storage', 'other'].map((k) => ({ value: k, label: k }))} />
          </div>
        ))}
        {f.charges.length < 5 && <button type="button" className="mt-1 text-sm text-emerald-700 underline" onClick={() => setF({ ...f, charges: [...f.charges, { label: '', amount: '', payer: 'buyer', kind: 'packaging' }] })}>+ Add charge</button>}
      </div>
      <Field label="Message (optional)">{(id) => <Textarea id={id} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />}</Field>
      {preview && <Breakdown b={preview} unit={`${f.quantity} ${unit} × ${inr(Number(f.price_per_unit))}`} />}
      {err && <ErrorBox error={err} />}
      <Button type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : submitLabel}</Button>
    </form>
  );
}

export function LotDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const r = useAsync(() => api.get(`/v1/marketplace/lots/${id}${user?.latitude != null ? qs({ lat: user.latitude, lon: user.longitude }) : ''}`), [id]);
  if (r.loading) return <Skeleton lines={8} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const { lot: l, buyer_standing: bs, my_thread } = r.data;
  if (r.data.is_owner) return <Navigate to={`/sell/${l.id}`} replace />;
  return (
    <div className="space-y-4">
      <PageHeader title={`${l.commodity}${l.variety ? ` · ${l.variety}` : ''}`} icon={<ShoppingBasket />} subtitle={<span className="flex items-center gap-2"><StatusBadge status={l.status} /><VerifiedSeller level={l.seller.level} /> Seller: {l.seller.first_name}</span>} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Section className="lg:col-span-3">
          {l.photos.length > 0 && <div className="mb-3 grid grid-cols-3 gap-2">{l.photos.map((p: string) => <PrivateImage key={p} id={p} alt={l.commodity} className="h-28 w-full rounded-lg object-cover" />)}</div>}
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Available</dt><dd className="font-semibold">{l.quantity_available} {l.unit}</dd>
            <dt className="text-gray-500">Asking price</dt><dd className="font-semibold">{l.price_per_unit != null ? `${inr(l.price_per_unit)}/${l.unit}` : 'Open to offers'}{l.negotiable && ' (negotiable)'}</dd>
            <dt className="text-gray-500">Partial orders</dt><dd>{l.allow_partial ? `Yes${l.min_order_qty ? `, min ${l.min_order_qty} ${l.unit}` : ''}` : 'Full lot only'}</dd>
            <dt className="text-gray-500">Harvest</dt><dd>{fmtDate(l.harvest_date)}</dd>
            <dt className="text-gray-500">Pickup area</dt><dd>{[l.location.village, l.location.district, l.location.state].filter(Boolean).join(', ')}</dd>
            {l.transport && <><dt className="text-gray-500">Distance</dt><dd>~{l.transport.distance_km} km{l.transport.estimate_per_qtl ? ` · est. ${inr(l.transport.estimate_per_qtl)}/qtl` : ''} <span className="block text-xs text-gray-500">{l.transport.note}</span></dd></>}
            <dt className="text-gray-500">Grade (seller-reported)</dt><dd>{l.quality.grade || '—'}</dd>
            <dt className="text-gray-500">Moisture (seller-reported)</dt><dd>{l.quality.moisture_pct != null ? `${l.quality.moisture_pct}%` : '—'}</dd>
            <dt className="text-gray-500">Packaging</dt><dd>{l.quality.packaging || '—'}</dd>
            <dt className="text-gray-500">Production</dt><dd>{l.quality.production_method?.replace('_', ' ') || '—'}</dd>
            <dt className="text-gray-500">Platform fee</dt><dd>{l.fees.platform_fee_buyer_pct ? `${l.fees.platform_fee_buyer_pct}%` : 'None'}</dd>
            <dt className="text-gray-500">Listed</dt><dd>{fmtDate(l.published_at)}</dd>
          </dl>
          {l.notes && <p className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">{l.notes}</p>}
          <div className="mt-3"><InspectionCard inspection={l.inspection} /></div>
          <p className="mt-3 text-xs text-gray-500">Quality details are provided by the seller. Inspect at delivery; disputes are handled through FARMDirect.</p>
          <div className="mt-2"><ReportButton type="lot" id={l.id} /></div>
        </Section>
        <Section className="lg:col-span-2" title="Make an offer">
          {user?.role !== 'buyer' ? <p className="text-sm text-gray-600">Only buyer accounts can make offers.</p>
            : my_thread ? <Notice>You already have a negotiation on this lot. <Link className="underline" to={`/trade/threads/${my_thread}`}>Open it</Link></Notice>
            : !bs?.can_transact ? (
              <Notice tone="warn" title="Verification needed before you can make offers">
                <p>Status: {bs?.status_text}</p>
                <ul className="mt-1 list-disc pl-5">{bs?.next_steps?.map((s: string) => <li key={s}>{s}</li>)}</ul>
                <Link to="/buyer/verification" className="mt-2 inline-block font-semibold underline">Complete verification</Link>
              </Notice>
            ) : (
              <OfferForm unit={l.unit} maxQty={l.quantity_available} minQty={l.min_order_qty} fullLotOnly={!l.allow_partial}
                initial={{ quantity: l.allow_partial ? '' : l.quantity_available, price_per_unit: l.price_per_unit ?? '', delivery_mode: 'buyer_pickup', payment_terms: 'on_delivery', advance_pct: '', payment_due_days: '', note: '', charges: [] }}
                onSubmit={async (b) => { const res = await api.post('/v1/offers', { lot_id: l.id, ...b }); toast('Offer sent to the farmer'); nav(`/trade/threads/${res.offer.thread_id}`); }} />
            )}
        </Section>
      </div>
    </div>
  );
}

export function DemandDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const r = useAsync(() => api.get(`/v1/marketplace/demand/${id}`), [id]);
  const lots = useAsync(() => (user?.role === 'farmer' ? api.get('/v1/marketplace/lots/mine').then((x) => x.lots) : Promise.resolve([])));
  const [lotId, setLotId] = useState('');
  const crops = useCrops();
  if (r.loading) return <Skeleton lines={6} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const d = r.data.demand;
  const myLots = (lots.data || []).filter((l: any) => l.quantity_available > 0 && ['published', 'offer_received', 'negotiation', 'partially_sold', 'reserved'].includes(l.status) && (!d.crop_id || l.crop_id === d.crop_id));
  const lot = myLots.find((l: any) => l.id === lotId);
  return (
    <div className="space-y-4">
      <PageHeader title={`${d.commodity}${d.variety ? ` · ${d.variety}` : ''} – ${d.remaining} ${d.unit} needed`} icon={<ShoppingBasket />} subtitle={`${d.business_name} · verified buyer`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Requirement">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Quantity</dt><dd>{d.quantity} {d.unit} ({d.quantity_committed} already committed)</dd>
            <dt className="text-gray-500">Price range</dt><dd>{d.price_min || d.price_max ? `${inr(d.price_min)} – ${inr(d.price_max)}/${d.unit}` : 'Open'}</dd>
            <dt className="text-gray-500">Quality</dt><dd>{d.quality_spec || '—'}</dd>
            <dt className="text-gray-500">Deliver to</dt><dd>{[d.delivery_location, d.district, d.state].filter(Boolean).join(', ') || '—'}</dd>
            <dt className="text-gray-500">By</dt><dd>{fmtDate(d.delivery_date)}</dd>
            <dt className="text-gray-500">Packaging</dt><dd>{d.packaging || '—'}</dd>
            <dt className="text-gray-500">Payment terms</dt><dd>{d.payment_terms?.replace(/_/g, ' ') || '—'}</dd>
            <dt className="text-gray-500">Several farmers may supply</dt><dd>{d.allow_aggregation ? 'Yes' : 'No'}</dd>
          </dl>
          <div className="mt-2"><ReportButton type="demand" id={d.id} /></div>
        </Section>
        {r.data.is_owner ? (
          <Section title="Responses from farmers" description="Compare offers; accept from several farmers to fill the quantity.">
            {r.data.responses.length === 0 ? <Empty title="No responses yet" /> : (
              <ul className="divide-y text-sm">{r.data.responses.map((o: any) => (
                <li key={o.thread_id}><Link to={`/trade/threads/${o.thread_id}`} className="flex justify-between py-2 hover:bg-gray-50"><span>{o.quantity} {o.unit} @ {inr(o.price_per_unit)} · {o.district}{o.quality_grade && ` · ${o.quality_grade}`}</span><StatusBadge status={o.status} /></Link></li>
              ))}</ul>
            )}
          </Section>
        ) : user?.role === 'farmer' ? (
          <Section title="Offer your produce">
            {myLots.length === 0 ? <Empty title="No matching published lot" action={<Link to="/sell/new"><Button>Create a lot</Button></Link>}>{crops.find((c) => c.id === d.crop_id)?.name ?? d.commodity} lot needed.</Empty> : (
              <div className="space-y-3">
                <Select aria-label="Your lot" value={lotId} onChange={(e) => setLotId(e.target.value)} placeholder="Choose your lot" options={myLots.map((l: any) => ({ value: l.id, label: `${l.commodity} ${l.variety ?? ''} – ${l.quantity_available} ${l.unit}` }))} />
                {lot && <OfferForm unit={lot.unit} maxQty={Math.min(lot.quantity_available, d.remaining)} submitLabel="Send to buyer"
                  initial={{ quantity: Math.min(lot.quantity_available, d.remaining), price_per_unit: d.price_max ?? lot.price_per_unit ?? '', delivery_mode: 'farmer_delivery', payment_terms: d.payment_terms || 'on_delivery', advance_pct: '', payment_due_days: '', note: '', charges: [] }}
                  onSubmit={async (b) => { const res = await api.post('/v1/offers', { lot_id: lot.id, demand_id: d.id, ...b }); toast('Offer sent to the buyer'); nav(`/trade/threads/${res.offer.thread_id}`); }} />}
              </div>
            )}
          </Section>
        ) : null}
      </div>
    </div>
  );
}

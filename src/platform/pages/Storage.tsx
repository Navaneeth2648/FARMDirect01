import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { List, Map as MapIcon, Printer, Warehouse } from 'lucide-react';
import { api, fmtDate, fmtDateTime, inr, qs, today } from '../api';
import { useAuth } from '../auth';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, Notice, PageHeader, Section, Select, Skeleton, Spinner, Tabs, Textarea, useAsync, useConfirm, useToast } from '../ui';
import { CropSelect, LocationPicker } from '../shared';
import { PrivateImage, StatusBadge, VoiceHint, useStepUp } from '../trade-ui';
import { PaymentsSection, DisputeModal } from './Trade';
import { ReportButton } from './Market';

const TYPES = [
  { value: 'warehouse', label: 'Warehouse' }, { value: 'grain', label: 'Grain storage' }, { value: 'general', label: 'General agri storage' },
  { value: 'cold_storage', label: 'Cold storage' }, { value: 'pre_cooling', label: 'Pre-cooling' }, { value: 'fpo', label: 'FPO / cooperative' }, { value: 'other', label: 'Other' },
];
const addDays = (n: number) => new Date(Date.now() + n * 86400_000).toISOString().slice(0, 10);

function FacilityMap({ facilities, center }: { facilities: any[]; center: [number, number] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  useEffect(() => {
    if (!el.current || map.current) return;
    map.current = L.map(el.current).setView(center, 9);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; OpenStreetMap contributors' }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    return () => { map.current?.remove(); map.current = null; };
  }, [center]);
  useEffect(() => {
    const g = layer.current; if (!g) return;
    g.clearLayers();
    L.circleMarker(center, { radius: 7, color: '#2563eb' }).bindTooltip('You').addTo(g);
    facilities.forEach((f) => L.circleMarker([f.latitude, f.longitude], { radius: 8, color: '#047857', fillOpacity: 0.7 })
      .bindPopup(`<b>${f.name.replace(/</g, '&lt;')}</b><br>${f.availability?.available_qtl ?? '?'} qtl free<br><a href="/storage/facilities/${f.id}">Open</a>`).addTo(g));
  }, [facilities, center]);
  return <div ref={el} className="h-80 w-full rounded-xl border" role="application" aria-label="Map of nearby storage" />;
}

export function StoragePage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const lotId = params.get('lot');
  const [tab, setTab] = useState<'find' | 'bookings'>('find');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [geo, setGeo] = useState<{ lat: number; lon: number } | null>(user?.latitude != null ? { lat: user.latitude!, lon: user.longitude! } : null);
  const [f, setF] = useState({ crop_id: '', type: '', quantity: '', unit: 'quintal', start: addDays(1), end: addDays(30), max_km: '50', insurance: false });
  const [query, setQuery] = useState(f);
  const r = useAsync(() => api.get(`/v1/storage/facilities${qs({ ...query, insurance: query.insurance ? '1' : '', lat: geo?.lat, lon: geo?.lon })}`), [query, geo]);
  const bookings = useAsync(() => api.get('/v1/storage/bookings').then((x) => x.bookings));
  const ending = (bookings.data || []).filter((b: any) => ['in_storage', 'confirmed'].includes(b.status) && b.end_date <= addDays(3));
  return (
    <div className="space-y-4">
      <PageHeader title="Nearby Storage" icon={<Warehouse />} subtitle="Find verified warehouses and cold storage near your village, compare costs, and book capacity" />
      {ending.map((b: any) => <Notice key={b.id} tone="warn">Booking {b.booking_ref} ends on {fmtDate(b.end_date)}. <Link to={`/storage/bookings/${b.id}`} className="underline">Extend or request release</Link></Notice>)}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'find', label: 'Find storage' }, { id: 'bookings', label: `My bookings (${bookings.data?.length ?? 0})` }]} />
      {tab === 'find' ? (
        <>
          <Section>
            {!geo && <div className="mb-3"><LocationPicker label="Where are you? (village or town)" onPick={(p) => setGeo({ lat: p.latitude, lon: p.longitude })} /></div>}
            <form className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); setQuery(f); }}>
              <CropSelect value={f.crop_id} onChange={(v) => setF({ ...f, crop_id: v })} />
              <Select aria-label="Facility type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={TYPES} placeholder="Any type" />
              <div className="flex gap-1"><Input aria-label="Quantity" type="number" min="0" placeholder="Quantity" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} /><Select aria-label="Unit" className="w-28" value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} options={['quintal', 'tonne', 'kg'].map((u) => ({ value: u, label: u }))} /></div>
              <Select aria-label="Distance" value={f.max_km} onChange={(e) => setF({ ...f, max_km: e.target.value })} options={['10', '25', '50', '100', '200'].map((k) => ({ value: k, label: `Within ${k} km` }))} />
              <Field label="From">{(id) => <Input id={id} type="date" min={today()} value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} />}</Field>
              <Field label="To">{(id) => <Input id={id} type="date" min={f.start} value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} />}</Field>
              <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={f.insurance} onChange={(e) => setF({ ...f, insurance: e.target.checked })} />Insurance available</label>
              <Button type="submit" className="self-end">Search</Button>
            </form>
          </Section>
          <div className="flex justify-end gap-1">
            <Button size="sm" variant={view === 'list' ? 'default' : 'outline'} onClick={() => setView('list')}><List className="mr-1 h-4 w-4" />List</Button>
            <Button size="sm" variant={view === 'map' ? 'default' : 'outline'} onClick={() => setView('map')} disabled={!geo}><MapIcon className="mr-1 h-4 w-4" />Map</Button>
          </div>
          {r.loading ? <Skeleton lines={6} /> : r.error ? <ErrorBox error={r.error} /> : r.data.facilities.length === 0 ? (
            <Empty title="No verified storage found">Try a larger distance or different dates. Only facilities checked by FARMDirect are shown.</Empty>
          ) : view === 'map' && geo ? <FacilityMap facilities={r.data.facilities} center={[geo.lat, geo.lon]} /> : (
            <div className="grid gap-3 md:grid-cols-2">
              {r.data.facilities.map((fc: any) => (
                <Link key={fc.id} to={`/storage/facilities/${fc.id}${qs({ start: query.start, end: query.end, lot: lotId, quantity: query.quantity, unit: query.unit, crop: query.crop_id })}`} className="rounded-2xl border border-gray-200 bg-white p-4 hover:border-emerald-400">
                  <div className="flex items-start justify-between gap-2"><p className="text-lg font-semibold">{fc.name}</p><Badge tone="green">Verified</Badge></div>
                  <p className="text-sm text-gray-600">{TYPES.find((t) => t.value === fc.facility_type)?.label} · {fc.district}{fc.distance_km != null && ` · ${fc.distance_km} km`}</p>
                  <p className="mt-1 text-sm"><b>{fc.availability?.available_qtl}</b> quintal free for your dates · min {fc.min_booking_qtl} qtl</p>
                  <p className="text-sm">{fc.rates[0] ? `From ${inr(fc.rates[0].price)}/${fc.rates[0].unit}/${fc.rates[0].period}` : 'Rates on request'}</p>
                  {fc.estimate && <p className="mt-1 font-semibold text-emerald-800">Estimated total: {inr(fc.estimate.total)}</p>}
                  <div className="mt-2 flex flex-wrap gap-1">{fc.temp_range_c && <Badge tone="blue">{fc.temp_range_c[0]}–{fc.temp_range_c[1]}°C</Badge>}{fc.insurance_available && <Badge>Insurance</Badge>}</div>
                </Link>
              ))}
            </div>
          )}
          <p className="text-xs text-gray-500">{r.data?.note} Distances are estimates.</p>
        </>
      ) : (
        bookings.loading ? <Skeleton /> : !bookings.data?.length ? <Empty title="No storage bookings yet" /> : (
          <Section><ul className="divide-y">{bookings.data.map((b: any) => (
            <li key={b.id}><Link to={`/storage/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-gray-50">
              <div><p className="font-semibold">{b.booking_ref} · {b.facility_name}</p><p className="text-sm text-gray-600">{b.quantity} {b.unit} {b.commodity} · {fmtDate(b.start_date)} – {fmtDate(b.end_date)}</p></div>
              <StatusBadge status={b.status} />
            </Link></li>))}</ul></Section>
        )
      )}
    </div>
  );
}

export function FacilityPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [b, setB] = useState({ lot_id: params.get('lot') || '', crop_id: params.get('crop') || '', commodity: '', quantity: params.get('quantity') || '', unit: params.get('unit') || 'quintal', start_date: params.get('start') || addDays(1), end_date: params.get('end') || addDays(30) });
  const fac = useAsync(() => api.get(`/v1/storage/facilities/${id}${qs({ start: b.start_date, end: b.end_date, lat: user?.latitude, lon: user?.longitude })}`), [id]);
  const lots = useAsync(() => (user?.role === 'farmer' ? api.get('/v1/marketplace/lots/mine').then((r) => r.lots.filter((l: any) => !['sold', 'withdrawn'].includes(l.status))) : Promise.resolve([])));
  const [step, setStep] = useState(0);
  const [check, setCheck] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const [enquiry, setEnquiry] = useState('');
  useEffect(() => {
    const l = (lots.data || []).find((x: any) => x.id === b.lot_id);
    if (l) setB((x) => ({ ...x, crop_id: l.crop_id || x.crop_id, commodity: l.commodity, quantity: x.quantity || String(l.quantity_available), unit: l.unit }));
  }, [b.lot_id, lots.data]);
  if (fac.loading) return <Skeleton lines={8} />;
  if (fac.error) return <ErrorBox error={fac.error} />;
  const f = fac.data.facility;
  const body = () => ({ facility_id: f.id, lot_id: b.lot_id || null, crop_id: b.crop_id || null, commodity: b.commodity || b.crop_id || 'Produce', quantity: Number(b.quantity), unit: b.unit, start_date: b.start_date, end_date: b.end_date });
  const runCheck = async () => { setBusy(true); setErr(null); try { setCheck(await api.post('/v1/storage/check', body())); setStep(2); } catch (e) { setErr(e); } finally { setBusy(false); } };
  const book = async () => {
    setBusy(true); setErr(null);
    try { const r = await api.post('/v1/storage/bookings', { ...body(), confirm: true }); toast(`Booking requested: ${r.booking.booking_ref}`); nav(`/storage/bookings/${r.booking.id}`); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-4">
      <PageHeader title={f.name} icon={<Warehouse />} subtitle={<span className="flex items-center gap-2">{f.verified ? <Badge tone="green">Verified operator</Badge> : <StatusBadge status={f.status} />} {f.operator_name}</span>} />
      <div className="grid gap-4 lg:grid-cols-5">
        <Section className="lg:col-span-3" title="Facility">
          {f.photos.length > 0 && <div className="mb-3 grid grid-cols-3 gap-2">{f.photos.map((p: string) => <PrivateImage key={p} id={p} alt="Facility" className="h-24 w-full rounded-lg object-cover" />)}</div>}
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Type</dt><dd>{TYPES.find((t) => t.value === f.facility_type)?.label}</dd>
            <dt className="text-gray-500">Address</dt><dd>{f.address}, {f.district}, {f.state}{f.distance_km != null && ` (~${f.distance_km} km)`} <a className="block text-emerald-700 underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/directions?to=${f.latitude},${f.longitude}`}>Directions</a></dd>
            <dt className="text-gray-500">Stores</dt><dd>{f.commodities.join(', ')}</dd>
            {f.temp_range_c && <><dt className="text-gray-500">Temperature</dt><dd>{f.temp_range_c[0]}–{f.temp_range_c[1]} °C</dd></>}
            <dt className="text-gray-500">Capacity</dt><dd>{f.availability?.available_qtl} of {f.total_capacity_qtl} quintal free ({fmtDate(f.availability_range.start)} – {fmtDate(f.availability_range.end)})</dd>
            <dt className="text-gray-500">Minimum booking</dt><dd>{f.min_booking_qtl} quintal</dd>
            <dt className="text-gray-500">Rates</dt><dd>{f.rates.map((r: any, i: number) => <span key={i} className="block">{inr(r.price)}/{r.unit}/{r.period}{r.commodity_category && ` (${r.commodity_category})`}</span>)}</dd>
            <dt className="text-gray-500">Other charges</dt><dd>Loading {inr(f.charges.loading_per_qtl)}/qtl · Unloading {inr(f.charges.unloading_per_qtl)}/qtl · Handling {inr(f.charges.handling_per_qtl)}/qtl · Booking fee {inr(f.charges.booking_fee)}{f.charges.tax_pct ? ` · Tax ${f.charges.tax_pct}%` : ''}</dd>
            <dt className="text-gray-500">Hours</dt><dd>{f.operating_hours || '—'}</dd>
            <dt className="text-gray-500">Insurance</dt><dd>{f.insurance_available ? f.insurance_details || 'Available' : 'Not offered'}</dd>
            <dt className="text-gray-500">Cancellation</dt><dd>{f.cancellation_policy}</dd>
            {f.booking_conditions && <><dt className="text-gray-500">Conditions</dt><dd>{f.booking_conditions}</dd></>}
            <dt className="text-gray-500">Documents</dt><dd>{f.documentation_status}</dd>
            {f.phone && <><dt className="text-gray-500">Contact</dt><dd><a className="text-emerald-700 underline" href={`tel:${f.phone}`}>{f.phone}</a></dd></>}
          </dl>
          {fac.data.blackouts.length > 0 && <Notice tone="warn">Reduced capacity: {fac.data.blackouts.map((x: any) => `${fmtDate(x.start_date)}–${fmtDate(x.end_date)} (${x.reason || 'maintenance'})`).join('; ')}</Notice>}
          <form className="mt-3 flex gap-2" onSubmit={async (e) => { e.preventDefault(); try { await api.post(`/v1/storage/facilities/${f.id}/enquiries`, { message: enquiry }); setEnquiry(''); toast('Question sent to the facility'); } catch (er: any) { toast(er.message, 'error'); } }}>
            <Input aria-label="Question" placeholder="Ask the facility a question" value={enquiry} onChange={(e) => setEnquiry(e.target.value)} required />
            <Button type="submit" variant="outline">Send</Button>
          </form>
          <div className="mt-2"><ReportButton type="facility" id={f.id} /></div>
        </Section>

        <Section className="lg:col-span-2" title={<span className="flex items-center gap-2">Book storage <VoiceHint text="Choose your crop, the amount, and the dates. Then check the price and confirm." /></span>}>
          {!f.verified ? <Notice tone="warn">This facility is not verified, so it cannot be booked.</Notice> : user?.role !== 'farmer' && user?.role !== 'fpo_manager' ? <p className="text-sm text-gray-600">Farmer accounts can book storage.</p> : (
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase text-emerald-700">Step {step + 1} of 3</p>
              {step === 0 && (
                <>
                  {(lots.data || []).length > 0 && <Field label="Produce lot (optional)">{(id) => <Select id={id} value={b.lot_id} onChange={(e) => setB({ ...b, lot_id: e.target.value })} placeholder="Not linked to a lot" options={lots.data!.map((l: any) => ({ value: l.id, label: `${l.commodity} – ${l.quantity_available} ${l.unit}` }))} />}</Field>}
                  <Field label="Crop">{(id) => <CropSelect id={id} value={b.crop_id} onChange={(v) => setB({ ...b, crop_id: v })} />}</Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Quantity">{(id) => <Input id={id} className="py-3 text-lg" type="number" min="0" value={b.quantity} onChange={(e) => setB({ ...b, quantity: e.target.value })} />}</Field>
                    <Field label="Unit">{(id) => <Select id={id} className="py-3 text-lg" value={b.unit} onChange={(e) => setB({ ...b, unit: e.target.value })} options={['quintal', 'tonne', 'kg'].map((u) => ({ value: u, label: u }))} />}</Field>
                  </div>
                  <Button className="w-full" size="lg" disabled={!b.crop_id || !(Number(b.quantity) > 0)} onClick={() => setStep(1)}>Next</Button>
                </>
              )}
              {step === 1 && (
                <>
                  <Field label="Start date">{(id) => <Input id={id} className="py-3 text-lg" type="date" min={today()} value={b.start_date} onChange={(e) => setB({ ...b, start_date: e.target.value })} />}</Field>
                  <Field label="End date (expected)">{(id) => <Input id={id} className="py-3 text-lg" type="date" min={b.start_date} value={b.end_date} onChange={(e) => setB({ ...b, end_date: e.target.value })} />}</Field>
                  <div className="flex gap-2"><Button variant="outline" onClick={() => setStep(0)}>Back</Button><Button className="flex-1" size="lg" disabled={busy} onClick={runCheck}>{busy ? <Spinner /> : 'Check price & space'}</Button></div>
                </>
              )}
              {step === 2 && check && (
                <>
                  {check.ok ? <Notice tone="ok">Space is available for all your dates.</Notice> : <Notice tone="warn" title="Cannot book">{check.issues.join(' ')}</Notice>}
                  {check.estimate && (
                    <div className="rounded-xl bg-gray-50 p-3 text-sm">
                      {check.estimate.lines.map((l: any, i: number) => <div key={i} className="flex justify-between"><span>{l.label}</span><span>{inr(l.amount)}</span></div>)}
                      {check.estimate.tax > 0 && <div className="flex justify-between"><span>Tax ({check.estimate.tax_pct}%)</span><span>{inr(check.estimate.tax)}</span></div>}
                      <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Estimated total</span><span>{inr(check.estimate.total)}</span></div>
                      <p className="mt-1 text-xs text-gray-500">{check.estimate.note}</p>
                    </div>
                  )}
                  <p className="text-sm"><b>Cancellation:</b> {check.cancellation_policy}</p>
                  <p className="text-xs text-gray-500">Your request holds the space for {check.hold_hours} hours while the facility confirms. Extending later depends on availability and adds charges at the same rate.</p>
                  <div className="flex gap-2"><Button variant="outline" onClick={() => setStep(1)}>Back</Button><Button className="flex-1" size="lg" disabled={!check.ok || busy} onClick={book}>{busy ? <Spinner /> : 'Confirm booking request'}</Button></div>
                </>
              )}
              {err && <ErrorBox error={err} />}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

export function BookingPage() {
  const { id } = useParams();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const step = useStepUp();
  const r = useAsync(() => api.get(`/v1/storage/bookings/${id}`), [id]);
  const [extend, setExtend] = useState('');
  const [modal, setModal] = useState<null | 'dispute'>(null);
  if (r.loading) return <Skeleton lines={8} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const { booking: b, facility: f, receipt, movements, payments, my_side } = r.data;
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); r.reload(); } catch (e: any) { toast(e.message, 'error'); } };
  const est = b.final_charges ?? b.estimate;
  return (
    <div className="space-y-4">
      {node}{step.node}
      <PageHeader title={`Storage booking ${b.booking_ref}`} icon={<Warehouse />} subtitle={<span className="flex items-center gap-2"><StatusBadge status={b.status} /> {f.name}</span>}
        actions={receipt && <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print receipt</Button>} />
      {b.provider_note && <Notice>{b.status === 'declined' ? 'Declined by facility: ' : 'Facility note: '}{b.provider_note}</Notice>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Booking">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Produce</dt><dd>{b.quantity} {b.unit} {b.commodity} ({b.quantity_qtl} qtl)</dd>
            <dt className="text-gray-500">Dates</dt><dd>{fmtDate(b.start_date)} – {fmtDate(b.end_date)}</dd>
            {b.check_in_date && <><dt className="text-gray-500">Check-in</dt><dd>{fmtDate(b.check_in_date)}</dd></>}
            <dt className="text-gray-500">Facility</dt><dd>{f.address}, {f.district}{f.phone && <a className="block text-emerald-700 underline" href={`tel:${f.phone}`}>{f.phone}</a>}</dd>
            <dt className="text-gray-500">Cancellation policy</dt><dd>{f.cancellation_policy}</dd>
          </dl>
          {est && (
            <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm">
              <p className="mb-1 font-semibold">{b.final_charges ? 'Final charges' : 'Estimated charges'}</p>
              {(est.lines || []).map((l: any, i: number) => <div key={i} className="flex justify-between"><span>{l.label}</span><span>{inr(l.amount)}</span></div>)}
              {est.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>{inr(est.tax)}</span></div>}
              <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Total</span><span>{inr(est.total)}</span></div>
              {b.final_charges && <p className="text-xs">Paid before release {inr(est.paid_before_release)} · outstanding {inr(est.outstanding)}</p>}
            </div>
          )}
          {my_side === 'farmer' && (
            <div className="mt-3 flex flex-wrap gap-2">
              {['received', 'in_storage'].includes(b.status) && <Button onClick={() => act(() => api.post(`/v1/storage/bookings/${b.id}/release-request`, {}), 'Release requested')}>Request release</Button>}
              {['availability_requested', 'awaiting_payment', 'confirmed', 'check_in_scheduled'].includes(b.status) && <Button variant="ghost" className="text-red-700" onClick={async () => {
                if (await ask('Cancel this booking?', `Cancellation policy: ${f.cancellation_policy}`, { danger: true, label: 'Cancel booking' })) act(() => api.post(`/v1/storage/bookings/${b.id}/cancel`, { reason: 'Cancelled by farmer', confirm: true }), 'Booking cancelled');
              }}>Cancel booking</Button>}
              {!['completed', 'cancelled', 'declined', 'availability_requested'].includes(b.status) && <Button variant="outline" onClick={() => setModal('dispute')}>Report a problem</Button>}
            </div>
          )}
          {my_side === 'farmer' && ['confirmed', 'check_in_scheduled', 'received', 'in_storage'].includes(b.status) && (
            <form className="mt-3 flex items-end gap-2" onSubmit={async (e) => { e.preventDefault(); if (await ask('Extend booking?', 'Extra days are charged at the same rate. Space must be free for the new dates.', { label: 'Extend' })) act(() => api.post(`/v1/storage/bookings/${b.id}/extend`, { end_date: extend, confirm: true }), 'Booking extended'); }}>
              <Field label="Extend to">{(fid) => <Input id={fid} type="date" min={b.end_date} value={extend} onChange={(e) => setExtend(e.target.value)} required />}</Field>
              <Button type="submit" variant="outline">Extend</Button>
            </form>
          )}
        </Section>
        <Section title="Storage receipt">
          {!receipt ? <p className="text-sm text-gray-500">A receipt is issued when the facility receives your produce.</p> : (
            <div className="text-sm">
              <p className="text-lg font-bold">{receipt.receipt_no}</p>
              <dl className="mt-2 grid grid-cols-2 gap-1">
                <dt className="text-gray-500">Received</dt><dd>{receipt.received_qty_qtl} quintal on {fmtDateTime(receipt.issued_at)}</dd>
                <dt className="text-gray-500">Condition</dt><dd>{receipt.condition_notes}</dd>
                {receipt.moisture_pct != null && <><dt className="text-gray-500">Moisture</dt><dd>{receipt.moisture_pct}%</dd></>}
                {receipt.quality_notes && <><dt className="text-gray-500">Quality</dt><dd>{receipt.quality_notes}</dd></>}
                <dt className="text-gray-500">Bin / location</dt><dd>{receipt.bin_ref || '—'}</dd>
                <dt className="text-gray-500">Expected release</dt><dd>{fmtDate(b.end_date)}</dd>
                <dt className="text-gray-500">Farmer</dt><dd>{r.data.farmer?.full_name ?? 'You'}</dd>
                <dt className="text-gray-500">Facility</dt><dd>{f.name} ({f.operator_name})</dd>
              </dl>
              {receipt.photos.length > 0 && <div className="mt-2 grid grid-cols-3 gap-2">{receipt.photos.map((p: any) => <PrivateImage key={p.id} id={p.id} alt="Receipt evidence" className="h-20 w-full rounded object-cover" />)}</div>}
            </div>
          )}
        </Section>
      </div>
      <PaymentsSection payments={payments} onChange={r.reload} />
      <Section title="History" description="Every change to quantity, condition and status, with time and who made it.">
        <ol className="space-y-1 text-sm">{movements.map((m: any, i: number) => <li key={i}><span className="text-gray-500">{fmtDateTime(m.created_at)}</span> · <b>{m.kind}</b>{m.quantity_qtl != null && ` · ${m.quantity_qtl} qtl`}{m.note && ` – ${m.note}`}{m.actor && <span className="text-gray-500"> ({m.actor})</span>}</li>)}</ol>
      </Section>
      <DisputeModal open={modal === 'dispute'} bookingId={b.id} onClose={() => setModal(null)} />
    </div>
  );
}

// ---------------- Storage provider workspace ----------------
const EMPTY_FAC = {
  name: '', operator_name: '', facility_type: 'warehouse', address: '', village: '', district: '', state: '', pincode: '', latitude: '', longitude: '', phone: '', operating_hours: '',
  commodities: ['cereal'], temp_min_c: '', temp_max_c: '', total_capacity_qtl: '', min_booking_qtl: '1', loading_per_qtl: '0', unloading_per_qtl: '0', handling_per_qtl: '0',
  booking_fee: '0', tax_pct: '0', insurance_available: false, insurance_details: '', cancellation_policy: '', booking_conditions: '', authorization_type: 'owned', license_info: '', safety_info: '',
};

function FacilityForm({ initial, onSaved }: { initial?: any; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<any>(initial ? { ...EMPTY_FAC, ...Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, v ?? ''])) } : EMPTY_FAC);
  const [err, setErr] = useState<any>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const numKeys = ['latitude', 'longitude', 'temp_min_c', 'temp_max_c', 'total_capacity_qtl', 'min_booking_qtl', 'loading_per_qtl', 'unloading_per_qtl', 'handling_per_qtl', 'booking_fee', 'tax_pct'];
  const save = async (e: any) => {
    e.preventDefault(); setErr(null);
    const keys = Object.keys(EMPTY_FAC);
    const body: any = Object.fromEntries(keys.map((k) => [k, numKeys.includes(k) ? (f[k] === '' ? null : Number(f[k])) : f[k] === '' ? null : f[k]]));
    try {
      const r = initial ? await api.patch(`/v1/storage/provider/facilities/${initial.id}`, body) : await api.post('/v1/storage/provider/facilities', body);
      toast(r.pending_review ? 'Saved. Address/capacity changes need FARMDirect approval before they go live.' : 'Saved'); onSaved();
    } catch (er) { setErr(er); }
  };
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={save}>
      <Field label="Facility name" required>{(id) => <Input id={id} value={f.name} onChange={set('name')} required />}</Field>
      <Field label="Operator / business name" required>{(id) => <Input id={id} value={f.operator_name} onChange={set('operator_name')} required />}</Field>
      <Field label="Type">{(id) => <Select id={id} value={f.facility_type} onChange={set('facility_type')} options={TYPES} />}</Field>
      <Field label="Authorisation">{(id) => <Select id={id} value={f.authorization_type} onChange={set('authorization_type')} options={[{ value: 'owned', label: 'Owned' }, { value: 'leased', label: 'Leased' }, { value: 'authorised_operator', label: 'Authorised operator' }]} />}</Field>
      <div className="sm:col-span-2"><Field label="Address" required>{(id) => <Input id={id} value={f.address} onChange={set('address')} required />}</Field></div>
      <Field label="District" required>{(id) => <Input id={id} value={f.district} onChange={set('district')} required />}</Field>
      <Field label="State" required>{(id) => <Input id={id} value={f.state} onChange={set('state')} required />}</Field>
      <div className="sm:col-span-2"><LocationPicker label="Map location (required)" onPick={(p) => setF({ ...f, latitude: p.latitude, longitude: p.longitude, district: f.district || p.district || '', state: f.state || p.state || '' })} />{f.latitude !== '' && <p className="text-xs text-gray-500">{f.latitude}, {f.longitude}</p>}</div>
      <Field label="Phone">{(id) => <Input id={id} value={f.phone} onChange={set('phone')} />}</Field>
      <Field label="Operating hours">{(id) => <Input id={id} value={f.operating_hours} onChange={set('operating_hours')} placeholder="Mon–Sat 8am–6pm" />}</Field>
      <Field label="Commodities stored">{(id) => <select id={id} multiple className="h-28 w-full rounded-lg border border-gray-300 p-2" value={f.commodities} onChange={(e) => setF({ ...f, commodities: Array.from(e.target.selectedOptions).map((o) => o.value) })}>{['all', 'cereal', 'pulse', 'oilseed', 'vegetable', 'fruit', 'cash', 'spice'].map((c) => <option key={c}>{c}</option>)}</select>}</Field>
      <div className="grid grid-cols-2 gap-2"><Field label="Min °C">{(id) => <Input id={id} type="number" value={f.temp_min_c} onChange={set('temp_min_c')} />}</Field><Field label="Max °C">{(id) => <Input id={id} type="number" value={f.temp_max_c} onChange={set('temp_max_c')} />}</Field></div>
      <Field label="Total usable capacity (quintal)" required>{(id) => <Input id={id} type="number" min="1" value={f.total_capacity_qtl} onChange={set('total_capacity_qtl')} required />}</Field>
      <Field label="Minimum booking (quintal)">{(id) => <Input id={id} type="number" min="0.1" step="0.1" value={f.min_booking_qtl} onChange={set('min_booking_qtl')} />}</Field>
      <Field label="Loading ₹/qtl">{(id) => <Input id={id} type="number" min="0" value={f.loading_per_qtl} onChange={set('loading_per_qtl')} />}</Field>
      <Field label="Unloading ₹/qtl">{(id) => <Input id={id} type="number" min="0" value={f.unloading_per_qtl} onChange={set('unloading_per_qtl')} />}</Field>
      <Field label="Handling ₹/qtl">{(id) => <Input id={id} type="number" min="0" value={f.handling_per_qtl} onChange={set('handling_per_qtl')} />}</Field>
      <Field label="Booking fee ₹">{(id) => <Input id={id} type="number" min="0" value={f.booking_fee} onChange={set('booking_fee')} />}</Field>
      <Field label="Tax % on charges (if applicable)">{(id) => <Input id={id} type="number" min="0" max="28" value={f.tax_pct} onChange={set('tax_pct')} />}</Field>
      <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={f.insurance_available} onChange={set('insurance_available')} />Insurance offered</label>
      {f.insurance_available && <div className="sm:col-span-2"><Field label="Insurance details">{(id) => <Input id={id} value={f.insurance_details} onChange={set('insurance_details')} />}</Field></div>}
      <div className="sm:col-span-2"><Field label="Cancellation policy" required>{(id) => <Textarea id={id} value={f.cancellation_policy} onChange={set('cancellation_policy')} required />}</Field></div>
      <div className="sm:col-span-2"><Field label="Booking conditions">{(id) => <Textarea id={id} value={f.booking_conditions} onChange={set('booking_conditions')} />}</Field></div>
      <Field label="Licences / registrations">{(id) => <Input id={id} value={f.license_info} onChange={set('license_info')} />}</Field>
      <Field label="Safety information">{(id) => <Input id={id} value={f.safety_info} onChange={set('safety_info')} />}</Field>
      {err && <div className="sm:col-span-2"><ErrorBox error={err} /></div>}
      <div className="flex justify-end sm:col-span-2"><Button type="submit">Save facility</Button></div>
    </form>
  );
}

function RatesEditor({ facility, onSaved }: { facility: any; onSaved: () => void }) {
  const toast = useToast();
  const [rates, setRates] = useState<any[]>(facility.rates.length ? facility.rates.map((r: any) => ({ ...r, commodity_category: r.commodity_category ?? '' })) : [{ commodity_category: '', price: '', unit: 'quintal', period: 'month' }]);
  return (
    <div className="space-y-2">
      {rates.map((r, i) => (
        <div key={i} className="grid grid-cols-4 gap-1">
          <Select aria-label="Category" value={r.commodity_category} onChange={(e) => { const x = [...rates]; x[i] = { ...r, commodity_category: e.target.value }; setRates(x); }} options={['cereal', 'pulse', 'oilseed', 'vegetable', 'fruit', 'cash', 'spice'].map((c) => ({ value: c, label: c }))} placeholder="All crops" />
          <Input aria-label="Price" type="number" min="0" placeholder="₹" value={r.price} onChange={(e) => { const x = [...rates]; x[i] = { ...r, price: e.target.value }; setRates(x); }} />
          <Select aria-label="Unit" value={r.unit} onChange={(e) => { const x = [...rates]; x[i] = { ...r, unit: e.target.value }; setRates(x); }} options={[{ value: 'quintal', label: 'per quintal' }, { value: 'tonne', label: 'per tonne' }]} />
          <Select aria-label="Period" value={r.period} onChange={(e) => { const x = [...rates]; x[i] = { ...r, period: e.target.value }; setRates(x); }} options={[{ value: 'day', label: 'per day' }, { value: 'week', label: 'per week' }, { value: 'month', label: 'per month' }]} />
        </div>
      ))}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => setRates([...rates, { commodity_category: '', price: '', unit: 'quintal', period: 'month' }])}>+ Rate</Button>
        <Button size="sm" onClick={async () => {
          try { await api.put(`/v1/storage/provider/facilities/${facility.id}/rates`, rates.filter((r) => r.price !== '').map((r) => ({ commodity_category: r.commodity_category || null, price: Number(r.price), unit: r.unit, period: r.period }))); toast('Rates saved'); onSaved(); }
          catch (e: any) { toast(e.message, 'error'); }
        }}>Save rates</Button>
      </div>
    </div>
  );
}

export function StorageProviderPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'bookings' | 'facilities' | 'enquiries'>('bookings');
  const fac = useAsync(() => api.get('/v1/storage/provider/facilities').then((r) => r.facilities));
  const bookings = useAsync(() => api.get('/v1/storage/provider/bookings').then((r) => r.bookings));
  const enq = useAsync(() => api.get('/v1/storage/provider/enquiries').then((r) => r.enquiries));
  const [edit, setEdit] = useState<any>(null);
  const [recv, setRecv] = useState<any>(null);
  const [rform, setRform] = useState({ received_qty_qtl: '', condition_notes: '', moisture_pct: '', quality_notes: '', bin_ref: '' });
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); bookings.reload(); fac.reload(); } catch (e: any) { toast(e.message, 'error'); } };
  const reasonPrompt = (label: string) => window.prompt(label) || '';
  return (
    <div className="space-y-4">
      <PageHeader title="Storage provider" icon={<Warehouse />} subtitle="Manage facilities, capacity, rates, bookings and receipts" actions={<Button onClick={() => setEdit('new')}>Add facility</Button>} />
      {fac.data && fac.data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {fac.data.map((f: any) => (
            <div key={f.id} className="rounded-2xl border border-gray-200 bg-white p-4 text-sm">
              <div className="flex justify-between"><p className="font-semibold">{f.name}</p><StatusBadge status={f.status} /></div>
              <p>Occupied {f.occupancy.occupied_qtl} · reserved {f.occupancy.reserved_qtl} of {f.total_capacity_qtl} qtl</p>
              <div className="mt-1 h-2 rounded bg-gray-100"><div className="h-2 rounded bg-emerald-600" style={{ width: `${Math.min(100, ((f.occupancy.occupied_qtl + f.occupancy.reserved_qtl) / f.total_capacity_qtl) * 100)}%` }} /></div>
              <p className="mt-1 text-gray-600">Confirmed storage revenue: {inr(f.revenue_confirmed)}</p>
            </div>
          ))}
        </div>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'bookings', label: 'Bookings' }, { id: 'facilities', label: 'Facilities' }, { id: 'enquiries', label: 'Enquiries' }]} />
      {tab === 'bookings' && (bookings.loading ? <Skeleton /> : !bookings.data?.length ? <Empty title="No bookings yet" /> : (
        <Section>
          <ul className="divide-y text-sm">{bookings.data.map((b: any) => (
            <li key={b.id} className="space-y-1 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link to={`/storage/bookings/${b.id}`} className="font-semibold hover:underline">{b.booking_ref} · {b.farmer_name} · {b.quantity} {b.unit} {b.commodity}</Link>
                <StatusBadge status={b.status} />
              </div>
              <p className="text-gray-600">{b.facility_name} · {fmtDate(b.start_date)} – {fmtDate(b.end_date)}{b.hold_expires_at && ` · respond by ${fmtDateTime(b.hold_expires_at)}`}</p>
              <div className="flex flex-wrap gap-2">
                {b.status === 'availability_requested' && <><Button size="sm" onClick={() => act(() => api.post(`/v1/storage/provider/bookings/${b.id}/decide`, { decision: 'confirm' }), 'Booking accepted')}>Accept</Button>
                  <Button size="sm" variant="outline" onClick={() => { const n = reasonPrompt('Reason for declining'); if (n) act(() => api.post(`/v1/storage/provider/bookings/${b.id}/decide`, { decision: 'decline', note: n }), 'Declined'); }}>Decline</Button></>}
                {b.status === 'confirmed' && <Button size="sm" onClick={() => { const d = reasonPrompt('Check-in date (YYYY-MM-DD)') || b.start_date; act(() => api.post(`/v1/storage/provider/bookings/${b.id}/schedule-checkin`, { check_in_date: d }), 'Check-in scheduled'); }}>Schedule check-in</Button>}
                {['confirmed', 'check_in_scheduled'].includes(b.status) && <Button size="sm" variant="outline" onClick={() => { setRecv(b); setRform({ received_qty_qtl: String(b.quantity_qtl), condition_notes: '', moisture_pct: '', quality_notes: '', bin_ref: '' }); }}>Record arrival & receipt</Button>}
                {['in_storage', 'release_requested'].includes(b.status) && <Button size="sm" variant="outline" onClick={() => { const n = reasonPrompt('Condition note'); if (n) act(() => api.post(`/v1/storage/provider/bookings/${b.id}/movement`, { kind: 'condition', note: n }), 'Recorded'); }}>Condition update</Button>}
                {['in_storage', 'release_requested'].includes(b.status) && <Button size="sm" onClick={() => { if (confirm('Release the produce and calculate final charges?')) act(() => api.post(`/v1/storage/provider/bookings/${b.id}/release`, { confirm: true }), 'Released – final charges recorded'); }}>Release / collected</Button>}
                {b.status === 'released' && <Button size="sm" variant="outline" onClick={() => act(() => api.post(`/v1/storage/provider/bookings/${b.id}/complete`), 'Completed')}>Mark completed</Button>}
              </div>
            </li>))}</ul>
        </Section>
      ))}
      {tab === 'facilities' && (fac.loading ? <Skeleton /> : !fac.data?.length ? <Empty title="No facilities yet" action={<Button onClick={() => setEdit('new')}>Add facility</Button>} /> : fac.data.map((f: any) => (
        <Section key={f.id} title={f.name} actions={<div className="flex gap-2"><StatusBadge status={f.status} /><Button size="sm" variant="outline" onClick={() => setEdit(f)}>Edit</Button></div>}
          description={f.status_reason || (f.pending_changes ? 'Changes waiting for FARMDirect approval' : undefined)}>
          <div className="grid gap-4 lg:grid-cols-2">
            <div><p className="mb-1 text-sm font-semibold">Rate card</p><RatesEditor facility={f} onSaved={fac.reload} /></div>
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Documents</p>
              <ul>{f.documents.map((d: any) => <li key={d.id}>{d.doc_type.replace('_', ' ')} · {fmtDate(d.created_at)}</li>)}</ul>
              <form className="flex flex-wrap items-center gap-2" onSubmit={async (e: any) => {
                e.preventDefault(); const fd = new FormData(e.target);
                act(() => api.post(`/v1/storage/provider/facilities/${f.id}/documents`, fd), 'Uploaded');
              }}>
                <select name="doc_type" className="rounded border p-1" aria-label="Document type">{['authorization_proof', 'license', 'insurance', 'operator_id', 'photo', 'bank_proof', 'other'].map((d) => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}</select>
                <input type="file" name="file" accept="image/*,application/pdf" required aria-label="File" />
                <Button type="submit" size="sm" variant="outline">Upload</Button>
              </form>
              {(['draft', 'rejected'].includes(f.status) || f.pending_changes) && <Button size="sm" onClick={() => act(() => api.post(`/v1/storage/provider/facilities/${f.id}/submit`), 'Submitted for verification')}>Submit for verification</Button>}
              {f.application && <p className="text-xs text-gray-500">Last application: {f.application.status}{f.application.decision_reason && ` – ${f.application.decision_reason}`}</p>}
              <Button size="sm" variant="outline" onClick={() => {
                const s = reasonPrompt('Unavailable from (YYYY-MM-DD)'); const e2 = reasonPrompt('Until (YYYY-MM-DD)'); const q2 = reasonPrompt('Capacity unavailable (quintal)');
                if (s && e2 && q2) act(() => api.post(`/v1/storage/provider/facilities/${f.id}/blackouts`, { start_date: s, end_date: e2, capacity_reduction_qtl: Number(q2), reason: 'Maintenance' }), 'Unavailable period added');
              }}>Add maintenance period</Button>
              <Button size="sm" variant="outline" onClick={() => { const d = reasonPrompt('Describe the incident'); if (d) act(() => api.post(`/v1/storage/provider/facilities/${f.id}/incidents`, { severity: 'medium', description: d }), 'Incident recorded; affected farmers notified'); }}>Report incident</Button>
            </div>
          </div>
        </Section>
      )))}
      {tab === 'enquiries' && (enq.loading ? <Skeleton /> : !enq.data?.length ? <Empty title="No enquiries" /> : (
        <Section><ul className="divide-y text-sm">{enq.data.map((e: any) => (
          <li key={e.id} className="py-2"><p><b>{e.full_name}</b> ({e.facility_name}): {e.message}</p>
            {e.reply ? <p className="text-gray-600">Reply: {e.reply}</p> : <Button size="sm" variant="outline" onClick={() => { const t = reasonPrompt('Your reply'); if (t) act(async () => { await api.post(`/v1/storage/provider/enquiries/${e.id}/reply`, { reply: t }); enq.reload(); }, 'Reply sent'); }}>Reply</Button>}
          </li>))}</ul></Section>
      ))}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'Add facility' : 'Edit facility'} wide>
        {edit && <FacilityForm initial={edit === 'new' ? undefined : edit} onSaved={() => { setEdit(null); fac.reload(); }} />}
      </Modal>
      <Modal open={!!recv} onClose={() => setRecv(null)} title={`Record arrival – ${recv?.booking_ref ?? ''}`}>
        {recv && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => api.post(`/v1/storage/provider/bookings/${recv.id}/receive`, { received_qty_qtl: Number(rform.received_qty_qtl), condition_notes: rform.condition_notes, moisture_pct: rform.moisture_pct ? Number(rform.moisture_pct) : null, quality_notes: rform.quality_notes || null, bin_ref: rform.bin_ref || null }), 'Receipt issued').then(() => setRecv(null)); }}>
            <Field label={`Quantity received (quintal, booked ${recv.quantity_qtl})`} required>{(id) => <Input id={id} type="number" min="0" step="0.01" value={rform.received_qty_qtl} onChange={(e) => setRform({ ...rform, received_qty_qtl: e.target.value })} required />}</Field>
            <Field label="Condition observed" required>{(id) => <Textarea id={id} value={rform.condition_notes} onChange={(e) => setRform({ ...rform, condition_notes: e.target.value })} required />}</Field>
            <div className="grid grid-cols-2 gap-2"><Field label="Moisture %">{(id) => <Input id={id} type="number" min="0" max="100" value={rform.moisture_pct} onChange={(e) => setRform({ ...rform, moisture_pct: e.target.value })} />}</Field><Field label="Bin / location">{(id) => <Input id={id} value={rform.bin_ref} onChange={(e) => setRform({ ...rform, bin_ref: e.target.value })} />}</Field></div>
            <Field label="Quality notes">{(id) => <Input id={id} value={rform.quality_notes} onChange={(e) => setRform({ ...rform, quality_notes: e.target.value })} />}</Field>
            <p className="text-xs text-gray-500">The receipt is recorded with your account and the time. Add photos from the booking page after saving.</p>
            <Button type="submit" className="w-full">Issue receipt</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

// ---------------- Transport provider workspace ----------------
export function TransportProviderPage() {
  const toast = useToast();
  const prof = useAsync(() => api.get('/v1/transport/provider/profile'));
  const reqs = useAsync(() => api.get('/v1/transport/provider/requests'));
  const [f, setF] = useState<any>(null);
  useEffect(() => {
    const p = prof.data?.provider;
    if (prof.data && !f) setF(p ? { ...p, vehicle_types: p.vehicle_types, service_states: (p.service_states || []).join(', ') } : { name: '', phone: '', vehicle_types: ['truck'], capacity_tonnes: '', service_states: '', rate_per_km: '', min_charge: '', license_info: '' });
  }, [prof.data, f]);
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); prof.reload(); reqs.reload(); } catch (e: any) { toast(e.message, 'error'); } };
  if (prof.loading || !f) return <Skeleton lines={6} />;
  const p = prof.data.provider;
  return (
    <div className="space-y-4">
      <PageHeader title="Transport provider" icon={<Warehouse />} subtitle={p ? <span className="flex items-center gap-2"><StatusBadge status={p.status} />{p.status_reason}</span> : 'Create your profile to receive transport requests'} />
      <Section title="Profile">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); act(() => api.put('/v1/transport/provider/profile', { ...f, capacity_tonnes: Number(f.capacity_tonnes), rate_per_km: f.rate_per_km ? Number(f.rate_per_km) : null, min_charge: f.min_charge ? Number(f.min_charge) : null, service_states: String(f.service_states || '').split(',').map((s: string) => s.trim()).filter(Boolean), service_districts: [] }), 'Profile saved'); }}>
          <Field label="Business / your name" required>{(id) => <Input id={id} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />}</Field>
          <Field label="Phone">{(id) => <Input id={id} value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} />}</Field>
          <Field label="Vehicle types">{(id) => <select id={id} multiple className="h-24 w-full rounded-lg border p-2" value={f.vehicle_types} onChange={(e) => setF({ ...f, vehicle_types: Array.from(e.target.selectedOptions).map((o) => o.value) })}>{['mini_truck', 'pickup', 'tractor_trolley', 'truck', 'reefer_truck', 'other'].map((v) => <option key={v}>{v}</option>)}</select>}</Field>
          <Field label="Capacity (tonnes)" required>{(id) => <Input id={id} type="number" min="0.1" step="0.1" value={f.capacity_tonnes} onChange={(e) => setF({ ...f, capacity_tonnes: e.target.value })} required />}</Field>
          <Field label="Rate ₹/km">{(id) => <Input id={id} type="number" min="0" value={f.rate_per_km ?? ''} onChange={(e) => setF({ ...f, rate_per_km: e.target.value })} />}</Field>
          <Field label="Minimum charge ₹">{(id) => <Input id={id} type="number" min="0" value={f.min_charge ?? ''} onChange={(e) => setF({ ...f, min_charge: e.target.value })} />}</Field>
          <Field label="States served (comma separated)">{(id) => <Input id={id} value={f.service_states} onChange={(e) => setF({ ...f, service_states: e.target.value })} />}</Field>
          <Field label="Licence / permit details">{(id) => <Input id={id} value={f.license_info ?? ''} onChange={(e) => setF({ ...f, license_info: e.target.value })} />}</Field>
          <div className="flex justify-end sm:col-span-2"><Button type="submit">Save profile</Button></div>
        </form>
        {p && (
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold">Documents ({prof.data.documents.length})</p>
            <form className="flex flex-wrap items-center gap-2" onSubmit={(e: any) => { e.preventDefault(); act(() => api.post('/v1/transport/provider/documents', new FormData(e.target)), 'Uploaded'); }}>
              <select name="doc_type" className="rounded border p-1" aria-label="Document type">{['vehicle_rc', 'driving_licence', 'permit', 'insurance', 'operator_id', 'other'].map((d) => <option key={d} value={d}>{d.replace('_', ' ')}</option>)}</select>
              <input type="file" name="file" accept="image/*,application/pdf" required aria-label="File" />
              <Button type="submit" size="sm" variant="outline">Upload</Button>
            </form>
            {p.status !== 'verified' && <Button size="sm" onClick={() => act(() => api.post('/v1/transport/provider/submit'), 'Submitted for verification')}>Submit for verification</Button>}
          </div>
        )}
      </Section>
      {reqs.data?.verified ? (
        <>
          <Section title="Open requests">
            {!reqs.data.open.length ? <p className="text-sm text-gray-500">No open requests.</p> : <ul className="divide-y text-sm">{reqs.data.open.map((t: any) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{t.pickup_address} → {t.drop_address} · {t.quantity_qtl} qtl · {fmtDate(t.preferred_date)}{t.distance_km && ` · ~${t.distance_km} km`}</span>
                <Button size="sm" variant="outline" onClick={() => { const amt = window.prompt(`Your quote in ₹${t.my_quote ? ` (current ${t.my_quote})` : ''}`); if (amt) act(() => api.post(`/v1/transport/provider/requests/${t.id}/quotes`, { amount: Number(amt), eta_date: t.preferred_date }), 'Quote sent'); }}>{t.my_quote ? 'Update quote' : 'Quote'}</Button>
              </li>))}</ul>}
          </Section>
          <Section title="My jobs">
            {!reqs.data.assigned.length ? <p className="text-sm text-gray-500">No accepted jobs.</p> : <ul className="divide-y text-sm">{reqs.data.assigned.map((t: any) => (
              <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>{t.pickup_address} → {t.drop_address} · <StatusBadge status={t.status} /></span>
                <span className="flex gap-1">{['picked_up', 'in_transit', 'delivered', 'exception'].map((ev) => <Button key={ev} size="sm" variant="outline" onClick={() => act(() => api.post(`/v1/transport/provider/requests/${t.id}/milestones`, { event: ev }), 'Updated')}>{ev.replace('_', ' ')}</Button>)}</span>
              </li>))}</ul>}
          </Section>
        </>
      ) : <Notice>Requests appear here after FARMDirect verifies your profile and documents.</Notice>}
    </div>
  );
}

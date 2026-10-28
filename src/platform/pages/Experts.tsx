import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Contact, MapPin, Phone, Plus } from 'lucide-react';
import { api, fmtDateTime, qs } from '../api';
import { useAuth } from '../auth';
import {
  Badge, Button, Empty, ErrorBox, Field, INDIAN_STATES, Input, Modal, Notice, PageHeader, Section, Select, Skeleton, Tabs, Textarea, useAsync, useToast,
} from '../ui';
import { CropSelect, STATUS_TONE, useCropName } from '../shared';

const PROVIDER_CATS = [
  ['agronomist', 'Agronomists'], ['soil_lab', 'Soil testing labs'], ['input_dealer', 'Input dealers'], ['irrigation', 'Irrigation services'],
  ['equipment_rental', 'Equipment rental'], ['custom_hiring', 'Custom hiring centres'], ['drone', 'Drone services'], ['training', 'Training centres'], ['warehouse', 'Warehouses / storage'],
].map(([value, label]) => ({ value, label }));

export function ExpertsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const cropName = useCropName();
  const [tab, setTab] = useState<'ask' | 'directory' | 'listing'>('ask');
  const cases = useAsync(() => api.get('/v1/cases').then((r) => r.cases));
  const [f, setF] = useState({ category: '', state: user?.state || '', district: '' });
  const [near, setNear] = useState<{ lat: number; lon: number } | null>(null);
  const providers = useAsync(() => api.get(`/v1/providers${qs({ ...f, ...(near || {}) })}`).then((r) => r.providers), [f, near]);
  const mine = useAsync(() => api.get('/v1/providers/mine').then((r) => r.providers));
  const [ask, setAsk] = useState({ question: '', crop_id: '', urgency: 'normal', allow_contact: false });
  const [contact, setContact] = useState<any>(null);
  const [msg, setMsg] = useState(''); const [sharePhone, setSharePhone] = useState(false);
  const [listing, setListing] = useState<any>(null);

  const submitAsk = async (e: FormEvent) => {
    e.preventDefault();
    try { await api.post('/v1/cases', { ...ask, crop_id: ask.crop_id || null }); toast('Question sent to experts'); setAsk({ question: '', crop_id: '', urgency: 'normal', allow_contact: false }); cases.reload(); }
    catch (err: any) { toast(err.message, 'error'); }
  };

  return (
    <div>
      <PageHeader title="Experts & Services" icon={<Contact />} subtitle="Ask verified agronomists and find verified local service providers" />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'ask', label: 'Ask an expert' }, { id: 'directory', label: 'Service directory' }, { id: 'listing', label: 'List my business' }]} />

      {tab === 'ask' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="New question">
            <form onSubmit={submitAsk} className="space-y-3">
              <Field label="Your question" required>{(id) => <Textarea id={id} rows={4} value={ask.question} onChange={(e) => setAsk({ ...ask, question: e.target.value })} required />}</Field>
              <Field label="Crop">{(id) => <CropSelect id={id} value={ask.crop_id} onChange={(v) => setAsk({ ...ask, crop_id: v })} />}</Field>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ask.urgency === 'urgent'} onChange={(e) => setAsk({ ...ask, urgency: e.target.checked ? 'urgent' : 'normal' })} />Urgent</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={ask.allow_contact} onChange={(e) => setAsk({ ...ask, allow_contact: e.target.checked })} />Experts may see my phone number</label>
              <p className="text-xs text-gray-500">For a photo-based question, use Crop Doctor and press "Ask an expert" on the result.</p>
              <Button type="submit">Send</Button>
            </form>
          </Section>
          <Section title="My questions">
            {cases.loading ? <Skeleton /> : !cases.data?.length ? <Empty title="No questions yet" /> : (
              <ul className="divide-y">
                {cases.data.map((c: any) => (
                  <li key={c.id}><Link to={`/experts/cases/${c.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-gray-50">
                    <span className="truncate">{c.question}<span className="block text-xs text-gray-500">{c.crop_id && `${cropName(c.crop_id)} · `}{fmtDateTime(c.updated_at)}</span></span>
                    <Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>
                  </Link></li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {tab === 'directory' && (
        <div className="space-y-4">
          <Section>
            <div className="grid gap-2 sm:grid-cols-4">
              <Select aria-label="Service" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={PROVIDER_CATS} placeholder="All services" />
              <Select aria-label="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} options={INDIAN_STATES} placeholder="All states" />
              <Input aria-label="District" value={f.district} onChange={(e) => setF({ ...f, district: e.target.value })} placeholder="District" />
              <Button variant="outline" onClick={() => navigator.geolocation?.getCurrentPosition((p) => setNear({ lat: p.coords.latitude, lon: p.coords.longitude }), () => toast('Location denied', 'error'))}><MapPin className="mr-1 h-4 w-4" />Sort by distance</Button>
            </div>
          </Section>
          {providers.loading ? <Skeleton /> : providers.error ? <ErrorBox error={providers.error} /> : !providers.data?.length ? (
            <Empty title="No verified providers here yet">Only providers verified by our team are listed. Know a good one? Ask them to list their business.</Empty>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {providers.data.map((p: any) => (
                <Section key={p.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div><p className="font-semibold">{p.name}</p><p className="text-xs text-gray-500">{PROVIDER_CATS.find((c) => c.value === p.category)?.label} · {p.district}, {p.state}</p></div>
                    <Badge tone="green">Verified</Badge>
                  </div>
                  {p.description && <p className="mt-2 text-sm text-gray-700">{p.description}</p>}
                  <div className="mt-2 space-y-0.5 text-xs text-gray-600">
                    {p.address && <p>{p.address}</p>}{p.availability && <p>Availability: {p.availability}</p>}
                    {p.distance_km != null && <p>{p.distance_km} km away</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.phone && <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm"><Phone className="h-4 w-4" />Call</a>}
                    <Button size="sm" variant="outline" onClick={() => { setContact(p); setMsg(''); }}>Send request</Button>
                  </div>
                </Section>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'listing' && (
        <Section title="My business listings" actions={<Button size="sm" onClick={() => setListing({ name: '', category: 'input_dealer', state: user?.state || '', district: user?.district || '' })}><Plus className="mr-1 h-4 w-4" />Apply</Button>}>
          <Notice>Listings are reviewed by our team before they appear in the directory. Editing a listing sends it back for review.</Notice>
          <ul className="mt-3 divide-y">
            {(mine.data || []).map((p: any) => (
              <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                <span>{p.name} <span className="text-xs text-gray-500">{p.district}, {p.state}</span></span>
                <Badge tone={p.verification_status === 'verified' ? 'green' : p.verification_status === 'rejected' ? 'red' : 'amber'}>{p.verification_status}</Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Modal open={!!contact} onClose={() => setContact(null)} title={`Contact ${contact?.name ?? ''}`}>
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          try { await api.post(`/v1/providers/${contact.id}/contact`, { message: msg, share_phone: sharePhone }); toast('Request sent'); setContact(null); }
          catch (err: any) { toast(err.message, 'error'); }
        }}>
          <Textarea aria-label="Message" value={msg} onChange={(e) => setMsg(e.target.value)} required placeholder="What do you need?" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sharePhone} onChange={(e) => setSharePhone(e.target.checked)} />Share my phone number with this provider</label>
          <div className="flex justify-end"><Button type="submit">Send</Button></div>
        </form>
      </Modal>

      <Modal open={!!listing} onClose={() => setListing(null)} title="List your business" wide>
        {listing && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            const body = Object.fromEntries(Object.entries(listing).map(([k, v]) => [k, v === '' ? null : v]));
            try { await api.post('/v1/providers', body); toast('Submitted for verification'); setListing(null); mine.reload(); }
            catch (err: any) { toast(err.message, 'error'); }
          }}>
            <Field label="Business name" required>{(id) => <Input id={id} value={listing.name} onChange={(e) => setListing({ ...listing, name: e.target.value })} required />}</Field>
            <Field label="Service">{(id) => <Select id={id} value={listing.category} onChange={(e) => setListing({ ...listing, category: e.target.value })} options={PROVIDER_CATS} />}</Field>
            <Field label="State" required>{(id) => <Select id={id} value={listing.state} onChange={(e) => setListing({ ...listing, state: e.target.value })} options={INDIAN_STATES} placeholder="Select" required />}</Field>
            <Field label="District" required>{(id) => <Input id={id} value={listing.district} onChange={(e) => setListing({ ...listing, district: e.target.value })} required />}</Field>
            <Field label="Phone">{(id) => <Input id={id} value={listing.phone || ''} onChange={(e) => setListing({ ...listing, phone: e.target.value })} />}</Field>
            <Field label="Licence / registration no.">{(id) => <Input id={id} value={listing.license_no || ''} onChange={(e) => setListing({ ...listing, license_no: e.target.value })} />}</Field>
            <Field label="Address">{(id) => <Input id={id} value={listing.address || ''} onChange={(e) => setListing({ ...listing, address: e.target.value })} />}</Field>
            <Field label="Availability">{(id) => <Input id={id} value={listing.availability || ''} onChange={(e) => setListing({ ...listing, availability: e.target.value })} placeholder="e.g. Mon–Sat 9am–6pm" />}</Field>
            <div className="sm:col-span-2"><Field label="Description">{(id) => <Textarea id={id} value={listing.description || ''} onChange={(e) => setListing({ ...listing, description: e.target.value })} />}</Field></div>
            <div className="flex justify-end sm:col-span-2"><Button type="submit">Submit</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function CaseDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const r = useAsync(() => api.get(`/v1/cases/${id}`), [id]);
  const [reply, setReply] = useState('');
  if (r.loading) return <Skeleton lines={6} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const c = r.data.case;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Expert question" subtitle={fmtDateTime(c.created_at)} actions={<Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>} />
      <Section>
        <p className="whitespace-pre-wrap">{c.question}</p>
        <p className="mt-2 text-xs text-gray-500">{[c.crop_name, c.village, c.district, c.state].filter(Boolean).join(' · ')} {c.urgency === 'urgent' && <Badge tone="red">urgent</Badge>}</p>
        {r.data.diagnosis && <Link to={`/crop-doctor/${r.data.diagnosis.id}`} className="mt-2 inline-block text-sm text-emerald-700 underline">View attached Crop Doctor result</Link>}
      </Section>
      <Section title="Conversation">
        {r.data.events.length === 0 ? <p className="text-sm text-gray-500">Waiting for an expert to respond.</p> : (
          <ul className="space-y-3">
            {r.data.events.map((e: any) => (
              <li key={e.id} className={`rounded-xl p-3 text-sm ${e.actor_role === 'farmer' ? 'bg-gray-50' : 'bg-emerald-50'}`}>
                <p className="text-xs font-semibold">{e.actor_name}{e.actor_role !== 'farmer' && ` (${e.actor_role.replace('_', ' ')})`} · {e.kind.replace('_', ' ')} · {fmtDateTime(e.created_at)}</p>
                <p className="mt-1 whitespace-pre-wrap">{e.body}</p>
              </li>
            ))}
          </ul>
        )}
        {c.status !== 'closed' && (
          <form className="mt-3 space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            try { await api.post(`/v1/cases/${c.id}/reply`, { body: reply }); setReply(''); r.reload(); } catch (err: any) { toast(err.message, 'error'); }
          }}>
            <Textarea aria-label="Reply" value={reply} onChange={(e) => setReply(e.target.value)} required placeholder="Add details or reply…" />
            <div className="flex justify-between">
              {c.farmer_id === user?.id ? <Button type="button" variant="outline" onClick={async () => { await api.post(`/v1/cases/${c.id}/close`); r.reload(); }}>Mark resolved</Button> : <span />}
              <Button type="submit">Send</Button>
            </div>
          </form>
        )}
      </Section>
    </div>
  );
}

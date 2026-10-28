import { useState } from 'react';
import { Gauge } from 'lucide-react';
import { api, fmtDate, fmtDateTime, qs } from '../api';
import { useAuth } from '../auth';
import {
  Badge, Bars, Button, Empty, ErrorBox, Field, Input, INDIAN_STATES, Modal, PageHeader, Section, Select, Skeleton, Tabs, Textarea, useAsync, useToast,
} from '../ui';
import { AlertForm } from './ExpertDesk';
import { OpsAdmins, OpsAnalytics, OpsAudit, OpsDisputes, OpsFraud, OpsListings, OpsOrders, OpsPayments, OpsSettings, OpsStorage, OpsTransport, OpsVerifications } from './AdminOps';

const ROLES = ['farmer', 'expert', 'dealer', 'field_agent', 'fpo_manager', 'content_editor', 'admin', 'super_admin'];
type Tab = 'overview' | 'users' | 'verify' | 'content' | 'schemes' | 'products' | 'alerts' | 'moderation' | 'reports' | 'integrations' | 'audit';

function Stat({ label, value }: { label: string; value: any }) {
  return <div className="rounded-xl border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold">{value ?? '–'}</p></div>;
}

function Overview() {
  const s = useAsync(() => api.get('/v1/admin/stats'));
  if (s.loading) return <Skeleton lines={8} />;
  if (s.error) return <ErrorBox error={s.error} />;
  const d = s.data;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Users" value={d.users.total} /><Stat label="Active (7 days)" value={d.users.active7d} />
        <Stat label="Pending verification" value={d.users.pendingVerification} /><Stat label="Open expert cases" value={d.openCases} />
        <Stat label="AI requests (30d)" value={d.aiRequests} /><Stat label="Reported content" value={d.reportedContent} />
        <Stat label="Advisories awaiting review" value={d.dataFreshness.advisoriesPendingReview} /><Stat label="Schemes not re-checked" value={d.dataFreshness.schemesUnverified} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Registrations (30 days)"><Bars data={d.registrations.map((r: any) => ({ label: r.d.slice(8), value: r.n }))} color="#059669" /></Section>
        <Section title="Module usage (30 days)">{d.moduleUsage.length ? <Bars data={d.moduleUsage.map((m: any) => ({ label: m.module, value: m.n }))} /> : <p className="text-sm text-gray-500">No usage yet.</p>}</Section>
        <Section title="External API health (24h)">
          {d.apiHealth.length === 0 ? <p className="text-sm text-gray-500">No calls yet.</p> : (
            <table className="w-full text-sm"><thead className="text-left text-xs text-gray-500"><tr><th>Provider</th><th>OK</th><th>Failed</th><th>Avg ms</th><th>Last</th></tr></thead>
              <tbody>{d.apiHealth.map((a: any, i: number) => <tr key={i} className="border-t"><td>{a.provider}/{a.operation}</td><td>{a.ok}</td><td className={a.failed ? 'text-red-700' : ''}>{a.failed}</td><td>{a.avg_ms}</td><td className="text-xs">{fmtDateTime(a.last)}</td></tr>)}</tbody></table>
          )}
        </Section>
        <Section title="Data freshness & delivery">
          <ul className="space-y-1 text-sm">
            <li>Mandi prices last fetched: {fmtDateTime(d.dataFreshness.marketLastFetch)}</li>
            <li>Weather last fetched: {fmtDateTime(d.dataFreshness.weatherLastFetch)}</li>
            <li>Diagnoses: {d.diagnosisOutcomes.map((x: any) => `${x.status} ${x.n}`).join(', ') || 'none'}</li>
            <li>Notifications (7d): {d.notificationDelivery.map((x: any) => `${x.channel}/${x.status} ${x.n}`).join(', ') || 'none'}</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}

function Users() {
  const toast = useToast();
  const { user: me } = useAuth();
  const [f, setF] = useState({ q: '', role: '', status: '', verification: '' });
  const r = useAsync(() => api.get(`/v1/admin/users${qs(f)}`), [f]);
  const update = async (id: string, patch: any) => { try { await api.patch(`/v1/admin/users/${id}`, patch); toast('Updated'); r.reload(); } catch (e: any) { toast(e.message, 'error'); } };
  return (
    <Section>
      <div className="mb-3 grid gap-2 sm:grid-cols-4">
        <Input aria-label="Search users" placeholder="Name or phone" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        <Select aria-label="Role" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} options={ROLES.map((x) => ({ value: x, label: x }))} placeholder="All roles" />
        <Select aria-label="Status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={['active', 'suspended'].map((x) => ({ value: x, label: x }))} placeholder="Any status" />
        <Select aria-label="Verification" value={f.verification} onChange={(e) => setF({ ...f, verification: e.target.value })} options={['pending', 'verified', 'rejected', 'not_required'].map((x) => ({ value: x, label: x }))} placeholder="Any verification" />
      </div>
      {r.loading ? <Skeleton /> : r.error ? <ErrorBox error={r.error} /> : (
        <div className="overflow-x-auto">
          <p className="mb-2 text-xs text-gray-500">{r.data.total} users</p>
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="p-2">User</th><th className="p-2">Role</th><th className="p-2">Verification</th><th className="p-2">Status</th><th className="p-2">Joined</th></tr></thead>
            <tbody>
              {r.data.users.map((u: any) => (
                <tr key={u.id} className="border-t">
                  <td className="p-2"><p className="font-medium">{u.full_name}</p><p className="text-xs text-gray-500">{u.phone} · {[u.district, u.state].filter(Boolean).join(', ')}</p></td>
                  <td className="p-2"><Select aria-label="Role" value={u.role} disabled={u.id === me?.id} onChange={(e) => update(u.id, { role: e.target.value })} options={ROLES.map((x) => ({ value: x, label: x }))} className="py-1 text-sm" /></td>
                  <td className="p-2">
                    {u.verification_status === 'pending' ? (
                      <div className="flex gap-1"><Button size="sm" onClick={() => update(u.id, { verification_status: 'verified' })}>Verify</Button><Button size="sm" variant="outline" onClick={() => update(u.id, { verification_status: 'rejected' })}>Reject</Button></div>
                    ) : <Badge tone={u.verification_status === 'verified' ? 'green' : u.verification_status === 'rejected' ? 'red' : 'gray'}>{u.verification_status}</Badge>}
                  </td>
                  <td className="p-2">{u.id !== me?.id && <Button size="sm" variant={u.status === 'active' ? 'outline' : 'default'} onClick={() => update(u.id, { status: u.status === 'active' ? 'suspended' : 'active' })}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</Button>}</td>
                  <td className="p-2 text-xs">{fmtDate(u.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

function Verify() {
  const toast = useToast();
  const p = useAsync(() => api.get('/v1/admin/providers?status=pending').then((r) => r.providers));
  return (
    <Section title="Service providers awaiting verification" description="Check licences and contact details before verifying. Professional user accounts are verified from the Users tab.">
      {p.loading ? <Skeleton /> : !p.data?.length ? <Empty title="Nothing pending" /> : (
        <ul className="divide-y">
          {p.data.map((x: any) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <div><p className="font-medium">{x.name} <Badge>{x.category}</Badge></p><p className="text-xs text-gray-500">{x.district}, {x.state} · {x.phone || 'no phone'} · licence {x.license_no || '—'} · by {x.owner_name}</p>{x.description && <p className="text-xs">{x.description}</p>}</div>
              <div className="flex gap-1">
                <Button size="sm" onClick={async () => { await api.post(`/v1/admin/providers/${x.id}/verify`, { decision: 'verified' }); toast('Verified'); p.reload(); }}>Verify</Button>
                <Button size="sm" variant="outline" onClick={async () => { await api.post(`/v1/admin/providers/${x.id}/verify`, { decision: 'rejected' }); p.reload(); }}>Reject</Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

const EMPTY_CONTENT = { type: 'article', title: '', summary: '', body: '', media_url: '', transcript: '', language: 'en', source_name: '', source_url: '', license: '', event_date: '', event_location: '', safety_critical: false, crop_ids: [] as string[], regions: [] as string[], tags: [] as string[] };

function Content() {
  const toast = useToast();
  const list = useAsync(() => api.get('/v1/content/manage').then((r) => r.items));
  const [edit, setEdit] = useState<any>(null);
  const save = async () => {
    const body = Object.fromEntries(Object.entries(edit).filter(([k]) => !['id', 'status', 'author_id', 'created_at', 'updated_at', 'published_at', 'author_name', 'author_role', 'reading_minutes'].includes(k)).map(([k, v]) => [k, v === '' ? null : v]));
    try {
      if (edit.id) await api.patch(`/v1/content/${edit.id}`, body); else await api.post('/v1/content', body);
      toast('Saved as draft / sent back to review'); setEdit(null); list.reload();
    } catch (e: any) { toast(e.message, 'error'); }
  };
  const act = async (id: string, a: string) => { try { await api.post(`/v1/content/${id}/${a}`); toast(`Done: ${a}`); list.reload(); } catch (e: any) { toast(e.message, 'error'); } };
  return (
    <Section title="Knowledge, news & events" actions={<Button size="sm" onClick={() => setEdit({ ...EMPTY_CONTENT })}>New content</Button>}
      description="Workflow: draft → in review → published. Safety-critical content must be published by a verified expert or admin. Use only licensed media.">
      {list.loading ? <Skeleton /> : !list.data?.length ? <Empty title="No content yet" /> : (
        <ul className="divide-y">
          {list.data.map((c: any) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span><b>{c.title}</b> <Badge>{c.type}</Badge> <Badge tone={c.status === 'published' ? 'green' : c.status === 'in_review' ? 'amber' : 'gray'}>{c.status}</Badge>{c.safety_critical ? <Badge tone="red">safety-critical</Badge> : null}</span>
              <span className="flex gap-2 text-xs">
                <button className="underline" onClick={async () => setEdit((await api.get(`/v1/content/${c.id}`)).item)}>Edit</button>
                {c.status === 'draft' && <button className="underline" onClick={() => act(c.id, 'submit')}>Submit</button>}
                {c.status !== 'published' && <button className="text-emerald-700 underline" onClick={() => act(c.id, 'publish')}>Publish</button>}
                {c.status === 'published' && <button className="text-red-700 underline" onClick={() => act(c.id, 'archive')}>Archive</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Edit content' : 'New content'} wide>
        {edit && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Type">{(id) => <Select id={id} value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })} options={['article', 'guide', 'video', 'audio', 'infographic', 'news', 'event', 'success_story', 'webinar', 'training'].map((t) => ({ value: t, label: t }))} />}</Field>
            <Field label="Language">{(id) => <Select id={id} value={edit.language} onChange={(e) => setEdit({ ...edit, language: e.target.value })} options={['en', 'hi', 'te', 'ml'].map((t) => ({ value: t, label: t }))} />}</Field>
            <div className="sm:col-span-2"><Field label="Title" required>{(id) => <Input id={id} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} required />}</Field></div>
            <div className="sm:col-span-2"><Field label="Summary">{(id) => <Textarea id={id} value={edit.summary || ''} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} />}</Field></div>
            <div className="sm:col-span-2"><Field label="Body">{(id) => <Textarea id={id} rows={8} value={edit.body || ''} onChange={(e) => setEdit({ ...edit, body: e.target.value })} />}</Field></div>
            <Field label="Media URL (video/audio/image)">{(id) => <Input id={id} type="url" value={edit.media_url || ''} onChange={(e) => setEdit({ ...edit, media_url: e.target.value })} />}</Field>
            <Field label="Media licence">{(id) => <Input id={id} value={edit.license || ''} onChange={(e) => setEdit({ ...edit, license: e.target.value })} placeholder="e.g. CC BY 4.0, own work" />}</Field>
            <div className="sm:col-span-2"><Field label="Transcript / text alternative">{(id) => <Textarea id={id} value={edit.transcript || ''} onChange={(e) => setEdit({ ...edit, transcript: e.target.value })} />}</Field></div>
            <Field label="Source name">{(id) => <Input id={id} value={edit.source_name || ''} onChange={(e) => setEdit({ ...edit, source_name: e.target.value })} />}</Field>
            <Field label="Source URL">{(id) => <Input id={id} type="url" value={edit.source_url || ''} onChange={(e) => setEdit({ ...edit, source_url: e.target.value })} />}</Field>
            <Field label="Crop tags (comma separated ids)">{(id) => <Input id={id} value={(edit.crop_ids || []).join(',')} onChange={(e) => setEdit({ ...edit, crop_ids: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="paddy,cotton" />}</Field>
            <Field label="Regions (comma separated states)">{(id) => <Input id={id} value={(edit.regions || []).join(',')} onChange={(e) => setEdit({ ...edit, regions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />}</Field>
            {['event', 'webinar', 'training'].includes(edit.type) && <>
              <Field label="Event date">{(id) => <Input id={id} type="date" value={edit.event_date || ''} onChange={(e) => setEdit({ ...edit, event_date: e.target.value })} />}</Field>
              <Field label="Event location">{(id) => <Input id={id} value={edit.event_location || ''} onChange={(e) => setEdit({ ...edit, event_location: e.target.value })} />}</Field>
            </>}
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={!!edit.safety_critical} onChange={(e) => setEdit({ ...edit, safety_critical: e.target.checked })} />Safety-critical (crop protection, chemicals, or a translation of such content)</label>
            <div className="flex justify-end sm:col-span-2"><Button type="submit">Save</Button></div>
          </form>
        )}
      </Modal>
    </Section>
  );
}

function Schemes() {
  const toast = useToast();
  const list = useAsync(() => api.get('/v1/schemes').then((r) => r.schemes));
  const [form, setForm] = useState<any>(null);
  return (
    <Section title="Government schemes" actions={<Button size="sm" onClick={() => setForm({ name: '', department: '', level: 'state', state: '', scheme_type: 'subsidy', eligibility: '', benefits: '', documents: '', process: '', deadline: '', official_url: '' })}>Add scheme</Button>}
      description="After checking a scheme against its official website, press 'Mark checked' so farmers see the date.">
      <ul className="divide-y">
        {(list.data || []).map((s: any) => (
          <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span>{s.name} <Badge>{s.level}</Badge> {s.last_verified_at ? <Badge tone="green">checked {fmtDate(s.last_verified_at)}</Badge> : <Badge tone="amber">unchecked</Badge>}</span>
            <span className="flex gap-2 text-xs"><a className="underline" href={s.official_url} target="_blank" rel="noreferrer">Official site</a>
              <button className="text-emerald-700 underline" onClick={async () => { await api.post(`/v1/schemes/${s.id}/verify`); toast('Marked checked'); list.reload(); }}>Mark checked</button></span>
          </li>
        ))}
      </ul>
      <Modal open={!!form} onClose={() => setForm(null)} title="Add scheme" wide>
        {form && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]));
            try { await api.post('/v1/schemes', body); toast('Scheme added'); setForm(null); list.reload(); } catch (err: any) { toast(err.message, 'error'); }
          }}>
            <div className="sm:col-span-2"><Field label="Name" required>{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}</Field></div>
            <Field label="Department" required>{(id) => <Input id={id} value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} required />}</Field>
            <Field label="Level">{(id) => <Select id={id} value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} options={[{ value: 'central', label: 'Central' }, { value: 'state', label: 'State' }]} />}</Field>
            {form.level === 'state' && <Field label="State" required>{(id) => <Select id={id} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} options={INDIAN_STATES} placeholder="Select" required />}</Field>}
            <Field label="Type">{(id) => <Select id={id} value={form.scheme_type} onChange={(e) => setForm({ ...form, scheme_type: e.target.value })} options={['income_support', 'insurance', 'credit', 'irrigation', 'soil', 'market', 'subsidy', 'mechanisation', 'other'].map((t) => ({ value: t, label: t }))} />}</Field>
            <Field label="Official URL (.gov.in / .nic.in)" required>{(id) => <Input id={id} type="url" value={form.official_url} onChange={(e) => setForm({ ...form, official_url: e.target.value })} required />}</Field>
            <Field label="Deadline">{(id) => <Input id={id} value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />}</Field>
            {(['eligibility', 'benefits', 'documents', 'process'] as const).map((k) => (
              <div key={k} className="sm:col-span-2"><Field label={k[0].toUpperCase() + k.slice(1)} required={k === 'eligibility' || k === 'benefits'}>{(id) => <Textarea id={id} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} required={k === 'eligibility' || k === 'benefits'} />}</Field></div>
            ))}
            <div className="flex justify-end sm:col-span-2"><Button type="submit">Save</Button></div>
          </form>
        )}
      </Modal>
    </Section>
  );
}

function Products() {
  const toast = useToast();
  const { hasRole } = useAuth();
  const list = useAsync(() => api.get('/v1/products/manage').then((r) => r.products));
  const [form, setForm] = useState<any>(null);
  const [batch, setBatch] = useState<any>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  return (
    <Section title="Product catalogue" actions={<Button size="sm" onClick={() => setForm({ name: '', manufacturer: '', category: 'seeds', registration_no: '', registered_uses: '', label_info: '', safety: '', pack_sizes: '', documentation_url: '', data_source: '' })}>Add product</Button>}
      description="Only add products from manufacturer-supplied or officially published label data. Record where the data came from.">
      <ul className="divide-y">
        {(list.data || []).map((p: any) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
            <span><b>{p.name}</b> · {p.manufacturer} <Badge tone={p.status === 'published' ? 'green' : 'gray'}>{p.status}</Badge></span>
            <span className="flex gap-2 text-xs">
              {p.status !== 'published' && <button className="text-emerald-700 underline" onClick={async () => { await api.patch(`/v1/products/${p.id}`, { status: 'published' }); list.reload(); }}>Publish</button>}
              {p.status === 'published' && <button className="text-red-700 underline" onClick={async () => { await api.patch(`/v1/products/${p.id}`, { status: 'withdrawn' }); list.reload(); }}>Withdraw</button>}
              {p.status === 'published' && hasRole('admin') && <button className="underline" onClick={() => setBatch({ product_id: p.id, batch_no: '', issuer_name: p.manufacturer, mfg_date: '', expiry_date: '', count: 10 })}>Issue verification codes</button>}
            </span>
          </li>
        ))}
      </ul>
      <Modal open={!!form} onClose={() => setForm(null)} title="Add product" wide>
        {form && (
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
            e.preventDefault();
            const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v === '' ? null : v]));
            try { await api.post('/v1/products', body); toast('Saved as draft'); setForm(null); list.reload(); } catch (err: any) { toast(err.message, 'error'); }
          }}>
            <Field label="Name" required>{(id) => <Input id={id} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}</Field>
            <Field label="Manufacturer" required>{(id) => <Input id={id} value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} required />}</Field>
            <Field label="Category">{(id) => <Select id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={['seeds', 'fertilizer', 'crop_protection', 'biological', 'soil_health', 'irrigation', 'machinery', 'tools', 'other'].map((t) => ({ value: t, label: t }))} />}</Field>
            <Field label="Registration no. (CIB&RC / FCO etc.)">{(id) => <Input id={id} value={form.registration_no} onChange={(e) => setForm({ ...form, registration_no: e.target.value })} />}</Field>
            {(['registered_uses', 'label_info', 'safety'] as const).map((k) => <div key={k} className="sm:col-span-2"><Field label={k.replace('_', ' ')}>{(id) => <Textarea id={id} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />}</Field></div>)}
            <Field label="Pack sizes">{(id) => <Input id={id} value={form.pack_sizes} onChange={(e) => setForm({ ...form, pack_sizes: e.target.value })} />}</Field>
            <Field label="Official documentation URL">{(id) => <Input id={id} type="url" value={form.documentation_url} onChange={(e) => setForm({ ...form, documentation_url: e.target.value })} />}</Field>
            <div className="sm:col-span-2"><Field label="Data source" required hint="e.g. 'Label PDF supplied by manufacturer, 2026-10-01'">{(id) => <Input id={id} value={form.data_source} onChange={(e) => setForm({ ...form, data_source: e.target.value })} required />}</Field></div>
            <div className="flex justify-end sm:col-span-2"><Button type="submit">Save draft</Button></div>
          </form>
        )}
      </Modal>
      <Modal open={!!batch} onClose={() => { setBatch(null); setCodes(null); }} title="Issue verification codes">
        {codes ? (
          <div className="space-y-2">
            <p className="text-sm text-amber-800">Copy these now – they are not stored and cannot be shown again. Print each as a QR code on the pack.</p>
            <Textarea readOnly rows={10} value={codes.join('\n')} className="font-mono text-xs" />
            <Button onClick={() => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([codes.join('\n')], { type: 'text/plain' })); a.download = `codes-${batch.batch_no}.txt`; a.click(); }}>Download</Button>
          </div>
        ) : batch && (
          <form className="grid grid-cols-2 gap-3" onSubmit={async (e) => {
            e.preventDefault();
            try { const r = await api.post('/v1/verify/batches', { ...batch, count: Number(batch.count), mfg_date: batch.mfg_date || null, expiry_date: batch.expiry_date || null }); setCodes(r.codes); }
            catch (err: any) { toast(err.message, 'error'); }
          }}>
            <Field label="Batch no." required>{(id) => <Input id={id} value={batch.batch_no} onChange={(e) => setBatch({ ...batch, batch_no: e.target.value })} required />}</Field>
            <Field label="Number of codes">{(id) => <Input id={id} type="number" min="1" max="5000" value={batch.count} onChange={(e) => setBatch({ ...batch, count: e.target.value })} />}</Field>
            <Field label="Mfg date">{(id) => <Input id={id} type="date" value={batch.mfg_date} onChange={(e) => setBatch({ ...batch, mfg_date: e.target.value })} />}</Field>
            <Field label="Expiry date">{(id) => <Input id={id} type="date" value={batch.expiry_date} onChange={(e) => setBatch({ ...batch, expiry_date: e.target.value })} />}</Field>
            <div className="col-span-2"><Field label="Issuer (manufacturer authorising this batch)" required>{(id) => <Input id={id} value={batch.issuer_name} onChange={(e) => setBatch({ ...batch, issuer_name: e.target.value })} required />}</Field></div>
            <div className="col-span-2 flex justify-end"><Button type="submit">Generate</Button></div>
          </form>
        )}
      </Modal>
    </Section>
  );
}

function Moderation() {
  const q = useAsync(() => api.get('/v1/moderation/queue'));
  const act = async (type: string, id: string, action: string) => { await api.post(`/v1/moderation/${type}/${id}`, { action }); q.reload(); };
  if (q.loading) return <Skeleton />;
  if (q.error) return <ErrorBox error={q.error} />;
  const item = (type: string, x: any) => (
    <li key={x.id} className="py-2 text-sm">
      <p><b>{x.title || 'Comment'}</b> <span className="text-xs text-gray-500">by {x.author} · {fmtDateTime(x.created_at)}</span></p>
      <p className="text-gray-700">{x.body}</p>
      <div className="mt-1 flex gap-3 text-xs"><button className="text-emerald-700 underline" onClick={() => act(type, x.id, 'approve')}>Approve</button><button className="text-red-700 underline" onClick={() => act(type, x.id, 'hide')}>Hide</button></div>
    </li>
  );
  return (
    <div className="space-y-4">
      <Section title={`Held posts (${q.data.pendingPosts.length})`}><ul className="divide-y">{q.data.pendingPosts.map((x: any) => item('post', x))}</ul></Section>
      <Section title={`Held comments (${q.data.pendingComments.length})`}><ul className="divide-y">{q.data.pendingComments.map((x: any) => item('comment', x))}</ul></Section>
      <Section title={`Open reports (${q.data.reports.length})`}>
        <ul className="divide-y text-sm">{q.data.reports.map((r: any) => (
          <li key={r.id} className="py-2">{r.target_type} {r.target_id.slice(0, 8)} – {r.reason}
            {['post', 'comment'].includes(r.target_type) && <span className="ml-2 text-xs"><button className="text-red-700 underline" onClick={() => act(r.target_type, r.target_id, 'hide')}>Hide</button> <button className="underline" onClick={() => act(r.target_type, r.target_id, 'approve')}>Dismiss</button></span>}</li>
        ))}</ul>
      </Section>
    </div>
  );
}

function Reports() {
  const sus = useAsync(() => api.get('/v1/admin/suspicious-reports').then((r) => r.items));
  const fb = useAsync(() => api.get('/v1/admin/market-feedback').then((r) => r.items));
  const del = useAsync(() => api.get('/v1/admin/deletion-requests').then((r) => r.items));
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Section title="Suspicious product reports"><ul className="space-y-2 text-sm">{(sus.data || []).map((r: any) => <li key={r.id}><b>{r.product_name || 'Unknown product'}</b> – {r.description}<p className="text-xs text-gray-500">{r.where_bought} · {fmtDateTime(r.created_at)}</p></li>)}</ul>{!sus.data?.length && <p className="text-sm text-gray-500">None</p>}</Section>
      <Section title="Market data feedback"><ul className="space-y-2 text-sm">{(fb.data || []).map((r: any) => <li key={r.id}>{r.commodity} @ {r.market} ({r.arrival_date}): {r.message}</li>)}</ul>{!fb.data?.length && <p className="text-sm text-gray-500">None</p>}</Section>
      <Section title="Account deletions"><ul className="space-y-1 text-sm">{(del.data || []).map((r: any) => <li key={r.id}>{fmtDateTime(r.created_at)} – {r.status}{r.reason && `: ${r.reason}`}</li>)}</ul>{!del.data?.length && <p className="text-sm text-gray-500">None</p>}</Section>
    </div>
  );
}

function Integrations() {
  const r = useAsync(() => api.get('/v1/admin/integrations'));
  const toast = useToast();
  const [b, setB] = useState({ title: '', body: '', state: '' });
  return (
    <div className="space-y-4">
      <Section title="External services">
        {r.loading ? <Skeleton /> : (
          <ul className="divide-y text-sm">{r.data.integrations.map((i: any) => (
            <li key={i.name} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b>{i.name}</b>{i.env && <span className="ml-2 font-mono text-xs text-gray-500">{i.env}</span>}{i.note && <span className="block text-xs text-gray-500">{i.note}</span>}</span><Badge tone={i.configured ? 'green' : 'amber'}>{i.configured ? 'configured' : 'not configured'}</Badge></li>
          ))}</ul>
        )}
      </Section>
      <Section title="Broadcast in-app notification">
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={async (e) => {
          e.preventDefault();
          if (!confirm('Send this notification to all matching users?')) return;
          try { const res = await api.post('/v1/admin/broadcast', { ...b, state: b.state || null }); toast(`Sent to ${res.notified} users`); setB({ title: '', body: '', state: '' }); } catch (err: any) { toast(err.message, 'error'); }
        }}>
          <Input aria-label="Title" value={b.title} onChange={(e) => setB({ ...b, title: e.target.value })} placeholder="Title" required />
          <Input aria-label="Message" value={b.body} onChange={(e) => setB({ ...b, body: e.target.value })} placeholder="Message" required />
          <Select aria-label="State" value={b.state} onChange={(e) => setB({ ...b, state: e.target.value })} options={INDIAN_STATES} placeholder="All states" />
          <Button type="submit">Send</Button>
        </form>
      </Section>
    </div>
  );
}

function Audit() {
  const [offset, setOffset] = useState(0);
  const r = useAsync(() => api.get(`/v1/admin/audit?offset=${offset}`).then((x) => x.logs), [offset]);
  return (
    <Section title="Audit log">
      {r.loading ? <Skeleton /> : (
        <table className="min-w-full text-xs"><thead className="text-left text-gray-500"><tr><th className="p-1">Time</th><th className="p-1">Actor</th><th className="p-1">Action</th><th className="p-1">Target</th><th className="p-1">Detail</th></tr></thead>
          <tbody>{(r.data || []).map((l: any) => <tr key={l.id} className="border-t"><td className="p-1 whitespace-nowrap">{fmtDateTime(l.created_at)}</td><td className="p-1">{l.actor_name || '—'}</td><td className="p-1 font-mono">{l.action}</td><td className="p-1">{l.target_type} {l.target_id?.slice(0, 8)}</td><td className="p-1 font-mono">{l.detail}</td></tr>)}</tbody></table>
      )}
      <div className="mt-2 flex gap-2"><Button size="sm" variant="outline" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 100))}>Newer</Button><Button size="sm" variant="outline" disabled={(r.data?.length ?? 0) < 100} onClick={() => setOffset(offset + 100)}>Older</Button></div>
    </Section>
  );
}

type OpsTab = 'm_analytics' | 'm_verify' | 'm_listings' | 'm_orders' | 'm_storage' | 'm_transport' | 'm_payments' | 'm_disputes' | 'm_fraud' | 'm_rules' | 'm_admins' | 'm_audit';

export function AdminPage() {
  const { hasRole, can, user } = useAuth();
  const isAdmin = hasRole('admin');
  const isEditor = isAdmin || user?.role === 'content_editor';
  const anyVerify = ['verify.buyers', 'verify.farmers', 'verify.storage', 'verify.transport'].some(can);
  // Marketplace operations tabs, each gated by the permission the server enforces.
  const ops: { id: OpsTab; label: string; show: boolean }[] = [
    { id: 'm_analytics', label: 'Marketplace analytics', show: can('analytics.view') },
    { id: 'm_verify', label: 'Verifications', show: anyVerify },
    { id: 'm_listings', label: 'Listings & demand', show: can('listings.moderate') },
    { id: 'm_orders', label: 'Orders', show: can('orders.view') },
    { id: 'm_storage', label: 'Storage', show: can('verify.storage') || can('bookings.view') },
    { id: 'm_transport', label: 'Transport', show: can('verify.transport') },
    { id: 'm_payments', label: 'Payments', show: can('payments.view') },
    { id: 'm_disputes', label: 'Disputes', show: can('disputes.manage') },
    { id: 'm_fraud', label: 'Fraud & reports', show: can('fraud.review') },
    { id: 'm_rules', label: 'Fees & rules', show: can('settings.manage') || can('analytics.view') },
    { id: 'm_admins', label: 'Administrators', show: can('admins.manage') },
    { id: 'm_audit', label: 'Marketplace audit', show: can('audit.view') },
  ];
  const tabs: { id: Tab | OpsTab; label: string }[] = [
    ...ops.filter((o) => o.show).map(({ id, label }) => ({ id, label })),
    ...(isAdmin ? [{ id: 'overview' as Tab, label: 'Platform overview' }, { id: 'users' as Tab, label: 'Users' }, { id: 'verify' as Tab, label: 'Service providers' }] : []),
    ...(isEditor ? [{ id: 'content' as Tab, label: 'Content' }, { id: 'schemes' as Tab, label: 'Schemes' }, { id: 'products' as Tab, label: 'Products' }] : []),
    ...(isAdmin ? [{ id: 'alerts' as Tab, label: 'Alerts' }] : []), ...(isEditor ? [{ id: 'moderation' as Tab, label: 'Moderation' }] : []),
    ...(isAdmin ? [{ id: 'reports' as Tab, label: 'Reports' }, { id: 'integrations' as Tab, label: 'Integrations' }, { id: 'audit' as Tab, label: 'Audit log' }] : []),
  ];
  const [tab, setTab] = useState<Tab | OpsTab>(tabs[0]?.id ?? 'content');
  if (!tabs.length) return <Empty title="No administration areas are assigned to your role" />;
  return (
    <div>
      <PageHeader title="Admin Console" icon={<Gauge />} subtitle="Every action here is permission-checked on the server and recorded in the audit log" />
      <Tabs value={tab} onChange={setTab} tabs={tabs} />
      {tab === 'm_analytics' && <OpsAnalytics />}
      {tab === 'm_verify' && <OpsVerifications />}
      {tab === 'm_listings' && <OpsListings />}
      {tab === 'm_orders' && <OpsOrders />}
      {tab === 'm_storage' && <OpsStorage />}
      {tab === 'm_transport' && <OpsTransport />}
      {tab === 'm_payments' && <OpsPayments canReconcile={can('payments.reconcile')} />}
      {tab === 'm_disputes' && <OpsDisputes />}
      {tab === 'm_fraud' && <OpsFraud />}
      {tab === 'm_rules' && <OpsSettings canEdit={can('settings.manage')} />}
      {tab === 'm_admins' && <OpsAdmins />}
      {tab === 'm_audit' && <OpsAudit />}
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <Users />}
      {tab === 'verify' && <Verify />}
      {tab === 'content' && <Content />}
      {tab === 'schemes' && <Schemes />}
      {tab === 'products' && <Products />}
      {tab === 'alerts' && <Section title="Issue alert"><AlertForm onDone={() => {}} /></Section>}
      {tab === 'moderation' && <Moderation />}
      {tab === 'reports' && <Reports />}
      {tab === 'integrations' && <Integrations />}
      {tab === 'audit' && <Audit />}
    </div>
  );
}

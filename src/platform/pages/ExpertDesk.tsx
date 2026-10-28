import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api, fmtDateTime, today } from '../api';
import { useAuth } from '../auth';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Section, Select, Skeleton, Tabs, Textarea, useAsync, useToast, INDIAN_STATES } from '../ui';
import { CropSelect, STATUS_TONE } from '../shared';

export function AlertForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [a, setA] = useState<any>({ category: 'pest', severity: 'advisory', title: '', body: '', precautions: '', state: '', district: '', crop_id: '', source: '', source_url: '', expires_at: today() });
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v === '' ? null : v]));
      try { const r = await api.post('/v1/alerts', body); toast(r.duplicate ? 'An identical alert is already active' : `Alert issued to ${r.notified} users`, r.duplicate ? 'info' : 'ok'); onDone(); }
      catch (err: any) { toast(err.message, 'error'); }
    }}>
      <Field label="Category">{(id) => <Select id={id} value={a.category} onChange={(e) => setA({ ...a, category: e.target.value })} options={['pest', 'disease', 'heavy_rain', 'flood', 'drought', 'heat', 'wind', 'cold', 'other'].map((v) => ({ value: v, label: v.replace('_', ' ') }))} />}</Field>
      <Field label="Severity">{(id) => <Select id={id} value={a.severity} onChange={(e) => setA({ ...a, severity: e.target.value })} options={['info', 'advisory', 'warning', 'severe'].map((v) => ({ value: v, label: v }))} />}</Field>
      <div className="sm:col-span-2"><Field label="Title" required>{(id) => <Input id={id} value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} required />}</Field></div>
      <div className="sm:col-span-2"><Field label="What is happening" required>{(id) => <Textarea id={id} value={a.body} onChange={(e) => setA({ ...a, body: e.target.value })} required />}</Field></div>
      <div className="sm:col-span-2"><Field label="Precautions">{(id) => <Textarea id={id} value={a.precautions} onChange={(e) => setA({ ...a, precautions: e.target.value })} />}</Field></div>
      <Field label="State">{(id) => <Select id={id} value={a.state} onChange={(e) => setA({ ...a, state: e.target.value })} options={INDIAN_STATES} placeholder="All India" />}</Field>
      <Field label="District">{(id) => <Input id={id} value={a.district} onChange={(e) => setA({ ...a, district: e.target.value })} />}</Field>
      <Field label="Crop">{(id) => <CropSelect id={id} value={a.crop_id} onChange={(v) => setA({ ...a, crop_id: v })} />}</Field>
      <Field label="Expires on" required>{(id) => <Input id={id} type="date" value={a.expires_at} onChange={(e) => setA({ ...a, expires_at: e.target.value })} required />}</Field>
      <Field label="Source (who verified this)" required hint="e.g. IMD, KVK, State Agriculture Dept, field survey">{(id) => <Input id={id} value={a.source} onChange={(e) => setA({ ...a, source: e.target.value })} required />}</Field>
      <Field label="Source link">{(id) => <Input id={id} type="url" value={a.source_url} onChange={(e) => setA({ ...a, source_url: e.target.value })} />}</Field>
      <div className="flex justify-end sm:col-span-2"><Button type="submit">Issue alert</Button></div>
    </form>
  );
}

function CaseWork({ id, onChange }: { id: string; onChange: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const r = useAsync(() => api.get(`/v1/cases/${id}`), [id]);
  const [reply, setReply] = useState('');
  const [ev, setEv] = useState({ kind: 'observation', body: '', due_date: '' });
  const [review, setReview] = useState({ decision: 'confirmed', notes: '' });
  if (r.loading) return <Skeleton />;
  if (r.error) return <ErrorBox error={r.error} />;
  const c = r.data.case;
  const d = r.data.diagnosis;
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); r.reload(); onChange(); } catch (e: any) { toast(e.message, 'error'); } };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge>{c.urgency === 'urgent' && <Badge tone="red">urgent</Badge>}<span className="text-xs text-gray-500">{fmtDateTime(c.created_at)}</span></div>
      <p className="whitespace-pre-wrap">{c.question}</p>
      <p className="text-xs text-gray-600">Farmer: {c.farmer_name} {c.farmer_phone ? `· ${c.farmer_phone} (consented to contact)` : '· contact not permitted'} · {[c.crop_name, c.village, c.district, c.state].filter(Boolean).join(', ')}</p>
      <div className="flex flex-wrap gap-2">
        {['open', 'escalated'].includes(c.status) && <Button size="sm" onClick={() => act(() => api.post(`/v1/expert/cases/${c.id}/assign`), 'Assigned to you')}>Take this case</Button>}
        {c.status !== 'closed' && <Button size="sm" variant="outline" onClick={() => { const reason = prompt('Reason for escalation?'); if (reason) act(() => api.post(`/v1/expert/cases/${c.id}/escalate`, { reason }), 'Escalated'); }}>Escalate</Button>}
      </div>
      {d && (
        <div className="rounded-xl border p-3">
          <p className="text-sm font-semibold">Attached Crop Doctor result</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {d.image_path ? <img src={`/api/v1/diagnosis/${d.id}/image`} alt="Farmer's crop" className="rounded-lg" /> : <p className="text-sm text-gray-500">Photo deleted by farmer</p>}
            <div className="text-sm">
              <p>AI status: {d.status}</p>
              {d.result_json?.primary_issue && <p>AI suggestion: <b>{d.result_json.primary_issue.name}</b> ({Math.round(d.result_json.primary_issue.confidence * 100)}%)</p>}
              {d.result_json?.visual_symptoms?.length > 0 && <p className="text-xs text-gray-600">Symptoms: {d.result_json.visual_symptoms.join('; ')}</p>}
              {d.expert_status && d.expert_status !== 'requested' && <p className="mt-1">Reviewed: {d.expert_status} – {d.expert_notes}</p>}
            </div>
          </div>
          {d.user_id !== user?.id && (
            <form className="mt-3 grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); act(() => api.post(`/v1/expert/diagnoses/${d.id}/review`, review), 'Review saved'); }}>
              <Select aria-label="Decision" value={review.decision} onChange={(e) => setReview({ ...review, decision: e.target.value })} options={[{ value: 'confirmed', label: 'Confirm AI result' }, { value: 'corrected', label: 'Correct it' }]} />
              <Input aria-label="Expert notes" className="sm:col-span-2" value={review.notes} onChange={(e) => setReview({ ...review, notes: e.target.value })} placeholder="Your diagnosis and advice" required />
              <Button type="submit" size="sm">Save review</Button>
            </form>
          )}
        </div>
      )}
      <div>
        <p className="mb-2 text-sm font-semibold">Timeline</p>
        <ul className="space-y-2">
          {r.data.events.map((e: any) => (
            <li key={e.id} className="rounded-lg bg-gray-50 p-2 text-sm"><p className="text-xs text-gray-500">{e.actor_name} · {e.kind.replace('_', ' ')} · {fmtDateTime(e.created_at)}{e.due_date && ` · due ${e.due_date}`}</p><p className="whitespace-pre-wrap">{e.body}</p></li>
          ))}
        </ul>
      </div>
      {c.status !== 'closed' && (
        <>
          <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); act(async () => { await api.post(`/v1/cases/${c.id}/reply`, { body: reply }); setReply(''); }, 'Reply sent to farmer'); }}>
            <Textarea aria-label="Reply to farmer" value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the farmer (they will be notified)" required />
            <Button type="submit" size="sm">Send reply</Button>
          </form>
          <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); act(async () => { await api.post(`/v1/expert/cases/${c.id}/events`, { ...ev, due_date: ev.due_date || null }); setEv({ ...ev, body: '' }); }, 'Recorded'); }}>
            <Select aria-label="Record type" value={ev.kind} onChange={(e) => setEv({ ...ev, kind: e.target.value })} options={[{ value: 'observation', label: 'Observation' }, { value: 'field_visit', label: 'Field visit' }, { value: 'follow_up', label: 'Follow-up task' }]} />
            <Input aria-label="Details" className="sm:col-span-2" value={ev.body} onChange={(e) => setEv({ ...ev, body: e.target.value })} placeholder="Internal note (not sent to farmer)" required />
            {ev.kind === 'follow_up' ? <Input aria-label="Due date" type="date" value={ev.due_date} onChange={(e) => setEv({ ...ev, due_date: e.target.value })} /> : <Button type="submit" size="sm" variant="outline">Add</Button>}
            {ev.kind === 'follow_up' && <Button type="submit" size="sm" variant="outline" className="sm:col-span-4">Add follow-up</Button>}
          </form>
        </>
      )}
    </div>
  );
}

export function ExpertDeskPage() {
  const toast = useToast();
  const [tab, setTab] = useState<'cases' | 'advisory' | 'alerts' | 'followups'>('cases');
  const [status, setStatus] = useState('unresolved');
  const [mine, setMine] = useState(false);
  const cases = useAsync(() => api.get(`/v1/expert/cases?status=${status}${mine ? '&mine=1' : ''}`).then((r) => r.cases), [status, mine]);
  const followups = useAsync(() => (tab === 'followups' ? api.get('/v1/expert/follow-ups').then((r) => r.items) : Promise.resolve([])), [tab]);
  const pendingAdv = useAsync(() => (tab === 'advisory' ? api.get('/v1/advisory?').then((r) => r.advisories.filter((a: any) => a.review_status === 'needs_review').slice(0, 50)) : Promise.resolve([])), [tab]);
  const [open, setOpen] = useState<string | null>(null);
  const [adv, setAdv] = useState<any>({ crop_id: '', stage_key: '', topic: 'general', title: '', body: '', region: '', source_name: '', source_url: '' });
  const [alertOpen, setAlertOpen] = useState(false);

  return (
    <div>
      <PageHeader title="Expert Desk" icon={<ShieldCheck />} subtitle="Review farmer cases, confirm AI diagnoses, publish validated advisories and issue alerts. All actions are logged." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'cases', label: 'Cases' }, { id: 'followups', label: 'My follow-ups' }, { id: 'advisory', label: 'Advisories' }, { id: 'alerts', label: 'Issue alert' }]} />

      {tab === 'cases' && (
        <Section actions={<div className="flex gap-2">
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40" options={['unresolved', 'open', 'assigned', 'answered', 'escalated', 'closed'].map((s) => ({ value: s, label: s }))} />
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />Mine</label>
        </div>}>
          {cases.loading ? <Skeleton /> : cases.error ? <ErrorBox error={cases.error} /> : !cases.data?.length ? <Empty title="No cases" /> : (
            <ul className="divide-y">
              {cases.data.map((c: any) => (
                <li key={c.id}>
                  <button className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm hover:bg-gray-50" onClick={() => setOpen(c.id)}>
                    <span className="min-w-0"><span className="block truncate font-medium">{c.question}</span><span className="text-xs text-gray-500">{c.farmer_name} · {[c.crop_name, c.district, c.state].filter(Boolean).join(', ')} · {fmtDateTime(c.created_at)}{c.diagnosis_id && ' · 📷 photo'}</span></span>
                    <span className="flex gap-1">{c.urgency === 'urgent' && <Badge tone="red">urgent</Badge>}<Badge tone={STATUS_TONE[c.status]}>{c.status}</Badge></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === 'followups' && (
        <Section>{!followups.data?.length ? <Empty title="No open follow-ups" /> : (
          <ul className="divide-y text-sm">{followups.data.map((f: any) => <li key={f.id} className="py-2"><button className="text-left hover:underline" onClick={() => setOpen(f.case_id)}><b>{f.due_date || 'No date'}</b> – {f.body}<span className="block text-xs text-gray-500">{f.question}</span></button></li>)}</ul>
        )}</Section>
      )}

      {tab === 'advisory' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section title="Publish a new advisory" description="New advisories start as 'needs review'. A different verified expert or an admin approves them.">
            <form className="space-y-3" onSubmit={async (e) => {
              e.preventDefault();
              const body = Object.fromEntries(Object.entries(adv).map(([k, v]) => [k, v === '' ? null : v]));
              try { await api.post('/v1/advisory', body); toast('Advisory submitted for review'); setAdv({ ...adv, title: '', body: '' }); pendingAdv.reload(); }
              catch (err: any) { toast(err.message, 'error'); }
            }}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Crop">{(id) => <CropSelect id={id} value={adv.crop_id} onChange={(v) => setAdv({ ...adv, crop_id: v })} />}</Field>
                <Field label="Stage key">{(id) => <Input id={id} value={adv.stage_key} onChange={(e) => setAdv({ ...adv, stage_key: e.target.value })} placeholder="e.g. flowering" />}</Field>
                <Field label="Topic">{(id) => <Select id={id} value={adv.topic} onChange={(e) => setAdv({ ...adv, topic: e.target.value })} options={['general', 'soil', 'irrigation', 'nutrient', 'weed', 'pest', 'disease', 'harvest', 'post_harvest', 'sustainability'].map((t) => ({ value: t, label: t }))} />}</Field>
                <Field label="Region (state)">{(id) => <Select id={id} value={adv.region} onChange={(e) => setAdv({ ...adv, region: e.target.value })} options={INDIAN_STATES} placeholder="General" />}</Field>
              </div>
              <Field label="Title" required>{(id) => <Input id={id} value={adv.title} onChange={(e) => setAdv({ ...adv, title: e.target.value })} required />}</Field>
              <Field label="Guidance" required hint="Do not include pesticide doses unless they match the product label and local registration.">{(id) => <Textarea id={id} rows={5} value={adv.body} onChange={(e) => setAdv({ ...adv, body: e.target.value })} required />}</Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Source name">{(id) => <Input id={id} value={adv.source_name} onChange={(e) => setAdv({ ...adv, source_name: e.target.value })} placeholder="e.g. PJTSAU package of practices" />}</Field>
                <Field label="Source URL">{(id) => <Input id={id} type="url" value={adv.source_url} onChange={(e) => setAdv({ ...adv, source_url: e.target.value })} />}</Field>
              </div>
              <Button type="submit">Submit</Button>
            </form>
          </Section>
          <Section title="Awaiting review">
            {pendingAdv.loading ? <Skeleton /> : (
              <ul className="max-h-[70vh] space-y-2 overflow-y-auto">
                {(pendingAdv.data || []).map((a: any) => (
                  <li key={a.id} className="rounded-lg border p-2 text-sm">
                    <p className="font-medium">{a.title} <span className="text-xs text-gray-500">{a.crop_id} · {a.stage_key}</span></p>
                    <p className="text-xs text-gray-600">{a.body}</p>
                    <div className="mt-1 flex gap-3 text-xs">
                      <button className="text-emerald-700 underline" onClick={async () => { try { await api.post(`/v1/advisory/${a.id}/review`, { decision: 'approved' }); pendingAdv.reload(); } catch (e: any) { toast(e.message, 'error'); } }}>Approve</button>
                      <button className="text-red-700 underline" onClick={async () => { await api.post(`/v1/advisory/${a.id}/review`, { decision: 'rejected' }); pendingAdv.reload(); }}>Reject</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      )}

      {tab === 'alerts' && <Section title="Issue a verified alert" description="Only issue alerts backed by an official warning, verified field reports or validated sources."><AlertForm onDone={() => setAlertOpen(!alertOpen)} /></Section>}

      <Modal open={!!open} onClose={() => setOpen(null)} title="Case" wide>{open && <CaseWork id={open} onChange={cases.reload} />}</Modal>
    </div>
  );
}

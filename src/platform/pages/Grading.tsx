import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { api, fmtDate, fmtDateTime } from '../api';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, Notice, PageHeader, Section, Skeleton, Spinner, Tabs, Textarea, useAsync, useToast } from '../ui';
import { PrivateImage, StatusBadge } from '../trade-ui';

const REQ_TONE: Record<string, 'gray' | 'amber' | 'green' | 'red' | 'blue'> = { requested: 'amber', assigned: 'blue', graded: 'green', review_requested: 'red', cancelled: 'gray' };
const REQ_LABEL: Record<string, string> = { requested: 'Waiting for inspector', assigned: 'Inspector assigned', graded: 'Graded', review_requested: 'Review requested', cancelled: 'Cancelled' };

/** Inspected grade, shown separately from what the farmer reported. */
export function InspectionCard({ inspection }: { inspection: any }) {
  if (!inspection) return <p className="text-xs text-gray-500">No inspection recorded. The grade above is reported by the seller.</p>;
  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <ClipboardCheck className="h-4 w-4 text-emerald-700" aria-hidden />
        <span className="font-semibold">Inspected grade: {inspection.grade}</span>
        {inspection.version > 1 && <Badge tone="blue">Corrected (v{inspection.version})</Badge>}
        {inspection.under_review && <Badge tone="red">Under review</Badge>}
      </div>
      <p className="mt-1 text-xs text-gray-600">By {inspection.inspector ?? 'inspector'} ({inspection.inspector_role?.replace('_', ' ')}) on {fmtDate(inspection.inspected_at)}</p>
      {inspection.measurements ? (
        <>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
            {Object.entries(inspection.measurements).map(([k, v]) => <div key={k} className="contents"><dt className="text-gray-500">{k.replace(/_/g, ' ')}</dt><dd>{String(v)}</dd></div>)}
          </dl>
          {inspection.reasons && <p className="mt-2 text-xs">{inspection.reasons}</p>}
          {(inspection.quantity_inspected || inspection.sample_method) && <p className="mt-1 text-xs text-gray-500">{inspection.quantity_inspected ? `Sample: ${inspection.quantity_inspected}` : ''}{inspection.sample_method ? ` · ${inspection.sample_method}` : ''}</p>}
          {inspection.photos?.length > 0 && <div className="mt-2 grid grid-cols-4 gap-1">{inspection.photos.map((p: string) => <PrivateImage key={p} id={p} alt="Inspection photo" className="h-16 w-full rounded object-cover" />)}</div>}
        </>
      ) : <p className="mt-1 text-xs text-gray-500">{inspection.evidence_note}</p>}
      <p className="mt-2 text-[11px] text-gray-500">{inspection.note}</p>
    </div>
  );
}

/** Lot owner: request an inspection, see its progress, ask for a review. */
export function RequestGradingPanel({ lot, onChange }: { lot: any; onChange: () => void }) {
  const toast = useToast();
  const reqs = useAsync(() => api.get('/v1/grading/requests?mine=1').then((r) => r.requests.filter((x: any) => x.lot_id === lot.id)), [lot.id]);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const current = reqs.data?.find((r: any) => r.status !== 'cancelled');
  const run = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true);
    try { await fn(); toast(msg); reqs.reload(); onChange(); } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Section title="Quality grading" description="A FARMDirect-verified inspector checks a sample and records measurements and photos. This is not an official government certification.">
      <InspectionCard inspection={lot.inspection} />
      {reqs.loading ? <Skeleton lines={1} /> : current ? (
        <div className="mt-3 text-sm">
          <p className="flex items-center gap-2">Request: <Badge tone={REQ_TONE[current.status]}>{REQ_LABEL[current.status]}</Badge> <span className="text-xs text-gray-500">{fmtDateTime(current.created_at)}</span></p>
          {['requested', 'assigned'].includes(current.status) && (
            <Button className="mt-2" variant="outline" size="sm" disabled={busy} onClick={() => run(() => api.post(`/v1/grading/requests/${current.id}/cancel`), 'Request cancelled')}>Cancel request</Button>
          )}
          {current.status === 'graded' && (
            <form className="mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/v1/grading/requests/${current.id}/review`, { reason }), 'Review requested'); setReason(''); }}>
              <Field label="Disagree with the grade? Ask for a re-inspection">{(id) => <Textarea id={id} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explain what you think is wrong" />}</Field>
              <Button type="submit" variant="outline" size="sm" disabled={busy || !reason.trim()}>Request review</Button>
            </form>
          )}
        </div>
      ) : !['sold', 'withdrawn'].includes(lot.status) && (
        <form className="mt-3 space-y-2" onSubmit={(e) => { e.preventDefault(); run(() => api.post('/v1/grading/requests', { lot_id: lot.id, notes: notes || null }), 'Grading requested. An inspector will contact you.'); }}>
          <Field label="Note for the inspector (optional)">{(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Where the produce is kept, best time to visit" />}</Field>
          <Button type="submit" disabled={busy}>{busy ? <Spinner /> : <ClipboardCheck className="mr-1 h-4 w-4" />}Request grading</Button>
        </form>
      )}
    </Section>
  );
}

/** Inspector queue: verified field agents/experts and authorised administrators. */
export function GradingPage() {
  const [tab, setTab] = useState<'open' | 'mine' | 'done'>('open');
  const list = useAsync(() => api.get('/v1/grading/requests'));
  const [openId, setOpenId] = useState<string | null>(null);
  if (list.loading) return <Skeleton lines={6} />;
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />;
  if (!list.data.can_inspect) {
    return (
      <div>
        <PageHeader title="Quality grading" icon={<ClipboardCheck />} />
        <Notice tone="warn" title="Inspectors only">Only verified field agents, experts and authorised administrators can inspect produce. Farmers request grading from their lot page under <Link className="underline" to="/sell">Sell Produce</Link>.</Notice>
      </div>
    );
  }
  const all = list.data.requests as any[];
  const shown = all.filter((r) => tab === 'open' ? ['requested', 'review_requested'].includes(r.status) : tab === 'mine' ? r.status === 'assigned' && r.inspector_name : ['graded', 'cancelled'].includes(r.status));
  return (
    <div className="space-y-4">
      <PageHeader title="Quality grading" icon={<ClipboardCheck />} subtitle="Take a request, inspect a sample, record measurements and photos. Grades are your recorded inspection, not a government certificate." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'open', label: 'Waiting' }, { id: 'mine', label: 'Assigned' }, { id: 'done', label: 'Completed' }]} />
      {!shown.length ? <Empty title="Nothing here">New grading requests from farmers appear under “Waiting”.</Empty> : (
        <ul className="divide-y rounded-2xl border bg-white">
          {shown.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-semibold">{r.commodity}{r.variety ? ` · ${r.variety}` : ''} — {r.quantity_total} {r.unit}</p>
                <p className="text-xs text-gray-500">{r.farmer_name} · {[r.district, r.state].filter(Boolean).join(', ')} · {fmtDateTime(r.created_at)}{r.inspector_name ? ` · inspector ${r.inspector_name}` : ''}</p>
                {r.status === 'review_requested' && r.review_reason && <p className="mt-1 text-xs text-red-700">Review reason: {r.review_reason}</p>}
              </div>
              <div className="flex items-center gap-2"><Badge tone={REQ_TONE[r.status]}>{REQ_LABEL[r.status]}</Badge><Button size="sm" variant="outline" onClick={() => setOpenId(r.id)}>Open</Button></div>
            </li>
          ))}
        </ul>
      )}
      {openId && <InspectModal id={openId} onClose={() => { setOpenId(null); list.reload(); }} />}
    </div>
  );
}

function InspectModal({ id, onClose }: { id: string; onClose: () => void }) {
  const toast = useToast();
  const d = useAsync(() => api.get(`/v1/grading/requests/${id}`), [id]);
  const [f, setF] = useState<any>({ grade: '', reasons: '', quantity_inspected: '', sample_method: '', m: {} });
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const run = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true);
    try { const r = await fn(); toast(msg); d.reload(); return r; } catch (e: any) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  const g = d.data?.request;
  return (
    <Modal open onClose={onClose} title="Inspection" wide>
      {d.loading ? <Skeleton /> : d.error ? <ErrorBox error={d.error} /> : (
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-semibold">{g.commodity}{g.variety ? ` · ${g.variety}` : ''} — {g.quantity_total} {g.unit}</p>
            <p className="text-xs text-gray-500">{[g.district, g.state].filter(Boolean).join(', ')} · <StatusBadge status={g.status} /></p>
            {g.notes && <p className="mt-1 rounded bg-gray-50 p-2 text-xs">Farmer note: {g.notes}</p>}
            {g.review_reason && <p className="mt-1 rounded bg-red-50 p-2 text-xs text-red-800">Review requested: {g.review_reason}</p>}
          </div>
          {['requested', 'review_requested'].includes(g.status) && (!g.assigned_to || g.status === 'review_requested') && (
            <Button disabled={busy} onClick={() => run(() => api.post(`/v1/grading/requests/${id}/assign`), 'Request assigned to you')}>Take this request</Button>
          )}
          {['assigned', 'review_requested'].includes(g.status) && g.assigned_to && (
            <form className="space-y-3 rounded-xl border p-3" onSubmit={async (e) => {
              e.preventDefault();
              const measurements: Record<string, number | string> = {};
              for (const [k, v] of Object.entries(f.m)) if (v !== '' && v != null) measurements[k] = isNaN(Number(v)) ? String(v) : Number(v);
              const r = await run(() => api.post(`/v1/grading/requests/${id}/results`, { grade: f.grade, reasons: f.reasons, measurements, quantity_inspected: f.quantity_inspected ? Number(f.quantity_inspected) : null, sample_method: f.sample_method || null }), 'Result recorded');
              if (r?.result_id) setLastResult(r.result_id);
            }}>
              <p className="font-semibold">Record measurements</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {d.data.criteria.map((c: any) => (
                  <Field key={c.key} label={`${c.label}${c.unit ? ` (${c.unit})` : ''}`} hint={c.hint}>{(fid) => <Input id={fid} value={f.m[c.key] ?? ''} onChange={(e) => setF({ ...f, m: { ...f.m, [c.key]: e.target.value } })} />}</Field>
                ))}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Grade" required>{(fid) => <Input id={fid} value={f.grade} onChange={(e) => setF({ ...f, grade: e.target.value })} placeholder="e.g. FAQ, A, B" />}</Field>
                <Field label="Quantity inspected">{(fid) => <Input id={fid} type="number" min="0" value={f.quantity_inspected} onChange={(e) => setF({ ...f, quantity_inspected: e.target.value })} />}</Field>
              </div>
              <Field label="Sampling method">{(fid) => <Input id={fid} value={f.sample_method} onChange={(e) => setF({ ...f, sample_method: e.target.value })} placeholder="e.g. 5 bags opened, mixed sample of 2 kg" />}</Field>
              <Field label="Reasons for the grade" required>{(fid) => <Textarea id={fid} value={f.reasons} onChange={(e) => setF({ ...f, reasons: e.target.value })} />}</Field>
              <p className="text-xs text-gray-500">{d.data.note}</p>
              <Button type="submit" disabled={busy || !f.grade.trim() || !f.reasons.trim()}>Save result</Button>
            </form>
          )}
          {lastResult && <PhotoUpload resultId={lastResult} onDone={d.reload} />}
          {d.data.results.length > 0 && (
            <div>
              <p className="mb-1 font-semibold">Results on record</p>
              <ul className="space-y-2">
                {d.data.results.map((r: any) => (
                  <li key={r.id} className="rounded-lg border p-2">
                    <p><b>v{r.version}: {r.grade}</b> <span className="text-xs text-gray-500">by {r.inspector_name} · {fmtDateTime(r.inspected_at)}</span></p>
                    <p className="text-xs">{Object.entries(r.measurements || {}).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')}</p>
                    <p className="text-xs text-gray-600">{r.reasons}</p>
                    {r.photos.length > 0 && <div className="mt-1 grid grid-cols-6 gap-1">{r.photos.map((p: string) => <PrivateImage key={p} id={p} alt="Inspection photo" className="h-12 w-full rounded object-cover" />)}</div>}
                    {!lastResult && <PhotoUpload resultId={r.id} onDone={d.reload} compact />}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function PhotoUpload({ resultId, onDone, compact }: { resultId: string; onDone: () => void; compact?: boolean }) {
  const toast = useToast();
  return (
    <label className={`block text-xs ${compact ? 'mt-1' : 'rounded-lg border border-dashed p-3'}`}>
      <span className="text-gray-600">{compact ? 'Add inspection photo (your results only)' : 'Add inspection photos (JPEG, PNG or WebP)'}</span>
      <input type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block text-xs" onChange={async (e) => {
        const fl = e.target.files?.[0]; if (!fl) return;
        const fd = new FormData(); fd.append('file', fl);
        try { await api.post(`/v1/grading/results/${resultId}/photos`, fd); toast('Photo added'); onDone(); } catch (err: any) { toast(err.message, 'error'); }
        e.target.value = '';
      }} />
    </label>
  );
}

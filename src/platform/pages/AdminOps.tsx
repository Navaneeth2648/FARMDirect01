import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtDate, fmtDateTime, inr, qs } from '../api';
import { Badge, Bars, Button, Empty, ErrorBox, Field, Input, Modal, Notice, Section, Select, Skeleton, Textarea, useAsync, useToast } from '../ui';
import { DocLink, StatusBadge } from '../trade-ui';

const act = (toast: any, reload: () => void) => async (fn: () => Promise<any>, msg: string) => {
  try { await fn(); toast(msg); reload(); } catch (e: any) { toast(e.message, 'error'); }
};
const ask = (label: string) => window.prompt(label)?.trim() || '';

export function OpsVerifications() {
  const toast = useToast();
  const [kind, setKind] = useState('');
  const list = useAsync(() => api.get(`/v1/ops/verifications${qs({ kind })}`).then((r) => r.applications), [kind]);
  const [open, setOpen] = useState<string | null>(null);
  const detail = useAsync(() => (open ? api.get(`/v1/ops/verifications/${open}`) : Promise.resolve(null)), [open]);
  const run = act(toast, () => { list.reload(); detail.reload(); });
  const decide = (decision: string) => {
    const reason = decision === 'approve' || decision === 'start_review' ? '' : ask('Reason the applicant can act on');
    if ((decision === 'reject' || decision === 'request_info') && !reason) return;
    run(() => api.post(`/v1/ops/verifications/${open}/decision`, { decision, reason: reason || undefined }), `Decision recorded: ${decision}`);
  };
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Section className="lg:col-span-2" title="Verification queue" actions={<Select aria-label="Kind" className="w-44" value={kind} onChange={(e) => setKind(e.target.value)} placeholder="All I can review" options={[{ value: 'buyer_business', label: 'Buyers' }, { value: 'farmer_identity', label: 'Farmers' }, { value: 'storage_facility', label: 'Storage facilities' }, { value: 'transport_provider', label: 'Transporters' }]} />}>
        {list.loading ? <Skeleton /> : !list.data?.length ? <Empty title="Queue is empty" /> : (
          <ul className="divide-y text-sm">{list.data.map((a: any) => (
            <li key={a.id}><button className={`flex w-full justify-between py-2 text-left ${open === a.id ? 'font-semibold' : ''}`} onClick={() => setOpen(a.id)}>
              <span>{a.full_name}<span className="block text-xs text-gray-500">{a.kind.replace(/_/g, ' ')} · {fmtDate(a.submitted_at)} · {a.phone}</span></span><StatusBadge status={a.status} />
            </button></li>))}</ul>
        )}
      </Section>
      <Section className="lg:col-span-3" title="Application">
        {!open ? <p className="text-sm text-gray-500">Select an application.</p> : detail.loading ? <Skeleton /> : detail.error ? <ErrorBox error={detail.error} /> : detail.data && (
          <div className="space-y-3 text-sm">
            <p><b>{detail.data.application.full_name}</b> · {detail.data.application.role} · member since {fmtDate(detail.data.application.user_since)}</p>
            <details open><summary className="cursor-pointer font-semibold">Submitted details</summary>
              <pre className="mt-1 max-h-64 overflow-auto rounded bg-gray-50 p-2 text-xs">{JSON.stringify(detail.data.application.submitted_data, null, 1)}</pre></details>
            <div><p className="font-semibold">Automated checks (for the reviewer – never approve by themselves)</p>
              <ul>{detail.data.application.checks.map((c: any, i: number) => <li key={i}>• {c.check}: <b>{c.result}</b></li>)}</ul></div>
            <div><p className="font-semibold">Documents (opened through logged, short-lived links)</p>
              {detail.data.documents.length ? <ul>{detail.data.documents.map((d: any) => <li key={d.id}><DocLink id={d.id} label={`${d.doc_type.replace(/_/g, ' ')} · ${d.mime} · ${fmtDate(d.created_at)}`} /></li>)}</ul> : <p className="text-amber-700">No documents uploaded</p>}</div>
            {detail.data.fraud_flags.length > 0 && <Notice tone="warn" title="Review flags on this account">{detail.data.fraud_flags.map((f: any) => `${f.rule} (${f.severity}, ${f.status})`).join('; ')}</Notice>}
            {detail.data.previous.length > 0 && <p className="text-xs text-gray-500">Previous applications: {detail.data.previous.map((p: any) => `${p.status} ${fmtDate(p.submitted_at)}`).join(', ')}</p>}
            <div><p className="font-semibold">History</p><ul className="text-xs">{detail.data.history.map((h: any, i: number) => <li key={i}>{fmtDateTime(h.created_at)} · {h.action}{h.actor && ` by ${h.actor}`}{h.note && ` – ${h.note}`}</li>)}</ul></div>
            {!['approved', 'rejected'].includes(detail.data.application.status) && (
              <div className="flex flex-wrap gap-2">
                {detail.data.application.status === 'submitted' && <Button size="sm" variant="outline" onClick={() => decide('start_review')}>Start review</Button>}
                <Button size="sm" onClick={() => decide('approve')}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => decide('request_info')}>Request information</Button>
                <Button size="sm" variant="destructive" onClick={() => decide('reject')}>Reject</Button>
              </div>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

export function OpsListings() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const lots = useAsync(() => api.get(`/v1/ops/lots${qs({ status })}`).then((r) => r.lots), [status]);
  const demand = useAsync(() => api.get('/v1/ops/demand').then((r) => r.demand));
  const run = act(toast, () => { lots.reload(); demand.reload(); });
  return (
    <div className="space-y-4">
      <Section title="Produce lots" actions={<Select aria-label="Status" className="w-40" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All" options={['draft', 'published', 'offer_received', 'negotiation', 'reserved', 'partially_sold', 'sold', 'expired', 'withdrawn'].map((s) => ({ value: s, label: s }))} />}>
        {lots.loading ? <Skeleton /> : (
          <div className="overflow-x-auto"><table className="min-w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="p-1">Lot</th><th className="p-1">Farmer</th><th className="p-1">Qty</th><th className="p-1">Price</th><th className="p-1">Status</th><th className="p-1">Flags</th><th /></tr></thead>
            <tbody>{(lots.data || []).map((l: any) => (
              <tr key={l.id} className="border-t"><td className="p-1">{l.commodity} {l.variety}</td><td className="p-1">{l.farmer_name}<span className="block text-xs text-gray-500">{l.district}</span></td>
                <td className="p-1">{l.quantity_available}/{l.quantity_total} {l.unit}</td><td className="p-1">{inr(l.price_per_unit)}</td><td className="p-1"><StatusBadge status={l.status} /></td>
                <td className="p-1">{l.open_reports > 0 && <Badge tone="red">{l.open_reports} report(s)</Badge>}{l.open_flags > 0 && <Badge tone="amber">{l.open_flags} flag(s)</Badge>}</td>
                <td className="p-1">{l.status !== 'withdrawn' ? <button className="text-xs text-red-700 underline" onClick={() => { const r = ask('Reason for removing this listing'); if (r) run(() => api.post(`/v1/ops/lots/${l.id}/moderate`, { action: 'withdraw', reason: r }), 'Listing removed'); }}>Remove</button>
                  : <button className="text-xs underline" onClick={() => { const r = ask('Reason for restoring'); if (r) run(() => api.post(`/v1/ops/lots/${l.id}/moderate`, { action: 'restore', reason: r }), 'Restored as draft'); }}>Restore</button>}</td></tr>
            ))}</tbody></table></div>
        )}
      </Section>
      <Section title="Buyer requirements">
        <ul className="divide-y text-sm">{(demand.data || []).map((d: any) => (
          <li key={d.id} className="flex justify-between py-2"><span>{d.business_name} · {d.commodity} · {d.quantity_committed}/{d.quantity} {d.unit}</span>
            <span className="flex items-center gap-2"><StatusBadge status={d.status} />{['open', 'partially_filled'].includes(d.status) && <button className="text-xs text-red-700 underline" onClick={() => { const r = ask('Reason for closing'); if (r) run(() => api.post(`/v1/ops/demand/${d.id}/close`, { reason: r }), 'Closed'); }}>Close</button>}</span></li>
        ))}</ul>
      </Section>
    </div>
  );
}

export function OpsOrders() {
  const [status, setStatus] = useState('');
  const r = useAsync(() => api.get(`/v1/ops/orders${qs({ status })}`).then((x) => x.orders), [status]);
  return (
    <Section title="Orders" actions={<Select aria-label="Status" className="w-48" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All" options={['pending_confirmation', 'confirmed', 'pickup_scheduled', 'in_transit', 'delivered', 'completed', 'cancelled'].map((s) => ({ value: s, label: s }))} />}>
      {r.loading ? <Skeleton /> : (
        <ul className="divide-y text-sm">{(r.data || []).map((o: any) => (
          <li key={o.id}><Link to={`/trade/orders/${o.id}`} className="flex flex-wrap justify-between gap-2 py-2 hover:bg-gray-50"><span><b>{o.order_no}</b> · {o.commodity} {o.quantity} {o.unit} · {o.farmer_name} → {o.buyer_name} · {inr(o.buyer_payable)}</span><StatusBadge status={o.status} /></Link></li>
        ))}</ul>
      )}
    </Section>
  );
}

export function OpsStorage() {
  const toast = useToast();
  const fac = useAsync(() => api.get('/v1/ops/facilities').then((r) => r.facilities));
  const bookings = useAsync(() => api.get('/v1/ops/bookings').then((r) => r.bookings));
  const run = act(toast, () => fac.reload());
  return (
    <div className="space-y-4">
      <Section title="Facilities">
        {fac.loading ? <Skeleton /> : <ul className="divide-y text-sm">{(fac.data || []).map((f: any) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><b>{f.name}</b> · {f.provider_name} · {f.district}, {f.state} · {f.occupancy.occupied_qtl}+{f.occupancy.reserved_qtl}/{f.total_capacity_qtl} qtl{f.pending_changes && <Badge tone="amber">changes pending</Badge>}</span>
            <span className="flex items-center gap-2"><StatusBadge status={f.status} />
              {f.status === 'verified' && <button className="text-xs text-red-700 underline" onClick={() => { const r = ask('Reason for suspending'); if (r) run(() => api.post(`/v1/ops/facilities/${f.id}/status`, { status: 'suspended', reason: r }), 'Suspended'); }}>Suspend</button>}
              {f.status === 'suspended' && <button className="text-xs underline" onClick={() => { const r = ask('Reason for reinstating'); if (r) run(() => api.post(`/v1/ops/facilities/${f.id}/status`, { status: 'verified', reason: r }), 'Reinstated'); }}>Reinstate</button>}
            </span>
          </li>))}</ul>}
      </Section>
      <Section title="Bookings">
        {bookings.loading ? <Skeleton /> : <ul className="divide-y text-sm">{(bookings.data || []).map((b: any) => (
          <li key={b.id}><Link to={`/storage/bookings/${b.id}`} className="flex justify-between py-2 hover:bg-gray-50"><span>{b.booking_ref} · {b.facility_name} · {b.farmer_name} · {b.quantity_qtl} qtl · {fmtDate(b.start_date)}–{fmtDate(b.end_date)}</span><StatusBadge status={b.status} /></Link></li>))}</ul>}
      </Section>
    </div>
  );
}

export function OpsTransport() {
  const toast = useToast();
  const r = useAsync(() => api.get('/v1/ops/transport-providers').then((x) => x.providers));
  const run = act(toast, r.reload);
  return (
    <Section title="Transport providers" description="Verify new providers from the Verifications tab.">
      {r.loading ? <Skeleton /> : <ul className="divide-y text-sm">{(r.data || []).map((p: any) => (
        <li key={p.id} className="flex justify-between py-2"><span><b>{p.name}</b> · {p.vehicle_types.join(', ')} · {p.capacity_tonnes} t · {p.rate_per_km ? `₹${p.rate_per_km}/km` : 'no rate'}</span>
          <span className="flex items-center gap-2"><StatusBadge status={p.status} />{p.status === 'verified' && <button className="text-xs text-red-700 underline" onClick={() => { const x = ask('Reason for suspending'); if (x) run(() => api.post(`/v1/ops/transport-providers/${p.id}/suspend`, { reason: x }), 'Suspended'); }}>Suspend</button>}</span></li>))}</ul>}
    </Section>
  );
}

export function OpsPayments({ canReconcile }: { canReconcile: boolean }) {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const r = useAsync(() => api.get(`/v1/ops/payments${qs({ status })}`), [status]);
  const run = act(toast, r.reload);
  return (
    <Section title="Payments & reconciliation" description="Offline payments are confirmed by the recipient. Finance officers can reconcile against bank statements; every change is audited."
      actions={<Select aria-label="Status" className="w-44" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="All" options={['required', 'pending', 'confirmed', 'disputed', 'refund_pending', 'refunded', 'failed'].map((s) => ({ value: s, label: s }))} />}>
      {r.loading ? <Skeleton /> : (
        <>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">{r.data.totals.map((t: any, i: number) => <Badge key={i}>{t.kind}/{t.status}: {t.n} · {inr(t.total)}</Badge>)}</div>
          <ul className="divide-y text-sm">{r.data.payments.map((p: any) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><b>{p.ref}</b> · {p.order_no || p.booking_ref} · {p.kind} · {inr(p.amount)}<span className="block text-xs text-gray-500">{p.method || '—'} {p.reference_note && `· ${p.reference_note}`} {p.provider_payment_id && `· ${p.provider_payment_id}`}</span></span>
              <span className="flex items-center gap-2"><StatusBadge status={p.status} />{canReconcile && <select aria-label="Reconcile" className="rounded border p-1 text-xs" value="" onChange={(e) => { const s = e.target.value; const note = ask('Reconciliation note (e.g. bank statement reference)'); if (s && note) run(() => api.post(`/v1/ops/payments/${p.id}/reconcile`, { status: s, note }), 'Reconciled'); }}>
                <option value="">Reconcile…</option>{['confirmed', 'failed', 'disputed', 'refunded', 'settled'].map((s) => <option key={s}>{s}</option>)}</select>}</span>
            </li>))}</ul>
        </>
      )}
    </Section>
  );
}

export function OpsDisputes() {
  const toast = useToast();
  const [status, setStatus] = useState('');
  const list = useAsync(() => api.get(`/v1/ops/disputes${qs({ status })}`).then((r) => r.disputes), [status]);
  const [open, setOpen] = useState<string | null>(null);
  const d = useAsync(() => (open ? api.get(`/v1/disputes/${open}`) : Promise.resolve(null)), [open]);
  const run = act(toast, () => { list.reload(); d.reload(); });
  const [note, setNote] = useState('');
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Section className="lg:col-span-2" title="Cases" actions={<Select aria-label="Status" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Open cases" options={['open', 'under_review', 'awaiting_evidence', 'escalated', 'appealed', 'resolved', 'rejected'].map((s) => ({ value: s, label: s }))} />}>
        {list.loading ? <Skeleton /> : !list.data?.length ? <Empty title="No cases" /> : <ul className="divide-y text-sm">{list.data.map((c: any) => (
          <li key={c.id}><button className="flex w-full justify-between py-2 text-left" onClick={() => setOpen(c.id)}><span><b>{c.ref}</b> · {c.category.replace(/_/g, ' ')}<span className="block text-xs text-gray-500">{c.raised_by_name} vs {c.against_name} · {c.order_no || c.booking_ref}</span></span><StatusBadge status={c.status} /></button></li>))}</ul>}
      </Section>
      <Section className="lg:col-span-3" title="Case">
        {!open ? <p className="text-sm text-gray-500">Select a case.</p> : d.loading ? <Skeleton /> : d.data && (
          <div className="space-y-3 text-sm">
            <p><b>{d.data.dispute.ref}</b> · requested: {d.data.dispute.requested_resolution}</p>
            <ol className="max-h-72 space-y-2 overflow-y-auto">{d.data.events.map((e: any, i: number) => <li key={i} className={`rounded p-2 ${e.internal ? 'bg-amber-50' : 'bg-gray-50'}`}><span className="text-xs text-gray-500">{fmtDateTime(e.created_at)} · {e.actor_name} · {e.kind}{e.internal ? ' (internal)' : ''}</span><p className="whitespace-pre-wrap">{e.body}</p></li>)}</ol>
            <div>{d.data.evidence.map((ev: any) => <div key={ev.id}><DocLink id={ev.id} label={`Evidence · ${fmtDate(ev.created_at)}`} /></div>)}</div>
            {!['resolved', 'rejected'].includes(d.data.dispute.status) && (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => run(() => api.post(`/v1/ops/disputes/${open}/assign`, {}), 'Assigned to you')}>Assign to me</Button>
                  {['under_review', 'awaiting_evidence', 'escalated'].map((s) => <Button key={s} size="sm" variant="outline" onClick={() => { const n = ask(`Note for "${s}" (shared with parties)`); if (n) run(() => api.post(`/v1/ops/disputes/${open}/status`, { status: s, note: n }), 'Updated'); }}>{s.replace('_', ' ')}</Button>)}
                </div>
                <Textarea aria-label="Internal note or decision" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note, or the decision text" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" disabled={!note} onClick={() => run(async () => { await api.post(`/v1/ops/disputes/${open}/note`, { body: note }); setNote(''); }, 'Internal note added')}>Add internal note</Button>
                  <Button size="sm" disabled={!note} onClick={() => run(async () => { await api.post(`/v1/ops/disputes/${open}/decide`, { outcome: 'resolved', resolution: note }); setNote(''); }, 'Resolved')}>Resolve with this decision</Button>
                  <Button size="sm" variant="destructive" disabled={!note} onClick={() => run(async () => { await api.post(`/v1/ops/disputes/${open}/decide`, { outcome: 'rejected', resolution: note }); setNote(''); }, 'Rejected')}>Reject with this reason</Button>
                </div>
              </>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

export function OpsFraud() {
  const toast = useToast();
  const [status, setStatus] = useState('open');
  const r = useAsync(() => api.get(`/v1/ops/fraud?status=${status}`), [status]);
  const run = act(toast, r.reload);
  const [restrict, setRestrict] = useState<{ user_id: string; kind: string; reason: string } | null>(null);
  if (r.loading) return <Skeleton lines={6} />;
  if (r.error) return <ErrorBox error={r.error} />;
  return (
    <div className="space-y-4">
      <Notice>Flags are automatic signals for review – not accusations. Restrictions must state a reason, and users can appeal to a different reviewer.</Notice>
      <Section title="Review flags" actions={<Select aria-label="Status" className="w-36" value={status} onChange={(e) => setStatus(e.target.value)} options={['open', 'dismissed', 'actioned'].map((s) => ({ value: s, label: s }))} />}>
        {!r.data.flags.length ? <p className="text-sm text-gray-500">None.</p> : <ul className="divide-y text-sm">{r.data.flags.map((f: any) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <span><Badge tone={f.severity === 'high' ? 'red' : f.severity === 'medium' ? 'amber' : 'gray'}>{f.severity}</Badge> <b>{f.rule.replace(/_/g, ' ')}</b> · {f.full_name ?? '—'} · {f.subject_type} {f.subject_id.slice(0, 8)}<span className="block text-xs text-gray-500">{JSON.stringify(f.evidence)} · {fmtDateTime(f.created_at)}</span></span>
            {f.status === 'open' && <span className="flex gap-2 text-xs">
              <button className="underline" onClick={() => { const n = ask('Why is this not a problem?'); if (n) run(() => api.post(`/v1/ops/fraud/${f.id}/review`, { status: 'dismissed', note: n }), 'Dismissed'); }}>Dismiss</button>
              <button className="text-red-700 underline" onClick={() => { const n = ask('Action taken'); if (n) run(() => api.post(`/v1/ops/fraud/${f.id}/review`, { status: 'actioned', note: n }), 'Marked actioned'); }}>Actioned</button>
              {f.user_id && <button className="text-red-700 underline" onClick={() => setRestrict({ user_id: f.user_id, kind: 'no_offers', reason: '' })}>Restrict user</button>}
            </span>}
          </li>))}</ul>}
      </Section>
      <Section title="User reports">
        {!r.data.reports.length ? <p className="text-sm text-gray-500">None.</p> : <ul className="divide-y text-sm">{r.data.reports.map((x: any) => (
          <li key={x.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b>{x.reason.replace(/_/g, ' ')}</b> on {x.target_type} {x.target_id.slice(0, 8)} by {x.reporter_name}<span className="block text-xs text-gray-500">{x.details}</span></span>
            <span className="flex items-center gap-2 text-xs"><StatusBadge status={x.status === 'investigating' ? 'under_review' : x.status} />
              <button className="underline" onClick={() => run(() => api.post(`/v1/ops/reports/${x.id}`, { status: 'investigating' }), 'Investigating')}>Investigate</button>
              <button className="underline" onClick={() => { const n = ask('Resolution'); if (n) run(() => api.post(`/v1/ops/reports/${x.id}`, { status: 'actioned', resolution: n }), 'Actioned'); }}>Action</button>
              <button className="underline" onClick={() => { const n = ask('Why dismissed?'); if (n) run(() => api.post(`/v1/ops/reports/${x.id}`, { status: 'dismissed', resolution: n }), 'Dismissed'); }}>Dismiss</button></span></li>))}</ul>}
      </Section>
      <Section title="Active restrictions">
        {!r.data.restrictions.length ? <p className="text-sm text-gray-500">None.</p> : <ul className="divide-y text-sm">{r.data.restrictions.map((x: any) => (
          <li key={x.id} className="flex justify-between py-2"><span>{x.full_name} · <b>{x.kind}</b> – {x.reason} · {fmtDate(x.created_at)}</span><button className="text-xs underline" onClick={() => { const n = ask('Reason for lifting'); if (n) run(() => api.post(`/v1/ops/restrictions/${x.id}/lift`, { reason: n }), 'Lifted'); }}>Lift</button></li>))}</ul>}
      </Section>
      <Section title="Appeals" description="Decided by a different reviewer from the one who made the original decision.">
        {!r.data.appeals.length ? <p className="text-sm text-gray-500">None.</p> : <ul className="divide-y text-sm">{r.data.appeals.map((a: any) => (
          <li key={a.id} className="py-2"><p><b>{a.full_name}</b> appeals {a.subject_type}: {a.statement}</p>
            <div className="mt-1 flex gap-2"><Button size="sm" onClick={() => { const n = ask('Decision note'); if (n) run(() => api.post(`/v1/ops/appeals/${a.id}/decide`, { decision: 'upheld', note: n }), 'Appeal upheld'); }}>Uphold</Button>
              <Button size="sm" variant="outline" onClick={() => { const n = ask('Decision note'); if (n) run(() => api.post(`/v1/ops/appeals/${a.id}/decide`, { decision: 'denied', note: n }), 'Appeal denied'); }}>Deny</Button></div></li>))}</ul>}
      </Section>
      <Modal open={!!restrict} onClose={() => setRestrict(null)} title="Restrict account">
        {restrict && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); run(() => api.post('/v1/ops/restrictions', restrict), 'Restriction applied; user notified').then(() => setRestrict(null)); }}>
            <Select aria-label="Restriction" value={restrict.kind} onChange={(e) => setRestrict({ ...restrict, kind: e.target.value })} options={[{ value: 'no_offers', label: 'No offers' }, { value: 'no_listings', label: 'No listings' }, { value: 'no_bookings', label: 'No storage bookings' }, { value: 'full', label: 'All marketplace actions' }]} />
            <Textarea aria-label="Reason" value={restrict.reason} onChange={(e) => setRestrict({ ...restrict, reason: e.target.value })} required placeholder="Reason shown to the user" />
            <Button type="submit" variant="destructive" className="w-full">Apply restriction</Button>
          </form>
        )}
      </Modal>
    </div>
  );
}

const SETTING_LABELS: Record<string, string> = {
  platform_fee_buyer_pct: 'Platform fee charged to buyer (%)', platform_fee_farmer_pct: 'Platform fee charged to farmer (%)', tax_on_fees_pct: 'Tax on platform fees (%)',
  order_confirm_hours: 'Hours to confirm an accepted offer', offer_expiry_hours: 'Default offer validity (hours)', lot_expiry_days: 'Listing validity (days)',
  stepup_threshold_inr: 'OTP re-confirmation above order value (₹)', profile_level_max_order_inr: 'Per-order limit before farmer ID verification (₹)',
  unverified_buyer_max_order_inr: 'Unverified buyer limit (₹, informational)', storage_hold_hours: 'Hours a storage request holds capacity',
  transport_rate_per_qtl_km: 'Default transport estimate (₹/quintal/km, empty = request quotes)', road_distance_factor: 'Road distance factor',
};

export function OpsSettings({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const r = useAsync(() => api.get('/v1/ops/settings'));
  const [vals, setVals] = useState<Record<string, string>>({});
  if (r.loading) return <Skeleton />;
  if (r.error) return <ErrorBox error={r.error} />;
  const s = r.data.settings;
  return (
    <Section title="Fees & marketplace rules" description="Defaults charge no platform fee. Every change is recorded in the audit log with before and after values.">
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, v === '' ? null : Number(v)]));
        try { await api.put('/v1/ops/settings', body); toast('Rules updated'); setVals({}); r.reload(); } catch (er: any) { toast(er.message, 'error'); }
      }}>
        {Object.keys(SETTING_LABELS).map((k) => (
          <Field key={k} label={SETTING_LABELS[k]}>{(id) => <Input id={id} type="number" step="any" min="0" disabled={!canEdit} value={vals[k] ?? (s[k] ?? '')} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} />}</Field>
        ))}
        {canEdit && <div className="flex justify-end sm:col-span-2"><Button type="submit" disabled={!Object.keys(vals).length}>Save rules</Button></div>}
      </form>
      <FeeReport />
    </Section>
  );
}

/** Platform fees by month, calculated by the server from each order's frozen breakdown. */
function FeeReport() {
  const r = useAsync(() => api.get('/v1/ops/revenue'));
  if (r.loading) return <Skeleton />;
  if (r.error) return r.error.status === 403 ? null : <ErrorBox error={r.error} />;
  const { rows, current_rates, note } = r.data;
  return (
    <div className="mt-6">
      <h3 className="text-sm font-semibold">Platform fee report</h3>
      <p className="text-xs text-gray-500">Current rates: buyer {current_rates.buyer_pct}% · farmer {current_rates.farmer_pct}% · tax on fees {current_rates.tax_on_fees_pct}%</p>
      {!rows.length ? <p className="mt-2 text-sm text-gray-500">No orders yet.</p> : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-gray-500"><tr><th className="p-1">Month</th><th className="p-1">Status</th><th className="p-1 text-right">Orders</th><th className="p-1 text-right">Produce value</th><th className="p-1 text-right">Buyer fees</th><th className="p-1 text-right">Farmer fees</th><th className="p-1 text-right">Tax on fees</th></tr></thead>
            <tbody className="divide-y">
              {rows.map((x: any) => (
                <tr key={x.month + x.bucket} className={x.bucket === 'void' ? 'text-gray-400' : ''}>
                  <td className="p-1">{x.month}</td><td className="p-1"><Badge tone={x.bucket === 'earned' ? 'green' : x.bucket === 'pending' ? 'amber' : 'gray'}>{x.bucket}</Badge></td>
                  <td className="p-1 text-right">{x.orders}</td><td className="p-1 text-right">{inr(x.gmv)}</td><td className="p-1 text-right">{inr(x.buyer_fees)}</td><td className="p-1 text-right">{inr(x.farmer_fees)}</td><td className="p-1 text-right">{inr(x.tax_on_fees)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-1 text-xs text-gray-500">{note}</p>
    </div>
  );
}

export function OpsAnalytics() {
  const r = useAsync(() => api.get('/v1/ops/analytics'));
  if (r.loading) return <Skeleton lines={6} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const a = r.data;
  const stat = (label: string, v: any) => <div className="rounded-xl border border-gray-200 bg-white p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-2xl font-bold">{v ?? '–'}</p></div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat('Active farmers (profile complete)', a.active_verified_farmers)}{stat('ID-verified farmers', a.identity_verified_farmers)}
        {stat('Verified buyers', a.active_verified_buyers)}{stat('Published lots', a.published_lots)}
        {stat('Open buyer requirements', a.active_demand)}{stat('Negotiations (30 days)', a.offers_received_30d)}
        {stat('Offers accepted (30 days)', a.offers_accepted_30d)}{stat('Avg days to complete an order', a.avg_completion_days)}
        {stat('Storage facilities live', a.storage.facilities)}{stat('Open fraud flags', a.suspicious_activity.open_flags)}
        {stat('Open user reports', a.suspicious_activity.open_reports)}{stat('Avg dispute resolution (days)', a.disputes.avg_resolution_days)}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Orders by status"><Bars data={a.orders_by_status.map((o: any) => ({ label: o.status.slice(0, 10), value: o.n }))} color="#059669" /></Section>
        <Section title="Payments by status"><Bars data={a.payments_by_status.map((p: any) => ({ label: p.status.slice(0, 10), value: p.n }))} /></Section>
        <Section title="Storage occupancy today"><ul className="text-sm">{a.storage.occupancy.map((o: any) => <li key={o.name}>{o.name}: {o.occupied_qtl} stored + {o.reserved_qtl} reserved of {o.total} qtl</li>)}</ul></Section>
        <Section title="Pending verification"><ul className="text-sm">{a.pending_verifications.map((p: any) => <li key={p.kind}>{p.kind.replace(/_/g, ' ')}: {p.n}</li>)}{!a.pending_verifications.length && <li>None</li>}</ul></Section>
      </div>
      <p className="text-xs text-gray-500">Calculated from live records at {fmtDateTime(a.generated_at)}.</p>
    </div>
  );
}

export function OpsAdmins() {
  const toast = useToast();
  const r = useAsync(() => api.get('/v1/ops/admins'));
  const [f, setF] = useState({ full_name: '', phone: '', password: '', role: 'verification_officer' });
  const run = act(toast, r.reload);
  if (r.loading) return <Skeleton />;
  if (r.error) return <ErrorBox error={r.error} />;
  return (
    <div className="space-y-4">
      <Section title="Administrators" description="No public administrator registration. Changing or suspending an account signs it out everywhere immediately.">
        <ul className="divide-y text-sm">{r.data.admins.map((u: any) => (
          <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b>{u.full_name}</b> · {u.phone} · {u.role_label}<span className="block text-xs text-gray-500">{u.permissions.join(', ') || 'content & support tools'}</span></span>
            {u.role !== 'super_admin' && <span className="flex items-center gap-2"><StatusBadge status={u.status === 'active' ? 'verified' : 'suspended'} />
              <button className="text-xs underline" onClick={() => run(() => api.patch(`/v1/ops/admins/${u.id}`, { status: u.status === 'active' ? 'suspended' : 'active' }), 'Updated')}>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</button></span>}
          </li>))}</ul>
      </Section>
      <Section title="Create administrator">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); run(() => api.post('/v1/ops/admins', f), 'Administrator created').then(() => setF({ full_name: '', phone: '', password: '', role: f.role })); }}>
          <Field label="Full name">{(id) => <Input id={id} value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required />}</Field>
          <Field label="Mobile number">{(id) => <Input id={id} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required />}</Field>
          <Field label="Initial password" hint="12+ characters with letters and numbers. Share it securely; ask them to change it.">{(id) => <Input id={id} type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />}</Field>
          <Field label="Role">{(id) => <Select id={id} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} options={r.data.roles.map((x: any) => ({ value: x.role, label: x.label }))} />}</Field>
          <div className="sm:col-span-2 text-xs text-gray-500">{r.data.roles.find((x: any) => x.role === f.role)?.permissions.join(', ')}</div>
          <div className="flex justify-end sm:col-span-2"><Button type="submit">Create</Button></div>
        </form>
      </Section>
    </div>
  );
}

export function OpsAudit() {
  const [action, setAction] = useState('');
  const r = useAsync(() => api.get(`/v1/ops/audit${qs({ action })}`).then((x) => x.logs), [action]);
  return (
    <Section title="Audit log (append-only)" actions={<Input aria-label="Filter by action" className="w-56" placeholder="Filter e.g. verification., order., payment." value={action} onChange={(e) => setAction(e.target.value)} />}>
      {r.loading ? <Skeleton /> : (
        <table className="min-w-full text-xs"><thead className="text-left text-gray-500"><tr><th className="p-1">Time</th><th className="p-1">Actor</th><th className="p-1">Action</th><th className="p-1">Target</th><th className="p-1">Detail</th></tr></thead>
          <tbody>{(r.data || []).map((l: any) => <tr key={l.id} className="border-t"><td className="whitespace-nowrap p-1">{fmtDateTime(l.created_at)}</td><td className="p-1">{l.actor_name || '—'}</td><td className="p-1 font-mono">{l.action}</td><td className="p-1">{l.target_type} {l.target_id?.slice(0, 8)}</td><td className="max-w-md truncate p-1 font-mono">{l.detail}</td></tr>)}</tbody></table>
      )}
    </Section>
  );
}

import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FileText, Handshake, Printer, Truck } from 'lucide-react';
import { api, fmtDate, fmtDateTime, inr } from '../api';
import { useAuth } from '../auth';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, Notice, PageHeader, Section, Select, Skeleton, Spinner, Tabs, Textarea, useAsync, useConfirm, useToast } from '../ui';
import { Breakdown, DELIVERY_LABEL, DocLink, StatusBadge, TERMS_LABEL, useStepUp } from '../trade-ui';
import { OfferForm } from './Market';

export function TradePage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as any) || 'offers';
  const threads = useAsync(() => api.get('/v1/offers/threads').then((r) => r.threads));
  const orders = useAsync(() => api.get('/v1/orders').then((r) => r.orders));
  const payments = useAsync(() => api.get('/v1/payments'));
  const disputes = useAsync(() => api.get('/v1/disputes').then((r) => r.disputes));
  const transport = useAsync(() => api.get('/v1/transport/requests').then((r) => r.requests));
  const awaiting = (threads.data || []).filter((t: any) => t.awaiting_me).length;
  return (
    <div>
      <PageHeader title="Orders & Payments" icon={<Handshake />} subtitle="Every negotiation, order, payment and dispute in one place" />
      <Tabs value={tab} onChange={(t) => setParams({ tab: t })} tabs={[
        { id: 'offers', label: `Negotiations${awaiting ? ` (${awaiting})` : ''}` }, { id: 'orders', label: 'Orders' }, { id: 'payments', label: 'Payments' },
        { id: 'transport', label: 'Transport' }, { id: 'disputes', label: 'Disputes' },
      ]} />
      {tab === 'offers' && (threads.loading ? <Skeleton /> : !threads.data?.length ? <Empty title="No negotiations yet" /> : (
        <Section><ul className="divide-y">{threads.data.map((t: any) => (
          <li key={t.thread_id}><Link to={`/trade/threads/${t.thread_id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-gray-50">
            <div><p className="font-semibold">{t.commodity}{t.variety && ` · ${t.variety}`}</p><p className="text-sm text-gray-600">{t.quantity} {t.unit} @ {inr(t.price_per_unit)} · {fmtDateTime(t.created_at)}</p></div>
            <div className="flex gap-2">{t.awaiting_me && <Badge tone="red">Your reply needed</Badge>}<StatusBadge status={t.status} /></div>
          </Link></li>))}</ul></Section>
      ))}
      {tab === 'orders' && (orders.loading ? <Skeleton /> : !orders.data?.length ? <Empty title="No orders yet" /> : (
        <Section><ul className="divide-y">{orders.data.map((o: any) => (
          <li key={o.id}><Link to={`/trade/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-gray-50">
            <div><p className="font-semibold">{o.order_no} · {o.commodity}</p><p className="text-sm text-gray-600">{o.quantity} {o.unit} · {o.my_side === 'farmer' ? `you receive ~${inr(o.final_settlement ?? o.farmer_net)}` : `you pay ${inr(o.buyer_payable)}`} · paid {inr(o.paid)}</p></div>
            <StatusBadge status={o.status} />
          </Link></li>))}</ul></Section>
      ))}
      {tab === 'payments' && (payments.loading ? <Skeleton /> : (
        <Section description={payments.data.escrow_note}>
          {!payments.data.payments.length ? <Empty title="No payments yet" /> : (
            <ul className="divide-y text-sm">{payments.data.payments.map((p: any) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <Link to={p.order_id ? `/trade/orders/${p.order_id}` : `/storage/bookings/${p.booking_id}`} className="hover:underline">
                  <b>{p.ref}</b> · {p.kind.replace('_', ' ')} · {p.order_no || p.booking_ref}<span className="block text-xs text-gray-500">{p.due_date ? `Due ${fmtDate(p.due_date)}` : 'Due on delivery'}{p.paid_at && ` · paid ${fmtDate(p.paid_at)}`}</span>
                </Link>
                <span className="flex items-center gap-2 font-semibold">{inr(p.amount)}<StatusBadge status={p.status} /></span>
              </li>))}</ul>
          )}
        </Section>
      ))}
      {tab === 'transport' && (transport.loading ? <Skeleton /> : !transport.data?.length ? <Empty title="No transport requests" /> : (
        <Section><ul className="divide-y text-sm">{transport.data.map((t: any) => (
          <li key={t.id}><Link to={`/trade/transport/${t.id}`} className="flex justify-between py-2 hover:bg-gray-50"><span>{t.pickup_address} → {t.drop_address} · {fmtDate(t.preferred_date)}</span><StatusBadge status={t.status} /></Link></li>))}</ul></Section>
      ))}
      {tab === 'disputes' && (disputes.loading ? <Skeleton /> : !disputes.data?.length ? <Empty title="No disputes" /> : (
        <Section><ul className="divide-y text-sm">{disputes.data.map((d: any) => (
          <li key={d.id}><Link to={`/trade/disputes/${d.id}`} className="flex justify-between py-2 hover:bg-gray-50"><span><b>{d.ref}</b> · {d.category.replace(/_/g, ' ')}</span><StatusBadge status={d.status} /></Link></li>))}</ul></Section>
      ))}
    </div>
  );
}

export function ThreadPage() {
  const { threadId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const r = useAsync(() => api.get(`/v1/offers/threads/${threadId}`), [threadId]);
  const [counter, setCounter] = useState(false);
  if (r.loading) return <Skeleton lines={6} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const { offers, lot, can_respond, my_side, order } = r.data;
  const latest = offers[offers.length - 1];
  const respond = async (action: string, extra: any = {}) => {
    try {
      const res = await api.post(`/v1/offers/${latest.id}/respond`, { action, ...extra });
      if (res.orderId) { toast('Offer accepted – order created. Both sides must confirm.'); nav(`/trade/orders/${res.orderId}`); }
      else { toast(action === 'reject' ? 'Offer declined' : 'Counter-offer sent'); setCounter(false); r.reload(); }
    } catch (e: any) { toast(e.message, 'error'); }
  };
  return (
    <div className="space-y-4">
      {node}
      <PageHeader title={`Negotiation: ${lot?.commodity ?? ''}${lot?.variety ? ` · ${lot.variety}` : ''}`} icon={<Handshake />} subtitle={`You are the ${my_side}. ${lot ? `${lot.quantity_available} ${lot.unit} still available.` : ''}`} />
      {order && <Notice tone="ok">Accepted. <Link to={`/trade/orders/${order.id}`} className="font-semibold underline">Open order {order.order_no}</Link></Notice>}
      <Section title="Offer history">
        <ol className="space-y-3">
          {offers.map((o: any, i: number) => (
            <li key={o.id} className={`rounded-xl border p-3 ${i === offers.length - 1 ? 'border-emerald-300' : 'border-gray-200 opacity-80'}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{o.created_by === o.buyer_id ? 'Buyer' : 'Farmer'} offered {o.quantity} {o.unit} @ {inr(o.price_per_unit)}/{o.unit}</p>
                <StatusBadge status={o.status} />
              </div>
              <p className="text-xs text-gray-500">{fmtDateTime(o.created_at)} · {DELIVERY_LABEL[o.delivery_mode]} · {TERMS_LABEL[o.payment_terms]}{o.advance_pct ? ` (${o.advance_pct}% advance)` : ''}{o.payment_due_days ? ` (${o.payment_due_days} days)` : ''} · expires {fmtDateTime(o.expires_at)}</p>
              {o.note && <p className="mt-1 text-sm">“{o.note}”</p>}
              {i === offers.length - 1 && <div className="mt-2"><Breakdown b={o.breakdown} side={my_side} unit={`${o.quantity} ${o.unit} × ${inr(o.price_per_unit)}`} /></div>}
            </li>
          ))}
        </ol>
      </Section>
      {can_respond ? (
        <Section title="Your response">
          <div className="flex flex-wrap gap-2">
            <Button size="lg" onClick={async () => {
              if (await ask('Accept this offer?', <div className="space-y-2"><p>This creates an order and reserves {latest.quantity} {latest.unit}. Both sides then confirm the final terms.</p><Breakdown b={latest.breakdown} side={my_side} /></div>, { label: 'Accept offer' })) respond('accept', { confirm: true });
            }}>Accept</Button>
            <Button size="lg" variant="outline" onClick={() => setCounter(!counter)}>Counter-offer</Button>
            <Button size="lg" variant="ghost" className="text-red-700" onClick={async () => { if (await ask('Decline this offer?', 'The other side will be told.', { danger: true, label: 'Decline' })) respond('reject'); }}>Decline</Button>
          </div>
          {counter && lot && <div className="mt-4"><OfferForm unit={latest.unit} maxQty={lot.quantity_available} submitLabel="Send counter-offer"
            initial={{ quantity: latest.quantity, price_per_unit: latest.price_per_unit, delivery_mode: latest.delivery_mode, payment_terms: latest.payment_terms, advance_pct: latest.advance_pct ?? '', payment_due_days: latest.payment_due_days ?? '', note: '', charges: latest.charges ?? [] }}
            onSubmit={(b) => respond('counter', { counter: b })} /></div>}
        </Section>
      ) : latest.status === 'pending' ? (
        <Section><p className="text-sm text-gray-600">Waiting for the other side to reply.</p>
          {latest.created_by && <Button variant="outline" size="sm" className="mt-2" onClick={async () => { await api.post(`/v1/offers/${latest.id}/withdraw`).catch((e) => toast(e.message, 'error')); r.reload(); }}>Withdraw my offer</Button>}
        </Section>
      ) : null}
    </div>
  );
}

export function OrderPage() {
  const { id } = useParams();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const step = useStepUp();
  const r = useAsync(() => api.get(`/v1/orders/${id}`), [id]);
  const [modal, setModal] = useState<null | 'deliver' | 'amend' | 'cancel' | 'transport' | 'dispute'>(null);
  if (r.loading) return <Skeleton lines={8} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const { order: o, my_side, farmer, buyer, events, amendments, payments, transport, disputes } = r.data;
  const act = async (fn: () => Promise<any>, msg: string) => { try { const res = await step.exec(fn); if (res !== undefined) { toast(msg); setModal(null); r.reload(); } } catch (e: any) { toast(e.message, 'error'); } };
  const myConfirmed = my_side === 'farmer' ? o.farmer_confirmed_at : o.buyer_confirmed_at;
  const pendingAmend = amendments.find((a: any) => a.status === 'pending');
  return (
    <div className="space-y-4">
      {node}{step.node}
      <PageHeader title={`Order ${o.order_no}`} icon={<Handshake />} subtitle={<span className="flex items-center gap-2"><StatusBadge status={o.status} /> {o.commodity}{o.variety && ` · ${o.variety}`}</span>}
        actions={<Link to={`/trade/orders/${o.id}/statement`}><Button variant="outline"><Printer className="mr-1 h-4 w-4" />Statement</Button></Link>} />

      {o.status === 'pending_confirmation' && (
        <Notice tone="warn" title="Both sides must confirm these terms">
          Quantity is reserved until {fmtDateTime(o.reservation_expires_at)}. Farmer: {o.farmer_confirmed_at ? 'confirmed ✓' : 'not yet'} · Buyer: {o.buyer_confirmed_at ? 'confirmed ✓' : 'not yet'}
          {r.data.stepup_required && <span className="block">High-value order: you will be asked for a one-time code.</span>}
        </Notice>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Agreed terms" className="lg:col-span-2">
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-gray-500">Quantity</dt><dd>{o.quantity} {o.unit}{o.received_quantity != null && ` (accepted at delivery: ${o.received_quantity})`}</dd>
            <dt className="text-gray-500">Price</dt><dd>{inr(o.price_per_unit)}/{o.unit}</dd>
            <dt className="text-gray-500">Delivery</dt><dd>{DELIVERY_LABEL[o.delivery_mode]}</dd>
            <dt className="text-gray-500">Pickup</dt><dd>{o.pickup_location || '—'}</dd>
            <dt className="text-gray-500">Deliver to</dt><dd>{o.delivery_location || '—'}</dd>
            <dt className="text-gray-500">Payment</dt><dd>{TERMS_LABEL[o.payment_terms]}{o.advance_pct ? ` – ${o.advance_pct}% advance` : ''}{o.payment_due_days ? ` – ${o.payment_due_days} days` : ''}</dd>
            {o.inspection_status && <><dt className="text-gray-500">Inspection</dt><dd>{o.inspection_status.replace('_', ' ')}{o.inspection_notes && `: ${o.inspection_notes}`}</dd></>}
          </dl>
          <div className="mt-3"><Breakdown b={o.breakdown} side={my_side} /></div>
          {o.final_settlement != null && <p className="mt-2 text-sm font-semibold">Final farmer settlement (accepted quantity): {inr(o.final_settlement)}</p>}
        </Section>
        <Section title="People">
          {[['Farmer', farmer], ['Buyer', buyer]].map(([label, p]: any) => (
            <div key={label} className="mb-3 text-sm"><p className="text-xs uppercase text-gray-500">{label}</p><p className="font-semibold">{p?.business_name || p?.name}</p>
              <p className="text-gray-600">{[p?.district, p?.state].filter(Boolean).join(', ')}</p>
              {p?.phone ? <a href={`tel:${p.phone}`} className="text-emerald-700 underline">{p.phone}</a> : <p className="text-xs text-gray-500">Phone shared after both confirm</p>}</div>
          ))}
        </Section>
      </div>

      <Section title="Actions">
        <div className="flex flex-wrap gap-2">
          {o.status === 'pending_confirmation' && !myConfirmed && <Button size="lg" onClick={async () => { if (await ask('Confirm these terms?', <Breakdown b={o.breakdown} side={my_side} />, { label: 'Confirm order' })) act(() => api.post(`/v1/orders/${o.id}/confirm`), 'Confirmed'); }}>Confirm order</Button>}
          {o.status === 'confirmed' && <Button variant="outline" onClick={() => act(() => api.post(`/v1/orders/${o.id}/progress`, { status: 'pickup_scheduled' }), 'Marked pickup scheduled')}>Mark pickup scheduled</Button>}
          {['confirmed', 'pickup_scheduled'].includes(o.status) && <Button variant="outline" onClick={() => act(() => api.post(`/v1/orders/${o.id}/progress`, { status: 'in_transit' }), 'Marked in transit')}>Mark in transit</Button>}
          {my_side === 'buyer' && ['confirmed', 'pickup_scheduled', 'in_transit'].includes(o.status) && <Button onClick={() => setModal('deliver')}>Record delivery & inspection</Button>}
          {['confirmed', 'pickup_scheduled'].includes(o.status) && <Button variant="outline" onClick={() => setModal('transport')}><Truck className="mr-1 h-4 w-4" />Arrange transport</Button>}
          {['pending_confirmation', 'confirmed', 'pickup_scheduled'].includes(o.status) && !pendingAmend && <Button variant="outline" onClick={() => setModal('amend')}>Propose change</Button>}
          {o.status === 'delivered' && <Button onClick={() => act(() => api.post(`/v1/orders/${o.id}/complete`), 'Order completed')}>Mark completed</Button>}
          {!['pending_confirmation', 'completed', 'cancelled'].includes(o.status) && <Button variant="outline" onClick={() => setModal('dispute')}>Report a problem</Button>}
          {['pending_confirmation', 'confirmed', 'pickup_scheduled'].includes(o.status) && <Button variant="ghost" className="text-red-700" onClick={() => setModal('cancel')}>Cancel order</Button>}
        </div>
      </Section>

      {pendingAmend && (
        <Notice tone="warn" title="Proposed change to terms">
          <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(pendingAmend.changes, null, 1)}</pre>
          <p>Reason: {pendingAmend.reason}</p>
          {pendingAmend.proposed_by !== (my_side === 'farmer' ? o.farmer_id : o.buyer_id) ? (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => act(() => api.post(`/v1/orders/${o.id}/amendments/${pendingAmend.id}/decide`, { decision: 'approve' }), 'Change approved')}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => act(() => api.post(`/v1/orders/${o.id}/amendments/${pendingAmend.id}/decide`, { decision: 'reject' }), 'Change rejected')}>Reject</Button>
            </div>
          ) : <p className="mt-1 text-xs">Waiting for the other side to approve.</p>}
        </Notice>
      )}

      <PaymentsSection payments={payments} onChange={r.reload} />

      {transport.length > 0 && (
        <Section title="Transport">
          <ul className="divide-y text-sm">{transport.map((t: any) => <li key={t.id}><Link to={`/trade/transport/${t.id}`} className="flex justify-between py-2 hover:bg-gray-50"><span>{t.pickup_address} → {t.drop_address}{t.cost && ` · ${inr(t.cost)} (${t.payer} pays)`}</span><StatusBadge status={t.status} /></Link></li>)}</ul>
        </Section>
      )}
      {disputes.length > 0 && (
        <Section title="Disputes"><ul className="text-sm">{disputes.map((d: any) => <li key={d.id}><Link className="underline" to={`/trade/disputes/${d.id}`}>{d.ref}</Link> · {d.category.replace(/_/g, ' ')} · <StatusBadge status={d.status} /></li>)}</ul></Section>
      )}
      <Section title="History">
        <ol className="space-y-1 text-sm">{events.map((e: any, i: number) => <li key={i}><span className="text-gray-500">{fmtDateTime(e.created_at)}</span> · {e.event.replace(/_/g, ' ')}</li>)}</ol>
      </Section>

      <DeliverModal open={modal === 'deliver'} order={o} onClose={() => setModal(null)} onSubmit={(b) => act(() => api.post(`/v1/orders/${o.id}/deliver`, b), 'Delivery recorded')} />
      <AmendModal open={modal === 'amend'} order={o} onClose={() => setModal(null)} onSubmit={(b) => act(() => api.post(`/v1/orders/${o.id}/amendments`, b), 'Change proposed')} />
      <CancelModal open={modal === 'cancel'} confirmed={o.status !== 'pending_confirmation'} onClose={() => setModal(null)} onSubmit={(reason) => act(() => api.post(`/v1/orders/${o.id}/cancel`, { reason, confirm: true }), 'Order cancelled')} />
      <TransportModal open={modal === 'transport'} order={o} mySide={my_side} onClose={() => setModal(null)} onDone={() => { setModal(null); r.reload(); }} />
      <DisputeModal open={modal === 'dispute'} orderId={o.id} onClose={() => setModal(null)} />
    </div>
  );
}

export function PaymentsSection({ payments, onChange }: { payments: any[]; onChange: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [paying, setPaying] = useState<any>(null);
  const [method, setMethod] = useState('upi');
  const [refNo, setRefNo] = useState('');
  if (!payments.length) return null;
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); setPaying(null); onChange(); } catch (e: any) { toast(e.message, 'error'); } };
  return (
    <Section title="Payments" description="FARMDirect does not hold money in escrow. A payment counts as paid only after the recipient confirms it, or the payment provider verifies it.">
      <ul className="divide-y text-sm">
        {payments.map((p: any) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <div><p className="font-semibold">{p.kind.replace('_', ' ')} · {inr(p.amount)}</p><p className="text-xs text-gray-500">{p.ref}{p.due_date ? ` · due ${fmtDate(p.due_date)}` : ' · due on delivery'}{p.reference_note && ` · ${p.reference_note}`}{p.paid_at && ` · ${fmtDateTime(p.paid_at)}`}</p></div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={p.status} />
              {p.payer_id === user?.id && ['required', 'refund_pending', 'failed'].includes(p.status) && p.amount > 0 && <Button size="sm" onClick={() => setPaying(p)}>I have paid</Button>}
              {p.payee_id === user?.id && ['pending', 'refund_pending'].includes(p.status) && <Button size="sm" onClick={() => act(() => api.post(`/v1/payments/${p.id}/confirm-receipt`), 'Receipt confirmed')}>Confirm money received</Button>}
              {['pending', 'required'].includes(p.status) && <button className="text-xs text-red-700 underline" onClick={() => act(() => api.post(`/v1/payments/${p.id}/report-problem`, {}), 'Reported')}>Problem</button>}
            </div>
          </li>
        ))}
      </ul>
      <Modal open={!!paying} onClose={() => setPaying(null)} title="Record your payment">
        {paying && (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); act(() => api.post(`/v1/payments/${paying.id}/mark-paid`, { method_note: method, reference: refNo || null }), 'Recorded – waiting for the recipient to confirm'); }}>
            <p className="text-sm">Amount: <b>{inr(paying.amount)}</b>. Pay the recipient directly, then record it here.</p>
            <Select aria-label="Method" value={method} onChange={(e) => setMethod(e.target.value)} options={[{ value: 'upi', label: 'UPI' }, { value: 'bank_transfer', label: 'Bank transfer' }, { value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' }, { value: 'other', label: 'Other' }]} />
            <Input aria-label="Reference" placeholder="UTR / transaction reference (recommended)" value={refNo} onChange={(e) => setRefNo(e.target.value)} />
            <Notice>Never share your UPI PIN, card number or OTP with anyone.</Notice>
            <Button type="submit" className="w-full">Record payment</Button>
          </form>
        )}
      </Modal>
    </Section>
  );
}

function DeliverModal({ open, order, onClose, onSubmit }: { open: boolean; order: any; onClose: () => void; onSubmit: (b: any) => void }) {
  const [qty, setQty] = useState(String(order.quantity));
  const [status, setStatus] = useState('accepted');
  const [notes, setNotes] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Record delivery & quality inspection">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit({ received_quantity: Number(qty), inspection_status: status, inspection_notes: notes || null }); }}>
        <Field label={`Quantity received (${order.unit})`} hint={`Agreed: ${order.quantity}`}>{(id) => <Input id={id} type="number" min="0" step="0.01" max={order.quantity} value={qty} onChange={(e) => setQty(e.target.value)} required />}</Field>
        <Field label="Inspection result">{(id) => <Select id={id} value={status} onChange={(e) => setStatus(e.target.value)} options={[{ value: 'accepted', label: 'Accepted' }, { value: 'partially_accepted', label: 'Partly accepted' }, { value: 'rejected', label: 'Rejected' }]} />}</Field>
        <Field label="Notes">{(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Moisture, damage, shortfall…" />}</Field>
        <p className="text-xs text-gray-500">Payment is recalculated on the accepted quantity. If you disagree on quality, report a problem after recording.</p>
        <Button type="submit" className="w-full">Save</Button>
      </form>
    </Modal>
  );
}

function AmendModal({ open, order, onClose, onSubmit }: { open: boolean; order: any; onClose: () => void; onSubmit: (b: any) => void }) {
  const [f, setF] = useState({ quantity: '', price_per_unit: '', delivery_location: '', reason: '' });
  return (
    <Modal open={open} onClose={onClose} title="Propose a change to the terms">
      <form className="space-y-3" onSubmit={(e) => {
        e.preventDefault();
        const changes: any = {};
        if (f.quantity) changes.quantity = Number(f.quantity);
        if (f.price_per_unit) changes.price_per_unit = Number(f.price_per_unit);
        if (f.delivery_location) changes.delivery_location = f.delivery_location;
        onSubmit({ changes, reason: f.reason });
      }}>
        <Field label={`New quantity (now ${order.quantity})`}>{(id) => <Input id={id} type="number" min="0" value={f.quantity} onChange={(e) => setF({ ...f, quantity: e.target.value })} />}</Field>
        <Field label={`New price (now ${inr(order.price_per_unit)})`}>{(id) => <Input id={id} type="number" min="0" value={f.price_per_unit} onChange={(e) => setF({ ...f, price_per_unit: e.target.value })} />}</Field>
        <Field label="New delivery location">{(id) => <Input id={id} value={f.delivery_location} onChange={(e) => setF({ ...f, delivery_location: e.target.value })} />}</Field>
        <Field label="Reason" required>{(id) => <Textarea id={id} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} required />}</Field>
        <p className="text-xs text-gray-500">The other side must approve. The change and approval are recorded in the order history.</p>
        <Button type="submit" className="w-full">Send proposal</Button>
      </form>
    </Modal>
  );
}

function CancelModal({ open, confirmed, onClose, onSubmit }: { open: boolean; confirmed: boolean; onClose: () => void; onSubmit: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Cancel this order?">
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSubmit(reason); }}>
        {confirmed && <Notice tone="warn">This order is confirmed. Cancelling affects your track record and needs a one-time code. Money already paid becomes a refund due.</Notice>}
        <Field label="Reason" required>{(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} required />}</Field>
        <Button type="submit" variant="destructive" className="w-full">Cancel order</Button>
      </form>
    </Modal>
  );
}

function TransportModal({ open, order, mySide, onClose, onDone }: { open: boolean; order: any; mySide: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ pickup_address: order.pickup_location || '', drop_address: order.delivery_location || '', quantity_qtl: order.unit === 'quintal' ? order.quantity : order.unit === 'tonne' ? order.quantity * 10 : order.quantity / 100, preferred_date: '', packaging: '', payer: mySide === 'farmer' ? 'farmer' : 'buyer' });
  return (
    <Modal open={open} onClose={onClose} title="Request transport quotes">
      <form className="space-y-3" onSubmit={async (e: FormEvent) => {
        e.preventDefault();
        try { const r = await api.post('/v1/transport/requests', { ...f, order_id: order.id, quantity_qtl: Number(f.quantity_qtl), packaging: f.packaging || null }); toast(`Request sent to ${r.providers_notified} verified transporter(s)`); onDone(); }
        catch (er: any) { toast(er.message, 'error'); }
      }}>
        <Field label="Pickup address" required>{(id) => <Input id={id} value={f.pickup_address} onChange={(e) => setF({ ...f, pickup_address: e.target.value })} required />}</Field>
        <Field label="Drop address" required>{(id) => <Input id={id} value={f.drop_address} onChange={(e) => setF({ ...f, drop_address: e.target.value })} required />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Quantity (quintal)">{(id) => <Input id={id} type="number" min="0" value={f.quantity_qtl} onChange={(e) => setF({ ...f, quantity_qtl: e.target.value as any })} required />}</Field>
          <Field label="Pickup date" required>{(id) => <Input id={id} type="date" value={f.preferred_date} onChange={(e) => setF({ ...f, preferred_date: e.target.value })} required />}</Field>
          <Field label="Packaging">{(id) => <Input id={id} value={f.packaging} onChange={(e) => setF({ ...f, packaging: e.target.value })} />}</Field>
          <Field label="Who pays">{(id) => <Select id={id} value={f.payer} onChange={(e) => setF({ ...f, payer: e.target.value })} options={[{ value: 'buyer', label: 'Buyer' }, { value: 'farmer', label: 'Farmer' }]} />}</Field>
        </div>
        <Button type="submit" className="w-full">Request quotes</Button>
      </form>
    </Modal>
  );
}

export function DisputeModal({ open, orderId, bookingId, onClose }: { open: boolean; orderId?: string; bookingId?: string; onClose: () => void }) {
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ category: bookingId ? 'storage_condition' : 'quantity_mismatch', description: '', requested_resolution: '' });
  return (
    <Modal open={open} onClose={onClose} title="Report a problem (open a dispute)">
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault();
        try { const r = await api.post('/v1/disputes', { ...f, order_id: orderId ?? null, booking_id: bookingId ?? null }); toast(`Dispute ${r.ref} opened`); nav(`/trade/disputes/${r.id}`); }
        catch (er: any) { toast(er.message, 'error'); }
      }}>
        <Field label="What went wrong?">{(id) => <Select id={id} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={[
          ['quantity_mismatch', 'Quantity mismatch'], ['quality_disagreement', 'Quality disagreement'], ['non_delivery', 'Not delivered'], ['damaged_produce', 'Damaged produce'],
          ['late_pickup', 'Late pickup'], ['storage_condition', 'Storage condition'], ['unexpected_charges', 'Unexpected charges'], ['payment_delay', 'Payment delay'], ['suspected_fraud', 'Suspected fraud'], ['other', 'Other'],
        ].map(([value, label]) => ({ value, label }))} />}</Field>
        <Field label="Describe what happened" required>{(id) => <Textarea id={id} rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} required />}</Field>
        <Field label="What would resolve it?" required>{(id) => <Textarea id={id} value={f.requested_resolution} onChange={(e) => setF({ ...f, requested_resolution: e.target.value })} required />}</Field>
        <p className="text-xs text-gray-500">You can add photos and documents on the next screen. A resolution officer will review the case.</p>
        <Button type="submit" className="w-full">Open dispute</Button>
      </form>
    </Modal>
  );
}

export function StatementPage() {
  const { id } = useParams();
  const r = useAsync(() => api.get(`/v1/orders/${id}/statement`), [id]);
  if (r.loading) return <Skeleton lines={8} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const { order: o, farmer, buyer, payments } = r.data;
  const b = o.breakdown;
  return (
    <div className="mx-auto max-w-2xl bg-white p-6 print:p-0">
      <div className="mb-4 flex items-center justify-between print:hidden"><Link to={`/trade/orders/${o.id}`} className="underline">← Back to order</Link><Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Print / save PDF</Button></div>
      <h1 className="text-2xl font-bold">Transaction statement</h1>
      <p className="text-sm text-gray-600">Order {o.order_no} · generated {fmtDateTime(r.data.generated_at)} · FARMDirect</p>
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div><p className="text-xs uppercase text-gray-500">Seller (farmer)</p><p className="font-semibold">{farmer?.full_name}</p><p>{[farmer?.district, farmer?.state].filter(Boolean).join(', ')}</p></div>
        <div><p className="text-xs uppercase text-gray-500">Buyer</p><p className="font-semibold">{buyer?.business_name || buyer?.full_name}</p></div>
      </div>
      <table className="mt-4 w-full text-sm">
        <tbody>
          <tr className="border-b"><td className="py-1">{o.commodity}{o.variety && ` (${o.variety})`}: {o.quantity} {o.unit} × {inr(o.price_per_unit)}</td><td className="py-1 text-right">{inr(b.product_value)}</td></tr>
          {(b.charges || []).map((c: any, i: number) => <tr key={i} className="border-b"><td className="py-1">{c.label} ({c.payer} pays)</td><td className="py-1 text-right">{inr(c.amount)}</td></tr>)}
          {b.platform_fee_buyer > 0 && <tr className="border-b"><td>Platform fee (buyer)</td><td className="text-right">{inr(b.platform_fee_buyer)}</td></tr>}
          {b.platform_fee_farmer > 0 && <tr className="border-b"><td>Platform fee (farmer)</td><td className="text-right">{inr(b.platform_fee_farmer)}</td></tr>}
          {b.tax_on_fees > 0 && <tr className="border-b"><td>Tax on platform fees</td><td className="text-right">{inr(b.tax_on_fees)}</td></tr>}
          <tr className="border-b font-semibold"><td className="py-1">Buyer payable (agreed)</td><td className="py-1 text-right">{inr(b.buyer_payable)}</td></tr>
          <tr className="font-semibold"><td className="py-1">Farmer net (agreed)</td><td className="py-1 text-right">{inr(b.farmer_net)}</td></tr>
          {o.final_settlement != null && <tr className="font-semibold"><td className="py-1">Final settlement on {o.received_quantity} {o.unit} accepted</td><td className="py-1 text-right">{inr(o.final_settlement)}</td></tr>}
        </tbody>
      </table>
      <h2 className="mt-6 font-semibold">Payments</h2>
      <table className="w-full text-sm">
        <thead className="text-left text-xs text-gray-500"><tr><th>Ref</th><th>Type</th><th>Status</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{payments.map((p: any) => <tr key={p.ref} className="border-t"><td>{p.ref}</td><td>{p.kind}</td><td>{p.status}</td><td>{p.provider_payment_id || p.reference_note || '—'}</td><td className="text-right">{inr(p.amount)}</td></tr>)}</tbody>
      </table>
      <p className="mt-6 text-xs text-gray-500">Status: {o.status}. Payments marked "confirmed" were confirmed by the recipient or verified by the payment provider. FARMDirect does not hold funds in escrow. No tax is added to produce value.</p>
    </div>
  );
}

export function DisputePage() {
  const { id } = useParams();
  const toast = useToast();
  const r = useAsync(() => api.get(`/v1/disputes/${id}`), [id]);
  const [comment, setComment] = useState('');
  const [appeal, setAppeal] = useState('');
  const [file, setFile] = useState<File | null>(null);
  if (r.loading) return <Skeleton lines={6} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const { dispute: d, events, evidence, can_appeal } = r.data;
  const closed = ['resolved', 'rejected'].includes(d.status);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title={`Dispute ${d.ref}`} icon={<FileText />} subtitle={<span className="flex items-center gap-2"><StatusBadge status={d.status} /> {d.category.replace(/_/g, ' ')}</span>} />
      {d.resolution && <Notice tone={d.status === 'resolved' ? 'ok' : 'warn'} title="Decision">{d.resolution}</Notice>}
      <Section title="Case timeline" description="This history cannot be edited or deleted.">
        <ol className="space-y-3">{events.map((e: any, i: number) => (
          <li key={i} className={`rounded-xl p-3 text-sm ${e.internal ? 'bg-amber-50' : e.actor_role && ['dispute_officer', 'admin', 'super_admin'].includes(e.actor_role) ? 'bg-sky-50' : 'bg-gray-50'}`}>
            <p className="text-xs text-gray-500">{fmtDateTime(e.created_at)} · {e.actor_name ?? 'System'} · {e.kind.replace('_', ' ')}{e.internal ? ' (internal)' : ''}</p>
            <p className="mt-1 whitespace-pre-wrap">{e.body}</p>
          </li>))}</ol>
      </Section>
      <Section title="Evidence">
        {evidence.length === 0 ? <p className="text-sm text-gray-500">No evidence yet.</p> : <ul className="space-y-1">{evidence.map((ev: any) => <li key={ev.id}><DocLink id={ev.id} label={`${ev.original_name || ev.mime} · ${fmtDate(ev.created_at)}`} /></li>)}</ul>}
        {!closed && (
          <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={async (e) => {
            e.preventDefault(); if (!file) return;
            const fd = new FormData(); fd.append('file', file);
            try { await api.post(`/v1/disputes/${d.id}/evidence`, fd); toast('Evidence added'); setFile(null); r.reload(); } catch (er: any) { toast(er.message, 'error'); }
          }}>
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} aria-label="Evidence file" className="text-sm" />
            <Button type="submit" size="sm" disabled={!file}>Upload</Button>
          </form>
        )}
      </Section>
      {!closed && (
        <Section title="Add a message">
          <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); try { await api.post(`/v1/disputes/${d.id}/comments`, { body: comment }); setComment(''); r.reload(); } catch (er: any) { toast(er.message, 'error'); } }}>
            <Textarea aria-label="Message" value={comment} onChange={(e) => setComment(e.target.value)} required />
            <Button type="submit" size="sm">Send</Button>
          </form>
        </Section>
      )}
      {can_appeal && (
        <Section title="Appeal the decision" description="One appeal within 14 days. A different officer reviews it.">
          <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); try { await api.post(`/v1/disputes/${d.id}/appeal`, { statement: appeal }); toast('Appeal submitted'); r.reload(); } catch (er: any) { toast(er.message, 'error'); } }}>
            <Textarea aria-label="Appeal" value={appeal} onChange={(e) => setAppeal(e.target.value)} required placeholder="Why should the decision change?" />
            <Button type="submit" size="sm">Submit appeal</Button>
          </form>
        </Section>
      )}
    </div>
  );
}

export function TransportRequestPage() {
  const { id } = useParams();
  const toast = useToast();
  const r = useAsync(() => api.get(`/v1/transport/requests/${id}`), [id]);
  if (r.loading) return <Skeleton lines={6} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const { request: t, quotes, milestones, my_side, tracking_note } = r.data;
  const act = async (fn: () => Promise<any>, msg: string) => { try { await fn(); toast(msg); r.reload(); } catch (e: any) { toast(e.message, 'error'); } };
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Transport request" icon={<Truck />} subtitle={<span className="flex items-center gap-2"><StatusBadge status={t.status} /> {t.pickup_address} → {t.drop_address}</span>} />
      <Section>
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <dt className="text-gray-500">Quantity</dt><dd>{t.quantity_qtl} quintal</dd>
          <dt className="text-gray-500">Pickup date</dt><dd>{fmtDate(t.preferred_date)}</dd>
          <dt className="text-gray-500">Distance</dt><dd>{t.distance_km ? `~${t.distance_km} km (estimate)` : '—'}</dd>
          <dt className="text-gray-500">Cost</dt><dd>{t.cost ? `${inr(t.cost)} (${t.payer} pays)` : '—'}</dd>
        </dl>
      </Section>
      <Section title="Quotes from verified transporters">
        {!quotes.length ? <p className="text-sm text-gray-500">No quotes yet.</p> : (
          <ul className="divide-y text-sm">{quotes.map((q: any) => (
            <li key={q.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span><b>{q.provider_name}</b> · {inr(q.amount)}{q.eta_date && ` · pickup ${fmtDate(q.eta_date)}`}{q.note && ` · ${q.note}`}</span>
              {my_side === 'requester' && q.status === 'offered' && ['requested', 'quoted'].includes(t.status) ? <Button size="sm" onClick={() => act(() => api.post(`/v1/transport/requests/${t.id}/accept-quote`, { quote_id: q.id, confirm: true }), 'Quote accepted')}>Accept</Button> : <StatusBadge status={q.status} />}
            </li>))}</ul>
        )}
      </Section>
      <Section title="Milestones" description={tracking_note}>
        <ol className="space-y-1 text-sm">{milestones.map((m: any, i: number) => <li key={i}><span className="text-gray-500">{fmtDateTime(m.created_at)}</span> · <b>{m.event.replace('_', ' ')}</b>{m.note && ` – ${m.note}`}</li>)}</ol>
        {['requester', 'party'].includes(my_side) && ['accepted', 'picked_up', 'in_transit'].includes(t.status) && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => act(() => api.post(`/v1/transport/requests/${t.id}/confirm-delivery`, {}), 'Delivery confirmed')}>Confirm delivered</Button>
            <Button size="sm" variant="outline" onClick={() => act(() => api.post(`/v1/transport/requests/${t.id}/confirm-delivery`, { damage: true, note: 'Damage reported at delivery' }), 'Damage recorded')}>Delivered with damage</Button>
          </div>
        )}
      </Section>
    </div>
  );
}

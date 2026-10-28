import { useEffect, useState } from 'react';
import { FileText, ShieldCheck, Volume2 } from 'lucide-react';
import { api, inr } from './api';
import { useAuth } from './auth';
import { LANGUAGES } from './i18n';
import { Badge, Button, ErrorBox, Field, Input, Modal, Notice, Spinner } from './ui';

/** Human labels and colours for marketplace statuses. */
const STATUS: Record<string, [string, 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'purple']> = {
  draft: ['Draft', 'gray'], published: ['Published', 'green'], offer_received: ['Offer received', 'blue'], negotiation: ['Negotiating', 'blue'],
  reserved: ['Reserved', 'amber'], partially_sold: ['Partly sold', 'purple'], sold: ['Sold', 'green'], expired: ['Expired', 'gray'],
  withdrawn: ['Withdrawn', 'gray'], disputed: ['Disputed', 'red'],
  pending: ['Waiting for reply', 'amber'], countered: ['Countered', 'gray'], accepted: ['Accepted', 'green'], rejected: ['Rejected', 'red'],
  pending_confirmation: ['Waiting for both to confirm', 'amber'], confirmed: ['Confirmed', 'green'], pickup_scheduled: ['Pickup scheduled', 'blue'],
  in_transit: ['In transit', 'blue'], delivered: ['Delivered', 'purple'], completed: ['Completed', 'green'], cancelled: ['Cancelled', 'gray'],
  availability_requested: ['Requested – waiting for facility', 'amber'], temporarily_reserved: ['Temporarily reserved', 'amber'],
  awaiting_payment: ['Booking fee due', 'amber'], check_in_scheduled: ['Check-in scheduled', 'blue'], received: ['Received', 'blue'],
  in_storage: ['In storage', 'green'], release_requested: ['Release requested', 'amber'], released: ['Released', 'purple'], declined: ['Declined', 'red'],
  required: ['Payment due', 'amber'], initiated: ['Payment started', 'blue'], refund_pending: ['Refund due', 'amber'], refunded: ['Refunded', 'green'],
  settled: ['Settled', 'green'], failed: ['Not paid / void', 'gray'],
  open: ['Open', 'amber'], under_review: ['Under review', 'blue'], awaiting_evidence: ['Evidence requested', 'amber'], escalated: ['Escalated', 'red'],
  resolved: ['Resolved', 'green'], appealed: ['Appealed', 'purple'], partially_filled: ['Partly filled', 'purple'], filled: ['Filled', 'green'], closed: ['Closed', 'gray'],
  requested: ['Requested', 'amber'], quoted: ['Quotes received', 'blue'], picked_up: ['Picked up', 'blue'], exception: ['Problem reported', 'red'],
  verified: ['Verified', 'green'], pending_review: ['Under review', 'blue'], suspended: ['Suspended', 'red'], mobile_verified: ['Mobile verified', 'gray'],
  documents_pending: ['Documents needed', 'amber'], info_required: ['More information needed', 'amber'], deactivated: ['Deactivated', 'gray'],
  submitted: ['Submitted', 'blue'], approved: ['Approved', 'green'],
};

export function StatusBadge({ status }: { status: string }) {
  const [label, tone] = STATUS[status] ?? [status.replace(/_/g, ' '), 'gray'];
  return <Badge tone={tone}>{label}</Badge>;
}

/** Transparent cost breakdown shown before anyone confirms. */
export function Breakdown({ b, unit, side }: { b: any; unit?: string; side?: 'buyer' | 'farmer' | 'staff' }) {
  if (!b) return null;
  const row = (label: string, v: number, strong = false, sub?: string) => (
    <div className={`flex justify-between gap-2 py-1 ${strong ? 'border-t font-semibold' : ''}`}>
      <span>{label}{sub && <span className="block text-xs font-normal text-gray-500">{sub}</span>}</span><span>{inr(v)}</span>
    </div>
  );
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm">
      {row('Product value', b.product_value, false, unit)}
      {(b.charges || []).map((c: any, i: number) => row(`${c.label} (${c.payer === 'buyer' ? 'buyer pays' : 'farmer pays'})`, c.amount))}
      {b.platform_fee_buyer > 0 && row(`Platform fee – buyer (${b.platform_fee_pct.buyer}%)`, b.platform_fee_buyer)}
      {b.platform_fee_farmer > 0 && row(`Platform fee – farmer (${b.platform_fee_pct.farmer}%)`, b.platform_fee_farmer)}
      {b.tax_on_fees > 0 && row('Tax on platform fees', b.tax_on_fees)}
      {side !== 'farmer' && row('Total buyer pays', b.buyer_payable, true)}
      {side !== 'buyer' && row('Farmer receives (estimated)', b.farmer_net, true)}
      <p className="mt-1 text-xs text-gray-500">{b.tax_note} No platform fee is charged unless shown above.</p>
    </div>
  );
}

/** Asks for a one-time code before high-risk actions; resolves when verified. */
export function StepUpModal({ open, onDone, onCancel, reason }: { open: boolean; onDone: () => void; onCancel: () => void; reason: string }) {
  const [sent, setSent] = useState<{ devCode?: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [err, setErr] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!open) { setSent(null); setOtp(''); setErr(null); } }, [open]);
  return (
    <Modal open={open} onClose={onCancel} title="Confirm it's you">
      <div className="space-y-3">
        <p className="text-sm text-gray-700">{reason}</p>
        {!sent ? (
          <Button className="w-full" disabled={busy} onClick={async () => { setBusy(true); setErr(null); try { setSent(await api.post('/auth/step-up/request')); } catch (e) { setErr(e); } finally { setBusy(false); } }}>
            {busy ? <Spinner /> : 'Send code to my phone'}
          </Button>
        ) : (
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setErr(null);
            try { await api.post('/auth/step-up/verify', { otp }); onDone(); } catch (er) { setErr(er); } finally { setBusy(false); }
          }}>
            {sent.devCode && <Notice tone="warn">Development mode – code: <b className="font-mono">{sent.devCode}</b></Notice>}
            <Field label="6-digit code">{(id) => <Input id={id} inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} required autoFocus />}</Field>
            <Button type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : 'Verify'}</Button>
          </form>
        )}
        {err && <ErrorBox error={err} />}
      </div>
    </Modal>
  );
}

/** Runs an action; if the server asks for step-up, shows the OTP dialog and retries once. */
export function useStepUp() {
  const [pending, setPending] = useState<{ run: () => Promise<any>; reason: string } | null>(null);
  const exec = async (run: () => Promise<any>) => {
    try { return await run(); }
    catch (e: any) {
      if (e?.code === 'step_up_required') { setPending({ run, reason: e.message }); return undefined; }
      throw e;
    }
  };
  const node = (
    <StepUpModal open={!!pending} reason={pending?.reason ?? ''} onCancel={() => setPending(null)}
      onDone={async () => { const p = pending; setPending(null); await p?.run(); }} />
  );
  return { exec, node };
}

/** Opens a private document through a short-lived signed link. */
export function DocLink({ id, label }: { id: string; label?: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button type="button" disabled={busy} className="inline-flex items-center gap-1 text-sm text-emerald-700 underline"
      onClick={async () => { setBusy(true); try { const r = await api.get(`/v1/documents/${id}/link`); window.open(r.url, '_blank', 'noopener'); } catch (e: any) { alert(e.message); } finally { setBusy(false); } }}>
      <FileText className="h-4 w-4" aria-hidden />{label ?? 'View document'}
    </button>
  );
}

/** Loads a private image (lot photo, receipt photo) via a signed link. */
export function PrivateImage({ id, alt, className }: { id: string; alt: string; className?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => { let on = true; api.get(`/v1/documents/${id}/link`).then((r) => on && setSrc(r.url)).catch(() => {}); return () => { on = false; }; }, [id]);
  return src ? <img src={src} alt={alt} loading="lazy" className={className} /> : <div className={`animate-pulse bg-gray-200 ${className}`} />;
}

/** Reads a step's instructions aloud for farmers who prefer listening. */
export function VoiceHint({ text }: { text: string }) {
  const { lang } = useAuth();
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return (
    <button type="button" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
      onClick={() => { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.lang = LANGUAGES.find((l) => l.code === lang)?.speech || 'en-IN'; window.speechSynthesis.speak(u); }}>
      <Volume2 className="h-4 w-4" aria-hidden /> Listen
    </button>
  );
}

export function VerifiedSeller({ level }: { level: number }) {
  return level >= 3 ? <Badge tone="green"><ShieldCheck className="h-3 w-3" />ID verified</Badge> : level >= 2 ? <Badge tone="blue">Profile verified</Badge> : <Badge>Mobile verified</Badge>;
}

export const DELIVERY_LABEL: Record<string, string> = {
  buyer_pickup: 'Buyer picks up', farmer_delivery: 'Farmer delivers', arranged_transport: 'Transport arranged on FARMDirect', from_storage: 'Collected from storage',
};
export const TERMS_LABEL: Record<string, string> = { on_delivery: 'Full payment on delivery', advance_and_balance: 'Advance, balance on delivery', within_days: 'Pay within days of delivery' };

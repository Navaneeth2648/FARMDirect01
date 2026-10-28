import { Router } from 'express';
import { z } from 'zod';
import { q, type Row } from '../db/index.ts';
import { ah, forbidden, HttpError, notFound, parse, zOptText } from '../lib/http.ts';
import { hasPerm } from '../lib/permissions.ts';
import { audit } from '../lib/security.ts';
import { createGatewayOrder, razorpayConfigured, verifyCheckoutSignature, verifyWebhookSignature } from '../providers/razorpay.ts';
import { NotConfiguredError } from '../providers/fetcher.ts';
import { notifyT } from '../services/messages.ts';

export const paymentsRouter = Router();
export const webhooksRouter = Router();

const event = (paymentId: string | null, ev: string, actorId: string | null, payload?: unknown, providerEventId?: string) =>
  q.run('INSERT INTO payment_events (payment_id, provider_event_id, event, actor_id, payload) VALUES (?, ?, ?, ?, ?)',
    paymentId, providerEventId ?? null, ev, actorId, payload === undefined ? null : JSON.stringify(payload));

function load(paymentId: string, userId: string, role: string) {
  const p = q.get<Row>('SELECT * FROM payment_records WHERE id = ?', paymentId);
  if (!p) throw notFound('Payment');
  const side = p.payer_id === userId ? 'payer' : p.payee_id === userId ? 'payee' : hasPerm(role, 'payments.view') ? 'staff' : null;
  if (!side) throw notFound('Payment');
  return { p, side };
}

const notifyBoth = (p: Row, status: string) => {
  for (const uid of [p.payer_id, p.payee_id]) notifyT(uid, 'order', 'payment_update', { ref: p.ref, status }, `payment:${p.id}:${status}`, p.order_id ? `/trade/orders/${p.order_id}` : p.input_order_id ? '/inputs?tab=orders' : `/storage/bookings/${p.booking_id}`);
};

paymentsRouter.get('/', ah(async (req, res) => {
  const uid = req.user!.id;
  res.json({
    payments: q.all(`SELECT p.*, o.order_no, b.booking_ref FROM payment_records p LEFT JOIN orders o ON o.id = p.order_id LEFT JOIN storage_bookings b ON b.id = p.booking_id
      WHERE p.payer_id = ? OR p.payee_id = ? ORDER BY p.created_at DESC LIMIT 300`, uid, uid),
    gateway_configured: razorpayConfigured(),
    escrow_note: 'FARMDirect does not hold money in escrow. Payments go directly between buyer and seller and are tracked here.',
  });
}));

paymentsRouter.get('/:id', ah(async (req, res) => {
  const { p, side } = load(req.params.id, req.user!.id, req.user!.role);
  res.json({ payment: p, my_side: side, events: q.all('SELECT event, created_at FROM payment_events WHERE payment_id = ? ORDER BY id', p.id) });
}));

/** Payer says they paid outside the gateway (UPI/bank/cash). This is NOT a confirmation. */
paymentsRouter.post('/:id/mark-paid', ah(async (req, res) => {
  const b = parse(z.object({ method_note: z.enum(['upi', 'bank_transfer', 'cash', 'cheque', 'other']), reference: zOptText(100) }), req.body);
  const { p, side } = load(req.params.id, req.user!.id, req.user!.role);
  if (side !== 'payer') throw forbidden('Only the payer can record that they paid');
  if (!['required', 'refund_pending', 'failed'].includes(p.status)) throw new HttpError(409, `Payment is ${p.status}`, 'bad_state');
  q.run(`UPDATE payment_records SET status = 'pending', method = 'offline_recorded', reference_note = ?, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`,
    `${b.method_note}${b.reference ? ` ref ${b.reference}` : ''}`, p.id);
  event(p.id, 'payer_marked_paid', req.user!.id, b);
  notifyBoth(p, 'payer says paid – awaiting confirmation');
  res.json({ ok: true, status: 'pending', note: 'Recorded. The recipient must confirm receipt before this shows as paid.' });
}));

/** The recipient confirms money arrived — the only way an offline payment becomes confirmed. */
paymentsRouter.post('/:id/confirm-receipt', ah(async (req, res) => {
  const { p, side } = load(req.params.id, req.user!.id, req.user!.role);
  if (side !== 'payee') throw forbidden('Only the recipient can confirm receipt');
  if (!['pending', 'required', 'refund_pending'].includes(p.status)) throw new HttpError(409, `Payment is ${p.status}`, 'bad_state');
  const status = p.kind === 'refund' ? 'refunded' : 'confirmed';
  q.run(`UPDATE payment_records SET status = ?, confirmed_by = ?, method = COALESCE(method, 'offline_recorded'), paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now') WHERE id = ?`, status, req.user!.id, p.id);
  event(p.id, 'payee_confirmed', req.user!.id);
  if (p.booking_id && status === 'confirmed') {
    // Booking fee confirmed → booking becomes confirmed.
    q.run(`UPDATE storage_bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'awaiting_payment'`, p.booking_id);
  }
  audit(req, 'payment.confirm_receipt', 'payment', p.id);
  notifyBoth(p, status);
  res.json({ ok: true, status });
}));

paymentsRouter.post('/:id/report-problem', ah(async (req, res) => {
  const { note } = parse(z.object({ note: zOptText(500) }), req.body);
  const { p, side } = load(req.params.id, req.user!.id, req.user!.role);
  if (side === 'staff') throw forbidden();
  q.run(`UPDATE payment_records SET status = 'disputed', updated_at = datetime('now') WHERE id = ?`, p.id);
  event(p.id, 'disputed', req.user!.id, { note });
  notifyBoth(p, 'disputed');
  res.json({ ok: true });
}));

paymentsRouter.post('/:id/gateway-order', ah(async (req, res) => {
  const { p, side } = load(req.params.id, req.user!.id, req.user!.role);
  if (side !== 'payer') throw forbidden();
  if (!['required', 'failed', 'initiated'].includes(p.status)) throw new HttpError(409, `Payment is ${p.status}`, 'bad_state');
  try {
    const o = await createGatewayOrder(p.amount, p.ref);
    q.run(`UPDATE payment_records SET status = 'initiated', method = 'gateway', provider = 'razorpay', provider_order_id = ?, updated_at = datetime('now') WHERE id = ?`, o.id, p.id);
    event(p.id, 'gateway_order_created', req.user!.id, { order_id: o.id });
    res.json({ key_id: process.env.RAZORPAY_KEY_ID, order_id: o.id, amount: o.amount, currency: o.currency });
  } catch (e) {
    if (e instanceof NotConfiguredError) throw new HttpError(503, 'Online payment is not configured. Pay directly and record it here.', 'not_configured', { setup: e.setup });
    throw new HttpError(503, 'Payment provider is unavailable', 'provider_unavailable');
  }
}));

/** Checkout callback. Signature is verified on the server; forged or replayed values are refused. */
paymentsRouter.post('/:id/gateway-verify', ah(async (req, res) => {
  const b = parse(z.object({ razorpay_order_id: z.string().max(100), razorpay_payment_id: z.string().max(100), razorpay_signature: z.string().max(200) }), req.body);
  const { p, side } = load(req.params.id, req.user!.id, req.user!.role);
  if (side !== 'payer') throw forbidden();
  if (!razorpayConfigured()) throw new HttpError(503, 'Online payment is not configured', 'not_configured');
  if (p.provider_order_id !== b.razorpay_order_id || !verifyCheckoutSignature(b.razorpay_order_id, b.razorpay_payment_id, b.razorpay_signature)) {
    event(p.id, 'signature_invalid', req.user!.id, { order_id: b.razorpay_order_id });
    audit(req, 'payment.forged_success_rejected', 'payment', p.id);
    throw new HttpError(400, 'Payment could not be verified', 'verification_failed');
  }
  if (q.get('SELECT 1 FROM payment_records WHERE provider_payment_id = ? AND id != ?', b.razorpay_payment_id, p.id)) throw new HttpError(409, 'This payment was already used', 'replay');
  q.run(`UPDATE payment_records SET status = 'confirmed', provider_payment_id = ?, paid_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status != 'confirmed'`, b.razorpay_payment_id, p.id);
  event(p.id, 'gateway_verified', req.user!.id, { payment_id: b.razorpay_payment_id });
  if (p.booking_id) q.run(`UPDATE storage_bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'awaiting_payment'`, p.booking_id);
  notifyBoth(p, 'confirmed');
  res.json({ ok: true, status: 'confirmed' });
}));

/** Razorpay webhook (no session). Signed body required; each provider event is processed once. */
webhooksRouter.post('/razorpay', ah(async (req, res) => {
  if (!verifyWebhookSignature(req.rawBody, req.headers['x-razorpay-signature'] as string | undefined)) {
    event(null, 'webhook_signature_invalid', null);
    throw new HttpError(401, 'Invalid signature', 'bad_signature');
  }
  const eventId = String(req.headers['x-razorpay-event-id'] || '');
  if (eventId && q.get('SELECT 1 FROM payment_events WHERE provider_event_id = ?', eventId)) return res.json({ ok: true, duplicate: true });
  const body = req.body as any;
  const entity = body?.payload?.payment?.entity;
  const p = entity?.order_id ? q.get<Row>('SELECT * FROM payment_records WHERE provider_order_id = ?', entity.order_id) : undefined;
  if (p && body.event === 'payment.captured') {
    q.run(`UPDATE payment_records SET status = 'confirmed', provider_payment_id = COALESCE(provider_payment_id, ?), paid_at = COALESCE(paid_at, datetime('now')), updated_at = datetime('now') WHERE id = ?`, entity.id, p.id);
    if (p.booking_id) q.run(`UPDATE storage_bookings SET status = 'confirmed', updated_at = datetime('now') WHERE id = ? AND status = 'awaiting_payment'`, p.booking_id);
  } else if (p && body.event === 'payment.failed') {
    q.run(`UPDATE payment_records SET status = 'failed', updated_at = datetime('now') WHERE id = ? AND status != 'confirmed'`, p.id);
  }
  event(p?.id ?? null, `webhook:${body?.event}`, null, { order_id: entity?.order_id }, eventId || undefined);
  res.json({ ok: true });
}));

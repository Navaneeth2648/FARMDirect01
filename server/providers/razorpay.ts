import crypto from 'node:crypto';
import { config } from '../config.ts';
import { fetchJson, NotConfiguredError } from './fetcher.ts';

/**
 * Razorpay adapter. Payment success is accepted only after server-side
 * signature verification (checkout callback) or a signed webhook. A frontend
 * "success" message alone never changes a payment's status.
 * No escrow is provided: funds go directly between the parties' accounts.
 */
export const razorpayConfigured = () => !!(config.razorpay.keyId && config.razorpay.keySecret);

export async function createGatewayOrder(amountInr: number, receipt: string) {
  if (!razorpayConfigured()) throw new NotConfiguredError('Razorpay', 'Set RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and RAZORPAY_WEBHOOK_SECRET.');
  const auth = Buffer.from(`${config.razorpay.keyId}:${config.razorpay.keySecret}`).toString('base64');
  return fetchJson<{ id: string; amount: number; currency: string }>('razorpay', 'order', 'https://api.razorpay.com/v1/orders', {
    method: 'POST', headers: { authorization: `Basic ${auth}`, 'content-type': 'application/json' },
    body: JSON.stringify({ amount: Math.round(amountInr * 100), currency: 'INR', receipt: receipt.slice(0, 40) }), retries: 1,
  });
}

const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
  if (!razorpayConfigured()) return false;
  const expected = crypto.createHmac('sha256', config.razorpay.keySecret).update(`${orderId}|${paymentId}`).digest('hex');
  return safeEqual(expected, signature || '');
}

export function verifyWebhookSignature(rawBody: Buffer | undefined, signature: string | undefined) {
  if (!config.razorpay.webhookSecret || !rawBody || !signature) return false;
  const expected = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature);
}

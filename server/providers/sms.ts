import { config } from '../config.ts';
import { fetchJson, logApi } from './fetcher.ts';

/**
 * SMS/OTP delivery. In development (no provider configured) the OTP is printed
 * to the server console so the flow can be tested. In production without a
 * provider, OTP sending fails with a clear setup message.
 */

export function smsConfigured() {
  const s = config.sms;
  if (s.provider === 'msg91') return !!(s.msg91AuthKey && s.msg91TemplateId);
  if (s.provider === 'twilio') return !!(s.twilioSid && s.twilioToken && s.twilioFrom);
  return false;
}

export async function sendOtp(phone: string, code: string): Promise<{ channel: 'sms' | 'dev_console' }> {
  try {
    return await deliver(phone, code);
  } catch (e) {
    // Development only: an SMS that cannot be delivered (for example to a number a trial
    // account has not verified) falls back to the console so local testing keeps working.
    if ((config.isProd && !config.demoMode) || config.isTest) throw e;
    console.log(`
[DEV OTP] SMS to ${phone} failed (${(e as Error).message}); code: ${code}
`);
    return { channel: 'dev_console' };
  }
}

async function deliver(phone: string, code: string): Promise<{ channel: 'sms' | 'dev_console' }> {
  const s = config.sms;
  if (!smsConfigured()) {
    if (config.isProd && !config.demoMode) throw new Error('SMS provider is not configured (set SMS_PROVIDER and credentials)');
    if (!config.isTest) console.log(`\n[DEV OTP] ${phone}: ${code}  (configure SMS_PROVIDER to send real SMS)\n`);
    return { channel: 'dev_console' };
  }
  if (s.provider === 'msg91') {
    const params = new URLSearchParams({ template_id: s.msg91TemplateId, mobile: phone.replace('+', ''), otp: code });
    await fetchJson('msg91', 'otp', `https://control.msg91.com/api/v5/otp?${params}`, {
      method: 'POST', headers: { authkey: s.msg91AuthKey, 'content-type': 'application/json' }, retries: 1,
    });
    return { channel: 'sms' };
  }
  const started = Date.now();
  const body = new URLSearchParams({ To: phone, From: s.twilioFrom, Body: `Your FARMDirect code is ${code}. It expires in 10 minutes.` });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${s.twilioSid}/Messages.json`, {
    method: 'POST',
    headers: { authorization: `Basic ${Buffer.from(`${s.twilioSid}:${s.twilioToken}`).toString('base64')}` },
    body,
  });
  const detail = res.ok ? undefined : await res.json().then((j: any) => `HTTP ${res.status} ${j.code ?? ''} ${j.message ?? ''}`.replace(/\+?\d{6,}/g, (m) => `***${m.slice(-4)}`).trim()).catch(() => `HTTP ${res.status}`);
  logApi('twilio', 'sms', res.ok, Date.now() - started, detail);
  if (!res.ok) throw new Error(`SMS delivery failed: ${detail}`);
  return { channel: 'sms' };
}

import { Router, type Request } from 'express';
import crypto from 'node:crypto';
import { z } from 'zod';
import { config } from '../config.ts';
import { q, out, insert, type Row } from '../db/index.ts';
import { ah, HttpError, id, parse, zPhone } from '../lib/http.ts';
import { createSession, destroySession, requireAuth, SELF_SERVICE_ROLES, NEEDS_VERIFICATION } from '../lib/auth.ts';
import { audit, hashPassword, hmac, ipHash, rateLimit, verifyPassword } from '../lib/security.ts';
import { isStaffRole, permissionsFor } from '../lib/permissions.ts';
import { sendOtp, smsConfigured } from '../providers/sms.ts';
import { checkRegistrationBurst } from '../services/fraud.ts';
import { notifyT } from '../services/messages.ts';
import { farmerStanding } from '../services/standing.ts';

export const authRouter = Router();

const OTP_TTL_MIN = 10;
const OTP_MAX_ATTEMPTS = 5;
const LOCK_AFTER = 5;
const LOCK_MINUTES = 15;
const NO_PASSWORD = '!otp-only';
const zPassword = z.string().min(8, 'Use at least 8 characters').max(128);
/** Administrators need longer passwords with letters and numbers. */
export const zStaffPassword = z.string().min(12, 'Administrator passwords need at least 12 characters').max(128)
  .regex(/[A-Za-z]/, 'Include letters').regex(/\d/, 'Include numbers');
const LANGS = ['en', 'hi', 'te', 'ml'] as const;

const otpLimiter = rateLimit({ name: 'otp', windowMs: 15 * 60_000, max: 5, key: (r) => String(r.body?.phone || r.ip) });
const otpIpLimiter = rateLimit({ name: 'otp-ip', windowMs: 60 * 60_000, max: 30 });
const loginLimiter = rateLimit({ name: 'login', windowMs: 15 * 60_000, max: 10, key: (r) => `${r.ip}:${r.body?.phone}` });

async function issueOtp(phone: string, purpose: string) {
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  q.run(`UPDATE otp_codes SET consumed_at = datetime('now') WHERE phone = ? AND purpose = ? AND consumed_at IS NULL`, phone, purpose);
  q.run(`INSERT INTO otp_codes (phone, purpose, code_hash, expires_at) VALUES (?, ?, ?, ?)`,
    phone, purpose, hmac(`${phone}:${purpose}:${code}`), new Date(Date.now() + OTP_TTL_MIN * 60_000).toISOString());
  let channel: string;
  try {
    channel = (await sendOtp(phone, code)).channel;
  } catch {
    throw new HttpError(503, 'We could not send the code right now. Please try again later.', 'sms_unavailable');
  }
  // Show the code on screen only in development when it was not sent by SMS.
  return (!config.isProd || config.demoMode) && channel === 'dev_console' ? code : undefined;
}

function checkOtp(phone: string, purpose: string, code: string) {
  const row = q.get<Row>(
    `SELECT * FROM otp_codes WHERE phone = ? AND purpose = ? AND consumed_at IS NULL ORDER BY id DESC LIMIT 1`, phone, purpose);
  if (!row || new Date(row.expires_at) < new Date()) throw new HttpError(400, 'The code has expired. Please request a new one.', 'otp_expired');
  if (row.attempts >= OTP_MAX_ATTEMPTS) throw new HttpError(429, 'Too many wrong attempts. Please request a new code.', 'otp_locked');
  const ok = crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hmac(`${phone}:${purpose}:${code}`)));
  if (!ok) {
    q.run('UPDATE otp_codes SET attempts = attempts + 1 WHERE id = ?', row.id);
    throw new HttpError(400, 'The code is incorrect.', 'otp_invalid');
  }
  q.run(`UPDATE otp_codes SET consumed_at = datetime('now') WHERE id = ?`, row.id);
}

/** Everything the client needs about the signed-in user. */
export function userPayload(userId: string) {
  const u = out(q.get<Row>('SELECT * FROM users WHERE id = ?', userId));
  if (!u) return null;
  const { failed_logins: _f, locked_until: _l, ...safe } = u as Row;
  return {
    ...safe,
    has_password: (q.get<Row>('SELECT password_hash FROM users WHERE id = ?', userId)?.password_hash ?? NO_PASSWORD) !== NO_PASSWORD,
    permissions: permissionsFor(u.role),
    is_staff: isStaffRole(u.role),
    buyer_profile: u.role === 'buyer' ? out(q.get('SELECT * FROM buyer_profiles WHERE user_id = ?', userId)) ?? null : undefined,
    farmer_standing: u.role === 'farmer' ? farmerStanding(userId) : undefined,
  };
}

function assertNotLocked(user: Row) {
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    const mins = Math.ceil((new Date(user.locked_until).getTime() - Date.now()) / 60000);
    throw new HttpError(429, `Too many failed attempts. Try again in ${mins} minute(s) or reset your password.`, 'locked');
  }
}

function recordFailure(req: Request, user: Row) {
  const n = (user.failed_logins || 0) + 1;
  if (n >= LOCK_AFTER) {
    q.run(`UPDATE users SET failed_logins = 0, locked_until = ? WHERE id = ?`, new Date(Date.now() + LOCK_MINUTES * 60_000).toISOString(), user.id);
    audit(req, 'auth.lockout', 'user', user.id);
    notifyT(user.id, 'system', 'security_warning', { status: 'Your account was locked after repeated failed sign-in attempts' }, `lockout:${user.id}:${Date.now()}`);
  } else {
    q.run('UPDATE users SET failed_logins = ? WHERE id = ?', n, user.id);
  }
  audit(req, 'auth.login_failed', 'user', user.id);
}

// Signed, short-lived token tying the second factor to the first.
const makeChallenge = (userId: string) => {
  const exp = Date.now() + OTP_TTL_MIN * 60_000;
  return `${userId}.${exp}.${hmac(`mfa:${userId}:${exp}`)}`;
};
const readChallenge = (c: string) => {
  const [userId, exp, sig] = c.split('.');
  if (!userId || !exp || !sig || Number(exp) < Date.now()) return null;
  const expected = hmac(`mfa:${userId}:${exp}`);
  return expected.length === sig.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig)) ? userId : null;
};

authRouter.post('/otp/request', otpIpLimiter, otpLimiter, ah(async (req, res) => {
  const { phone, purpose } = parse(z.object({ phone: zPhone, purpose: z.enum(['verify', 'reset', 'login']) }), req.body);
  const user = q.get<Row>('SELECT id, role FROM users WHERE phone = ?', phone);
  if (purpose === 'verify' && user) throw new HttpError(409, 'This mobile number is already registered. Please sign in.', 'phone_taken');
  // For reset/login we respond identically whether or not the number exists (prevents account enumeration).
  let devCode: string | undefined;
  if (purpose === 'verify' || (user && !(purpose === 'login' && isStaffRole(user.role)))) devCode = await issueOtp(phone, purpose);
  res.json({ ok: true, expiresInMinutes: OTP_TTL_MIN, resendAfterSeconds: 30, devCode, smsConfigured: smsConfigured() });
}));

const BUYER_TYPES = ['trader', 'wholesaler', 'retailer', 'processor', 'exporter', 'institutional', 'cooperative', 'other'] as const;

authRouter.post('/register', loginLimiter, ah(async (req, res) => {
  const body = parse(z.object({
    full_name: z.string().trim().min(2).max(100),
    phone: zPhone,
    password: zPassword.optional().or(z.literal('').transform(() => undefined)),
    otp: z.string().regex(/^\d{6}$/),
    language: z.enum(LANGS).default('en'),
    role: z.enum(SELF_SERVICE_ROLES as [string, ...string[]]).default('farmer'),
    buyer_type: z.enum(BUYER_TYPES).optional(),
    consent: z.literal(true, { errorMap: () => ({ message: 'Consent is required to create an account' }) }),
  }), req.body);
  // Password is optional for self-service accounts (OTP sign-in) but required for professional accounts.
  if (!body.password && body.role !== 'farmer' && body.role !== 'buyer') {
    throw new HttpError(400, 'Please choose a password', 'validation_error', undefined);
  }
  checkOtp(body.phone, 'verify', body.otp);
  const userId = id();
  q.tx(() => {
    insert('users', {
      id: userId, phone: body.phone, phone_verified: 1, password_hash: body.password ? hashPassword(body.password) : NO_PASSWORD,
      full_name: body.full_name, role: body.role, language: body.language, data_consent_at: new Date().toISOString(),
      verification_status: NEEDS_VERIFICATION.includes(body.role as any) ? 'pending' : 'not_required',
      onboarding_complete: body.role === 'farmer' ? 0 : 1,
    });
    if (body.role === 'buyer') insert('buyer_profiles', { user_id: userId, buyer_type: body.buyer_type ?? 'trader', status: 'mobile_verified' });
  });
  createSession(res, userId, req.headers['user-agent']);
  req.user = { id: userId } as any;
  audit(req, 'user.register', 'user', userId, { role: body.role });
  checkRegistrationBurst(ipHash(req), userId);
  res.status(201).json({ user: userPayload(userId) });
}));

authRouter.post('/login', loginLimiter, ah(async (req, res) => {
  const { phone, password, portal } = parse(z.object({ phone: zPhone, password: z.string().min(1).max(128), portal: z.enum(['farmer', 'buyer', 'admin', 'any']).default('any') }), req.body);
  const user = q.get<Row>('SELECT * FROM users WHERE phone = ?', phone);
  if (user) assertNotLocked(user);
  if (!user || !verifyPassword(password, user.password_hash)) {
    if (user) recordFailure(req, user);
    throw new HttpError(401, 'Mobile number or password is incorrect', 'bad_credentials');
  }
  if (user.status !== 'active') throw new HttpError(403, 'This account is suspended. Please contact support.', 'suspended');
  const staff = isStaffRole(user.role);
  if (portal === 'admin' && !staff) throw new HttpError(401, 'Mobile number or password is incorrect', 'bad_credentials');
  q.run('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', user.id);
  if (staff && config.adminMfa) {
    const devCode = await issueOtp(phone, 'mfa');
    audit(req, 'auth.mfa_challenge', 'user', user.id);
    return res.json({ mfa_required: true, challenge: makeChallenge(user.id), devCode, expiresInMinutes: OTP_TTL_MIN });
  }
  createSession(res, user.id, req.headers['user-agent']);
  req.user = user as any;
  audit(req, 'user.login', 'user', user.id);
  res.json({ user: userPayload(user.id) });
}));

/** Second factor for administrator accounts. */
authRouter.post('/login/mfa', loginLimiter, ah(async (req, res) => {
  const { challenge, otp } = parse(z.object({ challenge: z.string().max(300), otp: z.string().regex(/^\d{6}$/) }), req.body);
  const userId = readChallenge(challenge);
  if (!userId) throw new HttpError(400, 'This sign-in attempt has expired. Please start again.', 'challenge_expired');
  const user = q.get<Row>('SELECT * FROM users WHERE id = ?', userId)!;
  assertNotLocked(user);
  try {
    checkOtp(user.phone, 'mfa', otp);
  } catch (e) {
    recordFailure(req, user);
    throw e;
  }
  createSession(res, user.id, req.headers['user-agent'], { mfaVerified: true });
  req.user = user as any;
  audit(req, 'user.login', 'user', user.id, { mfa: true });
  res.json({ user: userPayload(user.id) });
}));

authRouter.post('/login/otp', loginLimiter, ah(async (req, res) => {
  const { phone, otp } = parse(z.object({ phone: zPhone, otp: z.string().regex(/^\d{6}$/) }), req.body);
  const user = q.get<Row>('SELECT * FROM users WHERE phone = ?', phone);
  if (!user || isStaffRole(user.role)) throw new HttpError(400, 'The code is incorrect.', 'otp_invalid');
  assertNotLocked(user);
  checkOtp(phone, 'login', otp);
  if (user.status !== 'active') throw new HttpError(403, 'This account is suspended. Please contact support.', 'suspended');
  createSession(res, user.id, req.headers['user-agent']);
  req.user = user as any;
  audit(req, 'user.login', 'user', user.id, { otp: true });
  res.json({ user: userPayload(user.id) });
}));

authRouter.post('/reset', loginLimiter, ah(async (req, res) => {
  const { phone, otp, new_password } = parse(z.object({ phone: zPhone, otp: z.string().regex(/^\d{6}$/), new_password: zPassword }), req.body);
  const user = q.get<Row>('SELECT id, role FROM users WHERE phone = ?', phone);
  if (!user) throw new HttpError(400, 'The code is incorrect.', 'otp_invalid');
  if (isStaffRole(user.role)) parse(zStaffPassword, new_password);
  checkOtp(phone, 'reset', otp);
  q.run(`UPDATE users SET password_hash = ?, failed_logins = 0, locked_until = NULL, updated_at = datetime('now') WHERE id = ?`, hashPassword(new_password), user.id);
  q.run('DELETE FROM sessions WHERE user_id = ?', user.id); // sign out everywhere
  audit(null, 'user.password_reset', 'user', user.id);
  res.json({ ok: true });
}));

authRouter.post('/change-password', requireAuth, ah(async (req, res) => {
  const { current_password, new_password } = parse(z.object({ current_password: z.string(), new_password: zPassword }), req.body);
  if (isStaffRole(req.user!.role)) parse(zStaffPassword, new_password);
  const user = q.get<Row>('SELECT password_hash FROM users WHERE id = ?', req.user!.id)!;
  if (!verifyPassword(current_password, user.password_hash)) throw new HttpError(400, 'Current password is incorrect', 'bad_credentials');
  q.run(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, hashPassword(new_password), req.user!.id);
  q.run('DELETE FROM sessions WHERE user_id = ?', req.user!.id);
  createSession(res, req.user!.id, req.headers['user-agent'], { mfaVerified: isStaffRole(req.user!.role) });
  audit(req, 'user.password_change', 'user', req.user!.id);
  res.json({ ok: true });
}));

/** For accounts created with OTP only: add a password later (optional account protection step). */
authRouter.post('/set-password', requireAuth, ah(async (req, res) => {
  const { new_password } = parse(z.object({ new_password: zPassword }), req.body);
  const user = q.get<Row>('SELECT password_hash FROM users WHERE id = ?', req.user!.id)!;
  if (user.password_hash !== NO_PASSWORD) throw new HttpError(400, 'You already have a password. Use change password instead.', 'has_password');
  q.run(`UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`, hashPassword(new_password), req.user!.id);
  audit(req, 'user.password_set', 'user', req.user!.id);
  res.json({ ok: true });
}));

/** Step-up verification for high-risk actions (large orders, cancelling confirmed orders). */
authRouter.post('/step-up/request', requireAuth, otpLimiter, ah(async (req, res) => {
  const devCode = await issueOtp(req.user!.phone, 'stepup');
  res.json({ ok: true, devCode, expiresInMinutes: OTP_TTL_MIN });
}));

authRouter.post('/step-up/verify', requireAuth, ah(async (req, res) => {
  const { otp } = parse(z.object({ otp: z.string().regex(/^\d{6}$/) }), req.body);
  checkOtp(req.user!.phone, 'stepup', otp);
  q.run('UPDATE sessions SET stepup_until = ? WHERE token_hash = ?', new Date(Date.now() + 10 * 60_000).toISOString(), req.sessionHash);
  audit(req, 'auth.step_up', 'user', req.user!.id);
  res.json({ ok: true, validMinutes: 10 });
}));

authRouter.post('/logout', (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});

authRouter.get('/me', (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: userPayload(req.user.id) });
});

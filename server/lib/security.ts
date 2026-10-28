import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.ts';
import { HttpError } from './http.ts';
import { q } from '../db/index.ts';

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string) {
  const [alg, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(expected, actual);
}

export const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
export const hmac = (s: string) => crypto.createHmac('sha256', config.appSecret).update(s).digest('hex');
export const ipHash = (req: Request) => hmac(`ip:${req.ip || ''}`).slice(0, 16);

// ---- Rate limiting (in-memory fixed window; swap for Redis when running several instances) ----
const buckets = new Map<string, { count: number; reset: number }>();

export function rateLimit(opts: { windowMs: number; max: number; key?: (req: Request) => string; name: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (config.isTest && !req.headers['x-test-rate-limit']) return next();
    const k = `${opts.name}:${opts.key ? opts.key(req) : req.ip}`;
    const now = Date.now();
    let b = buckets.get(k);
    if (!b || b.reset < now) {
      b = { count: 0, reset: now + opts.windowMs };
      buckets.set(k, b);
    }
    b.count++;
    if (b.count > opts.max) {
      res.setHeader('Retry-After', Math.ceil((b.reset - now) / 1000));
      return next(new HttpError(429, 'Too many requests. Please wait a little and try again.', 'rate_limited'));
    }
    next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60_000).unref();

export function audit(req: Request | null, action: string, targetType?: string, targetId?: string, detail?: unknown) {
  q.run(
    'INSERT INTO audit_logs (actor_id, action, target_type, target_id, detail, ip_hash) VALUES (?, ?, ?, ?, ?, ?)',
    req?.user?.id ?? null,
    action,
    targetType ?? null,
    targetId ?? null,
    detail === undefined ? null : JSON.stringify(detail),
    req ? ipHash(req) : null,
  );
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  next();
}

/** Reject cross-site state-changing requests (CSRF defence alongside SameSite cookies). */
export function sameOriginWrites(req: Request, _res: Response, next: NextFunction) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next(); // non-browser clients
  try {
    if (new URL(origin).host !== req.headers.host) {
      return next(new HttpError(403, 'Cross-site request blocked', 'csrf'));
    }
  } catch {
    return next(new HttpError(403, 'Invalid origin', 'csrf'));
  }
  next();
}

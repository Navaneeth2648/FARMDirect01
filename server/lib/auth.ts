import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.ts';
import { q, type Row } from '../db/index.ts';
import { HttpError, forbidden } from './http.ts';
import { sha256 } from './security.ts';
import { hasPerm, isStaffRole, type Permission } from './permissions.ts';

export const ROLES = [
  'farmer', 'buyer', 'expert', 'dealer', 'field_agent', 'fpo_manager', 'storage_provider', 'transport_provider',
  'content_editor', 'admin', 'super_admin', 'verification_officer', 'marketplace_admin', 'storage_officer',
  'dispute_officer', 'finance_officer',
] as const;
export type Role = (typeof ROLES)[number];

/** Roles a person may pick at sign-up. Professional roles start unverified. Staff roles are never self-service. */
export const SELF_SERVICE_ROLES: Role[] = ['farmer', 'buyer', 'expert', 'dealer', 'field_agent', 'fpo_manager', 'storage_provider', 'transport_provider'];
export const NEEDS_VERIFICATION: Role[] = ['expert', 'dealer', 'field_agent', 'fpo_manager'];

export interface AuthUser {
  id: string;
  role: Role;
  full_name: string;
  phone: string;
  verification_status: string;
  status: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionHash?: string;
      rawBody?: Buffer;
    }
  }
}

const COOKIE = 'fd_session';

function parseCookies(header?: string) {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function createSession(res: Response, userId: string, userAgent?: string, opts: { mfaVerified?: boolean } = {}) {
  const token = crypto.randomBytes(32).toString('base64url');
  // Privileged (staff) sessions are shorter-lived.
  const staff = isStaffRole(q.get<Row>('SELECT role FROM users WHERE id = ?', userId)?.role);
  const expires = new Date(Date.now() + (staff ? 12 * 3600_000 : config.sessionDays * 86400_000));
  q.run(
    'INSERT INTO sessions (token_hash, user_id, expires_at, user_agent, mfa_verified) VALUES (?, ?, ?, ?, ?)',
    sha256(token), userId, expires.toISOString(), (userAgent || '').slice(0, 200), opts.mfaVerified ? 1 : 0,
  );
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    expires,
    path: '/',
  });
  return token;
}

export function destroySession(req: Request, res: Response) {
  const token = parseCookies(req.headers.cookie)[COOKIE];
  if (token) q.run('DELETE FROM sessions WHERE token_hash = ?', sha256(token));
  res.clearCookie(COOKIE, { path: '/' });
}

/** Attaches req.user when a valid session cookie (or Bearer token) is present. */
export function loadUser(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  const token = bearer || parseCookies(req.headers.cookie)[COOKIE];
  if (!token) return next();
  const row = q.get<Row>(
    `SELECT u.id, u.role, u.full_name, u.phone, u.verification_status, u.status, s.expires_at, s.mfa_verified, s.stepup_until, s.token_hash
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
    sha256(token),
  );
  // Staff sessions are only valid after multi-factor verification (unless MFA is explicitly disabled for local use).
  const mfaOk = !row || !isStaffRole(row.role) || row.mfa_verified === 1 || !config.adminMfa;
  if (row && new Date(row.expires_at) > new Date() && row.status === 'active' && mfaOk) {
    req.user = row as AuthUser;
    req.sessionHash = row.token_hash;
  }
  next();
}

/** Step-up verification: recent OTP confirmation required for high-risk actions. */
export function hasRecentStepUp(req: Request) {
  if (!req.sessionHash) return false;
  const s = q.get<Row>('SELECT stepup_until FROM sessions WHERE token_hash = ?', req.sessionHash);
  return !!s?.stepup_until && new Date(s.stepup_until) > new Date();
}

export function requirePerm(...perms: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const u = req.user;
    if (!u) return next(new HttpError(401, 'Please sign in to continue', 'unauthenticated'));
    if (!perms.some((p) => hasPerm(u.role, p))) return next(forbidden());
    next();
  };
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, 'Please sign in to continue', 'unauthenticated'));
  next();
}

/**
 * Role gate enforced on the server. Professional roles must also be verified
 * by an administrator before they get access to privileged endpoints.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const u = req.user;
    if (!u) return next(new HttpError(401, 'Please sign in to continue', 'unauthenticated'));
    const effective = new Set<Role>([u.role]);
    if (u.role === 'super_admin') effective.add('admin');
    if (!roles.some((r) => effective.has(r))) return next(forbidden());
    if (NEEDS_VERIFICATION.includes(u.role) && u.verification_status !== 'verified' && !roles.includes('farmer')) {
      return next(forbidden('Your professional account is awaiting verification by an administrator'));
    }
    next();
  };
}

export const isStaff = (u?: AuthUser) => !!u && ['admin', 'super_admin'].includes(u.role);
export const isVerifiedExpert = (u?: AuthUser) =>
  !!u && (isStaff(u) || (['expert', 'field_agent'].includes(u.role) && u.verification_status === 'verified'));

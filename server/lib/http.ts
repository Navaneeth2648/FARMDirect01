import type { NextFunction, Request, Response, RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { z, ZodError, type ZodTypeAny } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string, public code = 'error', public details?: unknown) {
    super(message);
  }
}

export const notFound = (what = 'Resource') => new HttpError(404, `${what} not found`, 'not_found');
export const forbidden = (msg = 'You do not have permission to do this') => new HttpError(403, msg, 'forbidden');

export const id = () => randomUUID();

export function ah(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function parse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  return schema.parse(data);
}

export function page(req: Request, max = 100) {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), max);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return { limit, offset };
}

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Please check the highlighted fields',
      code: 'validation_error',
      fields: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, code: err.code, details: err.details });
  }
  if (err?.type === 'entity.too.large' || err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File or request is too large', code: 'too_large' });
  }
  if (typeof err?.message === 'string' && err.message.includes('UNIQUE constraint failed')) {
    return res.status(409).json({ error: 'This record already exists', code: 'duplicate' });
  }
  console.error(JSON.stringify({ level: 'error', msg: err?.message, stack: err?.stack }));
  res.status(500).json({ error: 'Something went wrong on our side. Please try again.', code: 'internal' });
}

// Shared field validators
export const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
export const zPhone = z
  .string()
  .transform((s) => s.replace(/[\s-]/g, ''))
  .pipe(z.string().regex(/^(\+91)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'))
  .transform((s) => (s.startsWith('+91') ? s : `+91${s}`));
export const zText = (max = 2000) => z.string().trim().min(1).max(max);
export const zOptText = (max = 2000) => z.string().trim().max(max).optional().nullable();
export const zLat = z.number().min(-90).max(90);
export const zLon = z.number().min(-180).max(180);

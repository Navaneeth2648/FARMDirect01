import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import type { Request } from 'express';
import { config } from '../config.ts';
import { q, insert, type Row } from '../db/index.ts';
import { HttpError, id } from './http.ts';
import { hmac } from './security.ts';
import { hasPerm } from './permissions.ts';

/**
 * Private document storage. Files live outside the web root under random names;
 * metadata is in the documents table. Downloads use short-lived links signed for
 * one user, are re-authorised on every access, and are written to an access log.
 */
export const docUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

export function sniffDoc(buf: Buffer): string | null {
  if (buf.length < 8) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp';
  if (buf.subarray(0, 5).toString('ascii') === '%PDF-') return 'application/pdf';
  return null;
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

export function storeDocument(req: Request, subjectType: string, subjectId: string, docType: string, opts: { imagesOnly?: boolean } = {}) {
  if (!req.file) throw new HttpError(400, 'Please attach a file', 'no_file');
  const mime = sniffDoc(req.file.buffer);
  if (!mime || (opts.imagesOnly && mime === 'application/pdf')) {
    throw new HttpError(400, opts.imagesOnly ? 'Only JPEG, PNG or WebP photos are accepted' : 'Only PDF, JPEG, PNG or WebP files are accepted', 'bad_file');
  }
  const dir = path.join(config.uploadDir, 'docs', subjectType);
  fs.mkdirSync(dir, { recursive: true });
  const rel = path.join('docs', subjectType, `${crypto.randomBytes(16).toString('hex')}.${EXT[mime]}`);
  fs.writeFileSync(path.join(config.uploadDir, rel), req.file.buffer);
  const did = id();
  insert('documents', {
    id: did, owner_id: req.user!.id, subject_type: subjectType, subject_id: subjectId, doc_type: docType, file_path: rel, mime,
    size: req.file.size, sha256: crypto.createHash('sha256').update(req.file.buffer).digest('hex'),
    original_name: (req.file.originalname || '').replace(/[^\w.\- ]/g, '').slice(0, 120),
  });
  return q.get<Row>('SELECT id, subject_type, subject_id, doc_type, mime, size, original_name, created_at FROM documents WHERE id = ?', did)!;
}

/** Who may open a document: the uploader, parties/staff according to the subject. */
export function canAccessDocument(user: { id: string; role: string }, doc: Row): boolean {
  if (doc.deleted_at) return false;
  if (doc.owner_id === user.id) return true;
  switch (doc.subject_type) {
    case 'lot': return true; // produce photos are part of a public listing (signed-in users only)
    case 'buyer': return hasPerm(user.role, 'verify.buyers');
    case 'user': return hasPerm(user.role, 'verify.farmers');
    case 'facility': return hasPerm(user.role, 'verify.storage') || (doc.doc_type === 'photo');
    case 'transport': return hasPerm(user.role, 'verify.transport');
    case 'dispute': {
      if (hasPerm(user.role, 'disputes.manage')) return true;
      const d = q.get<Row>('SELECT raised_by, against_id FROM disputes WHERE id = ?', doc.subject_id);
      return !!d && (d.raised_by === user.id || d.against_id === user.id);
    }
    case 'grading': {
      // Inspection evidence: lot owner, inspectors, verified buyers and staff (same rule as the grade details).
      const r = q.get<Row>('SELECT l.farmer_id FROM grading_results g JOIN produce_lots l ON l.id = g.lot_id WHERE g.id = ?', doc.subject_id);
      if (!r) return false;
      if (r.farmer_id === user.id || hasPerm(user.role, 'grading.inspect') || hasPerm(user.role, 'orders.view')) return true;
      const u = q.get<Row>('SELECT role, verification_status FROM users WHERE id = ?', user.id);
      if (u && ['field_agent', 'expert'].includes(u.role) && u.verification_status === 'verified') return true;
      return user.role === 'buyer' && !!q.get(`SELECT 1 FROM buyer_profiles WHERE user_id = ? AND status = 'verified'`, user.id);
    }
    case 'receipt': case 'milestone': {
      const b = q.get<Row>(`SELECT sb.farmer_id, f.provider_id FROM storage_receipts r JOIN storage_bookings sb ON sb.id = r.booking_id
        JOIN storage_facilities f ON f.id = sb.facility_id WHERE r.id = ?`, doc.subject_id);
      if (b && (b.farmer_id === user.id || b.provider_id === user.id)) return true;
      return hasPerm(user.role, 'bookings.view') || hasPerm(user.role, 'disputes.manage');
    }
    default: return false;
  }
}

export function signedLink(docId: string, userId: string, ttlSeconds = 300) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  return { url: `/api/v1/documents/${docId}/file?exp=${exp}&sig=${hmac(`doc:${docId}:${userId}:${exp}`)}`, expires_in: ttlSeconds };
}

export function verifySignedLink(docId: string, userId: string, exp: string, sig: string) {
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const expected = hmac(`doc:${docId}:${userId}:${exp}`);
  return expected.length === sig.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

export const logDocAccess = (docId: string, userId: string, action: string) =>
  q.run('INSERT INTO document_access_log (document_id, user_id, action) VALUES (?, ?, ?)', docId, userId, action);

export function deleteDocumentFile(doc: Row) {
  if (doc.file_path) fs.rm(path.join(config.uploadDir, doc.file_path), { force: true }, () => {});
  q.run(`UPDATE documents SET deleted_at = datetime('now'), file_path = NULL WHERE id = ?`, doc.id);
}

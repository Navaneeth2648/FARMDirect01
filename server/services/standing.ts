import { q, type Row } from '../db/index.ts';
import { getSetting } from './settings.ts';
import { activeRestriction } from './fraud.ts';

/**
 * Graduated trust levels.
 * Farmers: 1 mobile verified → 2 profile complete → 3 identity verified (reviewed).
 * "Transaction eligible" is level ≥ 2 with no active restriction. Land ownership and Aadhaar are not required.
 */
export function farmerStanding(userId: string) {
  const u = q.get<Row>('SELECT full_name, state, district, village, farmer_level, phone_verified FROM users WHERE id = ?', userId);
  if (!u) return null;
  const missing: string[] = [];
  if (!u.state) missing.push('state');
  if (!u.district) missing.push('district');
  if (!u.village) missing.push('village');
  const profileComplete = missing.length === 0;
  const identityVerified = u.farmer_level >= 3;
  const level = identityVerified ? 3 : profileComplete ? 2 : 1;
  const restriction = activeRestriction(userId, 'no_listings') || activeRestriction(userId, 'no_offers');
  const pendingIdentity = q.get<Row>(`SELECT id, status FROM verification_applications WHERE user_id = ? AND kind = 'farmer_identity' ORDER BY submitted_at DESC LIMIT 1`, userId);
  return {
    level,
    levels: [
      { level: 1, name: 'Mobile verified', done: !!u.phone_verified },
      { level: 2, name: 'Profile complete', done: profileComplete },
      { level: 3, name: 'Identity verified', done: identityVerified },
    ],
    missing_profile_fields: missing,
    identity_application: pendingIdentity ?? null,
    transaction_eligible: level >= 2 && !restriction,
    max_order_value_inr: identityVerified ? null : getSetting('profile_level_max_order_inr'),
    restriction: restriction ? { id: restriction.id, kind: restriction.kind, reason: restriction.reason } : null,
    next_step: level === 1 ? 'Add your state, district and village in Settings to start selling.'
      : !identityVerified ? 'Optional: verify your identity to remove the per-order limit.' : null,
  };
}

/** Which business documents a buyer must provide depends on buyer type, registration type and purchase size. */
export function requiredBuyerDocuments(p: Row) {
  const req: { field: string; doc_type?: string; label: string; why: string }[] = [];
  const individual = !p.registration_type || p.registration_type === 'individual';
  const largeVolume = (p.max_qty ?? 0) * (p.qty_unit === 'tonne' ? 10 : p.qty_unit === 'kg' ? 0.01 : 1) >= 100; // ≥ 100 quintal per purchase
  if (!individual || largeVolume) {
    req.push({ field: 'pan', label: 'PAN of the business', why: 'Confirms the business identity for commercial purchases.' });
  }
  if (['company', 'llp', 'partnership', 'cooperative', 'fpo'].includes(p.registration_type) || largeVolume) {
    req.push({ field: 'gstin', label: 'GSTIN', why: 'Registered businesses buying at this scale are usually GST-registered.' });
  }
  if (['processor', 'exporter', 'retailer', 'institutional'].includes(p.buyer_type)) {
    req.push({ field: 'fssai', label: 'FSSAI licence/registration', why: 'Required for food businesses handling or processing food.' });
  }
  if (!individual) {
    req.push({ field: 'doc:registration_certificate', doc_type: 'registration_certificate', label: 'Business registration certificate', why: 'Shows the business is legally registered.' });
  }
  req.push({ field: 'doc:representative_authorisation', doc_type: 'representative_authorisation', label: 'Representative ID or authorisation letter', why: 'Confirms you are authorised to buy on behalf of this business.' });
  return req;
}

export const BUYER_STATUS_TEXT: Record<string, string> = {
  draft: 'Registration started',
  mobile_verified: 'Mobile verified – add your business details',
  documents_pending: 'Business details saved – upload the required documents',
  under_review: 'Under review by our verification team',
  verified: 'Verified buyer',
  info_required: 'More information required',
  rejected: 'Application rejected',
  suspended: 'Account suspended',
  deactivated: 'Account deactivated',
};

export function buyerStanding(userId: string) {
  const p = q.get<Row>('SELECT * FROM buyer_profiles WHERE user_id = ?', userId);
  if (!p) return null;
  const required = requiredBuyerDocuments(p);
  const docs = q.all<Row>(`SELECT doc_type FROM documents WHERE subject_type = 'buyer' AND subject_id = ? AND deleted_at IS NULL`, userId).map((d) => d.doc_type);
  const missing = required.filter((r) => (r.doc_type ? !docs.includes(r.doc_type) : !p[r.field]));
  const profileFields = ['business_name', 'address', 'state', 'district'].filter((f) => !p[f]);
  const steps: string[] = [];
  if (profileFields.length) steps.push(`Add business details: ${profileFields.join(', ')}`);
  if (missing.length) steps.push(`Provide: ${missing.map((m) => m.label).join('; ')}`);
  if (!p.terms_accepted_at) steps.push('Accept the marketplace transaction and dispute rules');
  if (!steps.length && ['mobile_verified', 'documents_pending', 'info_required'].includes(p.status)) steps.push('Submit your application for review');
  if (p.status === 'under_review') steps.push('Wait for review (usually 1–2 working days). You can browse meanwhile.');
  if (p.status === 'rejected' || p.status === 'info_required') steps.unshift(`Reviewer note: ${p.status_reason || '—'}`);
  return {
    status: p.status,
    status_text: BUYER_STATUS_TEXT[p.status] ?? p.status,
    can_transact: p.status === 'verified',
    required_documents: required.map((r) => ({ ...r, provided: !missing.includes(r) })),
    missing_profile_fields: profileFields,
    ready_to_submit: !profileFields.length && !missing.length && !!p.terms_accepted_at,
    next_steps: steps,
  };
}

export const mask = (v?: string | null, keep = 4) => (v ? `${'•'.repeat(Math.max(0, v.length - keep))}${v.slice(-keep)}` : null);

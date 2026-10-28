import zlib from 'node:zlib';
import crypto from 'node:crypto';
import fs from 'node:fs';

/**
 * Reads the QR code printed on an Aadhaar card / e-Aadhaar so a farmer's name and
 * address can be filled in for them. This is UIDAI's offline method: the data
 * comes from the card the person holds; no UIDAI service is called and nothing is
 * looked up by Aadhaar number.
 *
 * - Secure QR (2018+): a large decimal number → bytes → gzip → fields separated by
 *   byte 255, followed by a photo and a 256-byte RSA-SHA256 signature by UIDAI.
 * - Old QR (pre-2018): plain XML <PrintLetterBarcodeData .../> with no signature.
 *
 * The Aadhaar number is never returned or stored. Only the last 4 digits (which the
 * Secure QR itself carries) are returned for the person to recognise their card.
 */

export type AadhaarDetails = {
  format: 'secure_qr' | 'old_qr';
  signature: 'verified' | 'invalid' | 'not_checked';
  last4: string | null;
  name: string;
  gender: string | null;
  dob: string | null;
  care_of: string | null;
  address_line: string | null;
  village: string | null;
  subdistrict: string | null;
  district: string | null;
  state: string | null;
  pincode: string | null;
};

export class AadhaarQrError extends Error {}

const clean = (s?: string | null) => {
  const v = (s ?? '').replace(/\s+/g, ' ').trim();
  return v && v !== '-' ? v : null;
};

// Secure QR text fields after the optional "V2"/"V3" version field.
const SECURE_FIELDS = ['indicator', 'reference', 'name', 'dob', 'gender', 'care_of', 'district', 'landmark', 'house', 'location', 'pincode', 'post_office', 'state', 'street', 'subdistrict', 'vtc'] as const;

function unzip(bytes: Buffer) {
  for (const fn of [zlib.gunzipSync, zlib.inflateSync, zlib.inflateRawSync]) {
    try { return fn(bytes); } catch { /* try the next format */ }
  }
  throw new AadhaarQrError('This QR code could not be read as an Aadhaar Secure QR.');
}

let certCache: string | null | undefined;
/** UIDAI's offline-verification public certificate (PEM), from UIDAI_QR_CERT (PEM text or a file path). */
function uidaiCert() {
  if (certCache !== undefined) return certCache;
  const v = process.env.UIDAI_QR_CERT?.trim();
  certCache = !v ? null : v.includes('-----BEGIN') ? v.replace(/\\n/g, '\n') : fs.existsSync(v) ? fs.readFileSync(v, 'utf8') : null;
  return certCache;
}

function decodeSecure(digits: string): AadhaarDetails {
  let hex = BigInt(digits).toString(16);
  if (hex.length % 2) hex = `0${hex}`;
  const data = unzip(Buffer.from(hex, 'hex'));

  // Split only the leading text fields; the photo that follows can contain byte 255.
  const parts: string[] = [];
  let start = 0;
  for (let i = 0; i < data.length && parts.length < SECURE_FIELDS.length + 1; i++) {
    if (data[i] === 255) { parts.push(data.subarray(start, i).toString('latin1')); start = i + 1; }
  }
  const versioned = /^V\d$/.test(parts[0] ?? '');
  const f = Object.fromEntries(SECURE_FIELDS.map((k, i) => [k, Buffer.from(parts[i + (versioned ? 1 : 0)] ?? '', 'latin1').toString('utf8')])) as Record<(typeof SECURE_FIELDS)[number], string>;

  // Sanity checks so a wrong layout never fills a form with garbage.
  if (!clean(f.name) || !/^\d{4}/.test(f.reference) || (f.pincode && !/^\d{6}$/.test(f.pincode.trim()))) {
    throw new AadhaarQrError('This QR code could not be read as an Aadhaar Secure QR.');
  }

  let signature: AadhaarDetails['signature'] = 'not_checked';
  const cert = uidaiCert();
  if (cert && data.length > 256) {
    try {
      signature = crypto.verify('sha256', data.subarray(0, data.length - 256), cert, data.subarray(data.length - 256)) ? 'verified' : 'invalid';
    } catch { signature = 'invalid'; }
  }

  return {
    format: 'secure_qr', signature, last4: f.reference.slice(0, 4),
    name: clean(f.name)!, gender: clean(f.gender), dob: clean(f.dob), care_of: clean(f.care_of),
    address_line: [f.house, f.street, f.landmark, f.post_office].map(clean).filter(Boolean).join(', ') || null,
    village: clean(f.vtc) ?? clean(f.location), subdistrict: clean(f.subdistrict), district: clean(f.district),
    state: clean(f.state), pincode: clean(f.pincode),
  };
}

function decodeOldXml(xml: string): AadhaarDetails {
  const attr = (k: string) => clean(xml.match(new RegExp(`\\s${k}="([^"]*)"`, 'i'))?.[1]);
  const name = attr('name');
  if (!name) throw new AadhaarQrError('This QR code could not be read as an Aadhaar QR.');
  const uid = attr('uid');
  return {
    format: 'old_qr', signature: 'not_checked', last4: uid && /^\d{12}$/.test(uid) ? uid.slice(-4) : null,
    name, gender: attr('gender'), dob: attr('dob') ?? attr('yob'), care_of: attr('co'),
    address_line: [attr('house'), attr('street'), attr('lm'), attr('po')].filter(Boolean).join(', ') || null,
    village: attr('vtc') ?? attr('loc'), subdistrict: attr('subdist'), district: attr('dist'), state: attr('state'), pincode: attr('pc'),
  };
}

export function decodeAadhaarQr(raw: string): AadhaarDetails {
  const text = raw.trim();
  if (/^\d{200,}$/.test(text)) return decodeSecure(text);
  if (/<PrintLetterBarcodeData/i.test(text)) return decodeOldXml(text);
  throw new AadhaarQrError('This is not an Aadhaar QR code. Scan the large QR code on the Aadhaar card or e-Aadhaar.');
}

/** Builds a Secure-QR-format payload. Used only by tests (real QR codes are signed by UIDAI). */
export function buildTestSecureQr(fields: Partial<Record<(typeof SECURE_FIELDS)[number], string>>, sign?: (b: Buffer) => Buffer) {
  const text = ['V2', ...SECURE_FIELDS.map((k) => fields[k] ?? '')].map((s) => Buffer.from(s, 'utf8'));
  const body = Buffer.concat([...text.flatMap((b) => [b, Buffer.from([255])]), Buffer.from('photo-bytes')]);
  const payload = Buffer.concat([body, sign ? sign(body) : crypto.randomBytes(256)]);
  return BigInt(`0x${zlib.gzipSync(payload).toString('hex')}`).toString(10);
}

export const resetUidaiCertCache = () => { certCache = undefined; };

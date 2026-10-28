import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CheckCircle2, ImageUp, ShieldCheck, X } from 'lucide-react';
import { api } from './api';
import { Button, INDIAN_STATES, Spinner } from './ui';

export type AadhaarDetails = {
  format: 'secure_qr' | 'old_qr'; signature: 'verified' | 'not_checked'; last4: string | null; name: string;
  gender: string | null; dob: string | null; care_of: string | null; address_line: string | null;
  village: string | null; subdistrict: string | null; district: string | null; state: string | null; pincode: string | null;
};

const Native: any = typeof window !== 'undefined' ? (window as any).BarcodeDetector : undefined;

/** Reads a QR from an image or video frame: the browser's detector first, then jsQR. */
async function readQr(source: CanvasImageSource, w: number, h: number): Promise<string | null> {
  if (Native) {
    try { const found = await new Native({ formats: ['qr_code'] }).detect(source); if (found[0]?.rawValue) return found[0].rawValue; } catch { /* fall back */ }
  }
  // Aadhaar Secure QR is dense: try the full size, then a reduced copy.
  for (const scale of [1, 0.6, 1.5]) {
    const cw = Math.round(w * scale), ch = Math.round(h * scale);
    if (cw < 200 || cw > 3000) continue;
    const c = document.createElement('canvas');
    c.width = cw; c.height = ch;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, 0, 0, cw, ch);
    const img = ctx.getImageData(0, 0, cw, ch);
    const r = jsQR(img.data, cw, ch, { inversionAttempts: 'attemptBoth' });
    if (r?.data) return r.data;
  }
  return null;
}

/**
 * "Fill my details from Aadhaar": scans the QR on the Aadhaar card or e-Aadhaar.
 * Optional by design – people can always type their details instead.
 */
export function AadhaarQrFill({ onFilled, compact }: { onFilled: (d: AadhaarDetails) => void; compact?: boolean }) {
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<AadhaarDetails | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setScanning(false); };
  useEffect(() => stop, []);

  const submit = async (qr: string) => {
    setBusy(true); setErr(null);
    try {
      const r = await api.post('/auth/aadhaar-qr', { qr });
      setDone(r.details); onFilled(r.details);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };

  const startCamera = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } } });
      streamRef.current = stream;
      setScanning(true);
      await new Promise((r) => setTimeout(r, 50));
      const v = videoRef.current;
      if (!v) return;
      v.srcObject = stream;
      await v.play();
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return;
        const text = v.videoWidth ? await readQr(v, v.videoWidth, v.videoHeight) : null;
        if (text) { stop(); submit(text); return; }
        setTimeout(tick, 250);
      };
      tick();
    } catch { stop(); setErr('Camera permission was denied. Upload a photo of the QR code instead.'); }
  };

  const fromFile = async (file?: File) => {
    if (!file) return;
    setErr(null); setBusy(true);
    try {
      const bmp = await createImageBitmap(file);
      const text = await readQr(bmp, bmp.width, bmp.height);
      if (!text) { setErr('No QR code found. Take a close, sharp photo of only the large QR code, in good light.'); return; }
      await submit(text);
    } catch { setErr('This photo could not be read. Try another photo.'); } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  if (done) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <div className="flex-1">
          <p className="font-semibold">Details filled from Aadhaar{done.last4 ? ` (XXXX XXXX ${done.last4})` : ''}</p>
          <p className="text-xs">{done.signature === 'verified' ? 'UIDAI signature checked – this is a genuine Aadhaar QR.' : 'Please check the details below and correct anything that is wrong.'} Your Aadhaar number is not saved.</p>
        </div>
        <button type="button" className="text-xs font-semibold underline" onClick={() => setDone(null)}>Scan again</button>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-gray-200 bg-white ${compact ? 'p-3' : 'p-4'}`}>
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700" aria-hidden><ShieldCheck className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">Fill details from Aadhaar (optional)</p>
          <p className="text-xs text-gray-600">Scan the large QR code on your Aadhaar card or e-Aadhaar. Your name and address are filled in for you. Your Aadhaar number is not saved.</p>
        </div>
      </div>
      {scanning ? (
        <div className="mt-3">
          <div className="relative overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="mx-auto max-h-72 w-full object-contain" muted playsInline />
            <div className="pointer-events-none absolute inset-8 rounded-lg border-2 border-white/80" aria-hidden />
          </div>
          <p className="mt-2 text-center text-xs text-gray-600">Hold the QR code inside the box, close and steady.</p>
          <Button type="button" variant="outline" size="sm" className="mt-2 w-full" onClick={stop}><X className="mr-1 h-4 w-4" />Stop camera</Button>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button type="button" onClick={startCamera} disabled={busy}><Camera className="mr-1 h-4 w-4" />Scan QR</Button>
          <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>{busy ? <Spinner /> : <ImageUp className="mr-1 h-4 w-4" />}Photo</Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => fromFile(e.target.files?.[0])} />
        </div>
      )}
      {busy && !scanning && <p className="mt-2 text-xs text-gray-600"><Spinner /> Reading your Aadhaar QR…</p>}
      {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
    </div>
  );
}

/** Matches Aadhaar's state text (any case, "&"/"and") to the app's state list. */
export function matchState(s?: string | null) {
  if (!s) return '';
  const norm = (x: string) => x.toLowerCase().replace(/&/g, 'and').replace(/[^a-z]/g, '');
  return INDIAN_STATES.find((o) => norm(o.value) === norm(s))?.value ?? '';
}

/** Address fields in the shape the onboarding form uses. */
export const aadhaarLocation = (d: AadhaarDetails) => ({
  state: matchState(d.state), district: d.district || '', subdistrict: d.subdistrict || '', village: d.village || '', pincode: d.pincode && /^\d{6}$/.test(d.pincode) ? d.pincode : '',
});

/** Saves the address for the next onboarding step (on this device only). */
export function rememberAadhaarAddress(d: AadhaarDetails) {
  try {
    const key = 'fd_onboarding';
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    const a = aadhaarLocation(d);
    saved.loc = Object.fromEntries(Object.entries({ ...(saved.loc || {}), ...a }).map(([k, v]) => [k, v || saved.loc?.[k] || '']));
    localStorage.setItem(key, JSON.stringify(saved));
  } catch { /* ignore */ }
}

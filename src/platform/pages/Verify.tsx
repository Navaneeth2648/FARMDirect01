import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, QrCode, ShieldAlert, Upload, XCircle } from 'lucide-react';
import { api, fmtDate, fmtDateTime } from '../api';
import { Button, ErrorBox, Field, Input, Modal, Notice, PageHeader, Section, Spinner, Textarea, useToast } from '../ui';

const Detector: any = typeof window !== 'undefined' ? (window as any).BarcodeDetector : undefined;

export function VerifyPage() {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState(false);
  const [rep, setRep] = useState({ product_name: '', where_bought: '', description: '' });
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setScanning(false); };
  useEffect(() => stop, []);

  const verify = async (c = code) => {
    if (!c.trim()) return;
    setBusy(true); setErr(null); setResult(null);
    try { setResult(await api.post('/v1/verify', { code: c })); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  const scan = async () => {
    if (!Detector) { setErr('QR scanning is not supported in this browser. Type the code printed under the QR instead.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setScanning(true);
      await new Promise((r) => setTimeout(r, 50));
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const det = new Detector({ formats: ['qr_code'] });
      const loop = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const found = await det.detect(videoRef.current);
          if (found[0]?.rawValue) { stop(); setCode(found[0].rawValue); verify(found[0].rawValue); return; }
        } catch { /* keep trying */ }
        requestAnimationFrame(loop);
      };
      loop();
    } catch { setErr('Camera permission was denied. You can upload a photo of the QR or type the code.'); stop(); }
  };

  const fromImage = async (file?: File) => {
    if (!file) return;
    if (!Detector) { setErr('Reading QR from images is not supported in this browser. Type the code instead.'); return; }
    try {
      const bmp = await createImageBitmap(file);
      const found = await new Detector({ formats: ['qr_code'] }).detect(bmp);
      if (!found.length) { setErr('No QR code found in the photo. Try a closer, sharper photo.'); return; }
      setCode(found[0].rawValue); verify(found[0].rawValue);
    } catch { setErr('Could not read that image.'); }
  };

  const view = result && ({
    valid: { icon: CheckCircle2, cls: 'border-emerald-300 bg-emerald-50 text-emerald-900', title: result.expired ? 'Genuine – but expired' : 'Genuine product' },
    already_used: { icon: ShieldAlert, cls: 'border-amber-300 bg-amber-50 text-amber-900', title: 'Code already verified before' },
    manual_review: { icon: ShieldAlert, cls: 'border-amber-300 bg-amber-50 text-amber-900', title: 'Needs manual review' },
    invalid: { icon: XCircle, cls: 'border-red-300 bg-red-50 text-red-900', title: 'Not verified' },
  } as any)[result.result];

  return (
    <div className="space-y-4">
      <PageHeader title="Verify Product Authenticity" icon={<QrCode />} subtitle="Scan the FARMDirect verification QR on the pack, or type the code printed beneath it" />
      <Notice>Only codes issued through manufacturer-authorised batches can be verified. A product without a FARMDirect code is not necessarily fake — check the manufacturer's own verification method too.</Notice>
      <Section>
        {scanning && (
          <div className="mb-3">
            <video ref={videoRef} className="mx-auto max-h-72 rounded-xl bg-black" muted playsInline />
            <div className="mt-2 text-center"><Button variant="outline" onClick={stop}>Stop camera</Button></div>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={scan} disabled={scanning}><Camera className="mr-1 h-4 w-4" />Scan QR</Button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => fromImage(e.target.files?.[0])} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" />QR photo</Button>
        </div>
        <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); verify(); }}>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="FD-XXXXXXXXXXXXXXXX-XXXX" aria-label="Verification code" className="font-mono" />
          <Button type="submit" disabled={busy || !code.trim()}>{busy ? <Spinner /> : 'Verify'}</Button>
        </form>
        {err && <div className="mt-3"><ErrorBox error={err} /></div>}
      </Section>

      {view && (
        <div className={`rounded-2xl border-2 p-5 ${view.cls}`} role="status">
          <div className="flex items-center gap-2"><view.icon className="h-7 w-7" aria-hidden /><h2 className="text-xl font-bold">{view.title}</h2></div>
          <p className="mt-2 text-sm">{result.message}</p>
          {result.product && (
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-xs uppercase opacity-70">Product</dt><dd className="font-semibold">{result.product.name}</dd></div>
              <div><dt className="text-xs uppercase opacity-70">Manufacturer</dt><dd>{result.product.manufacturer}</dd></div>
              <div><dt className="text-xs uppercase opacity-70">Batch</dt><dd>{result.product.batch_no}</dd></div>
              {result.product.registration_no && <div><dt className="text-xs uppercase opacity-70">Registration</dt><dd>{result.product.registration_no}</dd></div>}
              {result.product.mfg_date && <div><dt className="text-xs uppercase opacity-70">Manufactured</dt><dd>{fmtDate(result.product.mfg_date)}</dd></div>}
              {result.product.expiry_date && <div><dt className="text-xs uppercase opacity-70">Expiry</dt><dd>{fmtDate(result.product.expiry_date)}</dd></div>}
              {result.firstVerifiedAt && <div><dt className="text-xs uppercase opacity-70">First verified</dt><dd>{fmtDateTime(result.firstVerifiedAt)} ({result.count} scans)</dd></div>}
            </dl>
          )}
          {result.result !== 'valid' && <Button className="mt-4" variant="outline" onClick={() => setReport(true)}>Report suspicious product</Button>}
        </div>
      )}

      <Modal open={report} onClose={() => setReport(false)} title="Report a suspicious product">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          try { await api.post('/v1/verify/report', { ...rep, code_text: code || null }); toast('Report sent. Keep the pack and bill safely.'); setReport(false); }
          catch (err: any) { toast(err.message, 'error'); }
        }}>
          <Field label="Product name on pack">{(id) => <Input id={id} value={rep.product_name} onChange={(e) => setRep({ ...rep, product_name: e.target.value })} />}</Field>
          <Field label="Where you bought it">{(id) => <Input id={id} value={rep.where_bought} onChange={(e) => setRep({ ...rep, where_bought: e.target.value })} />}</Field>
          <Field label="What is suspicious?" required>{(id) => <Textarea id={id} value={rep.description} onChange={(e) => setRep({ ...rep, description: e.target.value })} required />}</Field>
          <p className="text-xs text-gray-500">You can also complain to your district agriculture officer.</p>
          <div className="flex justify-end"><Button type="submit">Send report</Button></div>
        </form>
      </Modal>
    </div>
  );
}

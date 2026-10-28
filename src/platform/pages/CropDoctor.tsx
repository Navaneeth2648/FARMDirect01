import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Camera, Download, ImageOff, Stethoscope, Trash2, Upload, UserRound } from 'lucide-react';
import { api, fmtDateTime } from '../api';
import {
  Badge, Button, Empty, ErrorBox, Field, Modal, Notice, PageHeader, Section, Select, SetupNotice, Skeleton, SpeakButton, Spinner, Textarea,
  severityTone, useAsync, useConfirm, useToast, Input,
} from '../ui';
import { CropSelect, FarmSelect, STATUS_TONE, useCropName, useFarms } from '../shared';

/** Downscale large photos on the device before upload (saves data on slow connections). */
async function compress(file: File, maxDim = 1600): Promise<Blob> {
  if (!file.type.startsWith('image/')) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1_500_000) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b || file), 'image/jpeg', 0.85));
  } catch { return file; }
}

export function CropDoctorPage() {
  const nav = useNavigate();
  const toast = useToast();
  const farms = useFarms();
  const status = useAsync(() => api.get('/v1/diagnosis/status'));
  const history = useAsync(() => api.get('/v1/diagnosis').then((r) => r.diagnoses));
  const cycles = useAsync(() => api.get('/v1/cycles?status=active').then((r) => r.cycles));
  const cropName = useCropName();
  const [f, setF] = useState({ farm_id: '', crop_cycle_id: '', crop_id: '', plant_part: '', growth_stage: '', symptoms: '' });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = (fl?: File | null) => {
    if (!fl) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(fl.type)) { setErr('Please choose a JPEG, PNG or WebP photo.'); return; }
    setErr(null); setFile(fl);
    setPreview((p) => { if (p) URL.revokeObjectURL(p); return URL.createObjectURL(fl); });
  };
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) { setErr('Please add a photo first.'); return; }
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append('image', await compress(file), 'crop.jpg');
      for (const [k, v] of Object.entries(f)) if (v) fd.append(k, v);
      const r = await api.post('/v1/diagnosis', fd);
      nav(`/crop-doctor/${r.diagnosis.id}`);
    } catch (e) { setErr(e); toast('Upload failed', 'error'); } finally { setBusy(false); }
  };

  const farmCycles = (cycles.data || []).filter((c: any) => !f.farm_id || c.farm_id === f.farm_id);

  return (
    <div className="space-y-4">
      <PageHeader title="Crop Doctor" icon={<Stethoscope />} subtitle="Take a clear photo of the affected plant for a preliminary AI assessment" />
      {status.data && !status.data.configured && <SetupNotice service="AI image analysis" setup={status.data.setup} />}

      <div className="grid gap-4 lg:grid-cols-5">
        <Section className="lg:col-span-3" title="New check">
          <form onSubmit={submit} className="space-y-4">
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4">
              {preview ? <img src={preview} alt="Selected crop" className="max-h-72 rounded-lg object-contain" /> : (
                <div className="py-6 text-center text-sm text-gray-600">
                  <Camera className="mx-auto mb-2 h-10 w-10 text-gray-400" aria-hidden />
                  Photograph one affected leaf or plant part up close, in daylight, in focus.
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])} />
                <Button type="button" onClick={() => camRef.current?.click()}><Camera className="mr-1 h-4 w-4" />Take photo</Button>
                <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-4 w-4" />Upload</Button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {farms.data && farms.data.length > 0 && <Field label="Farm">{(id) => <FarmSelect id={id} farms={farms.data!} value={f.farm_id} onChange={(v) => setF({ ...f, farm_id: v, crop_cycle_id: '' })} />}</Field>}
              {farmCycles.length > 0 ? (
                <Field label="Crop">{(id) => <Select id={id} value={f.crop_cycle_id} onChange={(e) => setF({ ...f, crop_cycle_id: e.target.value })} placeholder="Choose your crop"
                  options={farmCycles.map((c: any) => ({ value: c.id, label: `${cropName(c.crop_id, c.crop_name)} – ${c.farm_name}` }))} />}</Field>
              ) : <Field label="Crop">{(id) => <CropSelect id={id} value={f.crop_id} onChange={(v) => setF({ ...f, crop_id: v })} />}</Field>}
              <Field label="Affected part">{(id) => <Select id={id} value={f.plant_part} onChange={(e) => setF({ ...f, plant_part: e.target.value })} placeholder="Optional"
                options={['leaf', 'stem', 'fruit', 'flower', 'root', 'grain', 'whole_plant', 'other'].map((v) => ({ value: v, label: v.replace('_', ' ') }))} />}</Field>
              <Field label="Growth stage">{(id) => <Input id={id} value={f.growth_stage} onChange={(e) => setF({ ...f, growth_stage: e.target.value })} placeholder="Optional, e.g. flowering" />}</Field>
            </div>
            <Field label="What do you see?" hint="Optional – e.g. yellow spots spreading from the leaf edge for 5 days">{(id) => <Textarea id={id} value={f.symptoms} onChange={(e) => setF({ ...f, symptoms: e.target.value })} />}</Field>
            {err && <ErrorBox error={err} />}
            <Button type="submit" className="w-full" disabled={busy || !file}>{busy ? <><Spinner /> Uploading…</> : 'Analyse photo'}</Button>
            <p className="text-xs text-gray-500">Photos are stored privately. Only you, and experts you choose to ask, can see them. You can delete them at any time.</p>
          </form>
        </Section>

        <Section className="lg:col-span-2" title="History">
          {history.loading ? <Skeleton /> : history.error ? <ErrorBox error={history.error} /> : history.data!.length === 0 ? <Empty title="No checks yet" /> : (
            <ul className="divide-y">
              {history.data!.map((d: any) => (
                <li key={d.id}>
                  <Link to={`/crop-doctor/${d.id}`} className="flex items-center justify-between gap-2 py-2 text-sm hover:bg-gray-50">
                    <div>
                      <p className="font-medium">{d.result_json?.primary_issue?.name || cropName(d.crop_id, d.crop_name) || 'Crop check'}</p>
                      <p className="text-xs text-gray-500">{fmtDateTime(d.created_at)}{!d.saved && ' · not saved'}</p>
                    </div>
                    <Badge tone={STATUS_TONE[d.status]}>{d.status.replace(/_/g, ' ')}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </div>
  );
}

export function DiagnosisDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { ask, node } = useConfirm();
  const { data, error, loading, reload, setData } = useAsync(() => api.get(`/v1/diagnosis/${id}`), [id]);
  const [expertOpen, setExpertOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [urgent, setUrgent] = useState(false);
  const [allowContact, setAllowContact] = useState(false);

  // Poll while processing.
  useEffect(() => {
    if (data?.diagnosis?.status !== 'processing') return;
    const t = setInterval(() => api.get(`/v1/diagnosis/${id}`).then(setData).catch(() => {}), 2500);
    return () => clearInterval(t);
  }, [data?.diagnosis?.status, id, setData]);

  if (loading) return <Skeleton lines={8} />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const d = data.diagnosis;
  const r = d.result_json;
  const list = (title: string, items?: string[]) => items && items.length > 0 && (
    <div><h3 className="mb-1 text-sm font-semibold">{title}</h3><ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">{items.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
  );

  const report = () => {
    const lines = [`FARMDirect Crop Doctor report`, `Date: ${fmtDateTime(d.created_at)}`, `Status: ${d.status}`];
    if (r) {
      lines.push(`Crop identified: ${r.crop_identified ?? 'unknown'}`, `Suspected issue: ${r.primary_issue?.name ?? 'none'} (${r.primary_issue?.type ?? ''}, confidence ${Math.round((r.primary_issue?.confidence ?? 0) * 100)}%)`,
        `Severity: ${r.severity}`, `Symptoms: ${r.visual_symptoms.join('; ')}`, `Immediate actions: ${r.immediate_actions.join('; ')}`, `Prevention: ${r.prevention.join('; ')}`,
        `Treatment options: ${r.treatment_options.join('; ')}`);
    }
    if (d.expert_notes) lines.push(`Expert (${d.expert_status}): ${d.expert_notes}`);
    lines.push('', data.disclaimer);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `crop-doctor-${d.id.slice(0, 8)}.txt`; a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      {node}
      <PageHeader title="Crop Doctor result" icon={<Stethoscope />} subtitle={fmtDateTime(d.created_at)}
        actions={<>
          {!d.saved && <Button variant="outline" onClick={async () => { await api.post(`/v1/diagnosis/${d.id}/save`); toast('Saved to history'); reload(); }}>Save</Button>}
          <Button variant="outline" onClick={report}><Download className="mr-1 h-4 w-4" />Report</Button>
          <Button onClick={() => setExpertOpen(true)} disabled={d.expert_status === 'requested'}><UserRound className="mr-1 h-4 w-4" />{d.expert_status === 'requested' ? 'Expert requested' : 'Ask an expert'}</Button>
        </>} />
      <Notice tone="warn">{data.disclaimer}</Notice>

      <div className="grid gap-4 lg:grid-cols-3">
        <Section title="Photo">
          {d.image_path ? <img src={`/api/v1/diagnosis/${d.id}/image`} alt="Submitted crop" className="w-full rounded-lg" /> : <Empty title="Photo deleted" icon={<ImageOff />} />}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {d.image_path && <Button size="sm" variant="outline" onClick={async () => {
              if (!(await ask('Delete photo?', 'The photo will be permanently deleted. The text result is kept.', { danger: true, label: 'Delete photo' }))) return;
              await api.del(`/v1/diagnosis/${d.id}/image`); reload();
            }}><Trash2 className="mr-1 h-3 w-3" />Delete photo</Button>}
            <Button size="sm" variant="outline" onClick={async () => {
              if (!(await ask('Delete this check?', 'This deletes the photo and the result permanently.', { danger: true, label: 'Delete' }))) return;
              await api.del(`/v1/diagnosis/${d.id}`); nav('/crop-doctor');
            }}>Delete check</Button>
          </div>
        </Section>

        <Section className="lg:col-span-2" title="Assessment">
          {d.status === 'processing' && <div className="flex items-center gap-2 text-sm text-gray-700"><Spinner /> Analysing the photo… this usually takes a few seconds.</div>}
          {d.status === 'not_configured' && <SetupNotice service="AI image analysis" setup="Set GEMINI_API_KEY on the server. Your photo is saved; you can ask an expert to look at it now." />}
          {d.status === 'failed' && <ErrorBox error={d.error || 'Analysis failed'} />}
          {d.status === 'needs_better_image' && (
            <Notice tone="warn" title="Please retake the photo">{r?.retake_guidance || 'The photo was not clear enough for a reliable assessment.'}</Notice>
          )}
          {d.expert_status && d.expert_status !== 'requested' && (
            <div className="mb-3"><Notice tone="ok" title={`Expert ${d.expert_status} this result`}>{d.expert_notes}</Notice></div>
          )}
          {r && d.status === 'completed' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold">{r.primary_issue?.name ?? 'No clear issue identified'}</h2>
                {r.primary_issue && <Badge tone="purple">{r.primary_issue.type.replace('_', ' ')}</Badge>}
                <Badge tone={severityTone(r.severity)}>severity: {r.severity}</Badge>
                <SpeakButton text={[r.primary_issue?.name, ...r.immediate_actions, ...r.prevention].filter(Boolean).join('. ')} />
              </div>
              <p className="text-sm text-gray-700">
                Crop identified: <b>{r.crop_identified ?? 'unclear'}</b>
                {r.crop_matches_selection === false && <span className="text-amber-700"> (does not match the crop you selected)</span>}
                {r.primary_issue && <> · Model confidence: <b>{Math.round(r.primary_issue.confidence * 100)}%</b></>}
              </p>
              {r.expert_review_recommended && <Notice tone="warn">Confidence is limited. We recommend asking an expert before acting.</Notice>}
              {list('Visible symptoms', r.visual_symptoms)}
              {r.alternative_causes.length > 0 && (
                <div><h3 className="mb-1 text-sm font-semibold">Other possible causes</h3>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">{r.alternative_causes.map((a: any, i: number) => <li key={i}><b>{a.name}</b> – {a.reason}</li>)}</ul></div>
              )}
              {list('Contributing conditions', r.environmental_factors)}
              {list('What to do now', r.immediate_actions)}
              {list('Prevention', r.prevention)}
              {list('Treatment options (use only label-approved products for your crop)', r.treatment_options)}
              {list('Questions to help confirm', r.follow_up_questions)}
              <p className="text-xs text-gray-500">Model: {d.model}</p>
            </div>
          )}
        </Section>
      </div>

      <Modal open={expertOpen} onClose={() => setExpertOpen(false)} title="Ask an expert">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          try {
            const res = await api.post(`/v1/diagnosis/${d.id}/expert`, { question, urgency: urgent ? 'urgent' : 'normal', allow_contact: allowContact });
            toast('Sent to experts'); setExpertOpen(false); nav(`/experts/cases/${res.caseId}`);
          } catch (err: any) { toast(err.message, 'error'); }
        }}>
          <Field label="Your question" required>{(id) => <Textarea id={id} value={question} onChange={(e) => setQuestion(e.target.value)} required minLength={3} />}</Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} />This is urgent (spreading fast)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allowContact} onChange={(e) => setAllowContact(e.target.checked)} />Experts may see my phone number and call me</label>
          <p className="text-xs text-gray-500">Verified experts will be able to see this photo and result.</p>
          <div className="flex justify-end"><Button type="submit">Send</Button></div>
        </form>
      </Modal>
    </div>
  );
}

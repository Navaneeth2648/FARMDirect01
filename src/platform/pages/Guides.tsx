import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, ExternalLink, Leaf, Search, Stethoscope } from 'lucide-react';
import { api, fmtDate, qs } from '../api';
import { useAuth } from '../auth';
import { Badge, Button, Empty, ErrorBox, Field, Input, Notice, PageHeader, Section, Select, Skeleton, Tabs, Textarea, useAsync, useToast } from '../ui';
import { useCrops } from '../shared';

const CATS = [{ id: '', label: 'All' }, { id: 'pest', label: 'Pests' }, { id: 'disease', label: 'Diseases' }, { id: 'deficiency', label: 'Deficiencies' }, { id: 'weed', label: 'Weeds' }, { id: 'crop', label: 'Crops' }] as const;

function ReviewBadge({ s }: { s: string }) {
  return s === 'approved' ? <Badge tone="green">Expert-reviewed</Badge> : <Badge tone="amber">Awaiting expert review</Badge>;
}

export function GuidesPage() {
  const [cat, setCat] = useState<string>('');
  const [crop, setCrop] = useState('');
  const [term, setTerm] = useState('');
  const crops = useCrops();
  const r = useAsync(() => api.get(`/v1/guides${qs({ category: cat || undefined, crop: crop || undefined, q: term || undefined })}`), [cat, crop, term]);
  return (
    <div className="space-y-4">
      <PageHeader title="Crop & Pest Guide" icon={<Leaf />} subtitle="How to recognise common pests, diseases and deficiencies, and what to do. Always confirm with an expert before spraying." />
      <div className="flex flex-wrap items-end gap-2">
        <Tabs value={cat as any} onChange={(v: any) => setCat(v)} tabs={CATS as any} />
        <div className="w-44"><Select aria-label="Crop" value={crop} onChange={(e) => setCrop(e.target.value)} placeholder="All crops" options={crops.map((c) => ({ value: c.id, label: c.name }))} /></div>
        <label className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <Input className="pl-9" placeholder="Search by name or symptom" value={term} onChange={(e) => setTerm(e.target.value)} aria-label="Search guides" />
        </label>
      </div>
      <Notice>Have a photo of the problem? <Link className="font-semibold underline" to="/crop-doctor">Check it in Crop Doctor</Link>. Photos for this guide are added only from sources that allow reuse, with credit.</Notice>
      {r.loading ? <Skeleton lines={6} /> : r.error ? <ErrorBox error={r.error} onRetry={r.reload} /> : !r.data.guides.length ? <Empty title="No matching entries" /> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.data.guides.map((g: any) => (
            <Link key={g.id} to={`/guides/${g.id}`} className="rounded-2xl border bg-white p-4 hover:border-emerald-400 hover:shadow-sm">
              {g.image_url && <img src={g.image_url} alt={g.name} loading="lazy" className="mb-2 h-32 w-full rounded-lg object-cover" />}
              <div className="flex flex-wrap items-center gap-2"><Badge tone="blue">{g.category}</Badge><ReviewBadge s={g.review_status} /></div>
              <p className="mt-2 font-semibold">{g.name}</p>
              {g.scientific_name && <p className="text-xs italic text-gray-500">{g.scientific_name}</p>}
              <p className="mt-1 line-clamp-3 text-sm text-gray-600">{g.symptoms}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function GuideDetailPage() {
  const { id } = useParams();
  const r = useAsync(() => api.get(`/v1/guides/${id}`), [id]);
  const crops = useCrops();
  if (r.loading) return <Skeleton lines={8} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const g = r.data.guide;
  const cropName = (c: string) => crops.find((x) => x.id === c)?.name ?? c;
  return (
    <div className="space-y-4">
      <PageHeader title={g.name} icon={<Leaf />} subtitle={<span className="flex flex-wrap items-center gap-2">{g.scientific_name && <i>{g.scientific_name}</i>}<Badge tone="blue">{g.category}</Badge><ReviewBadge s={g.review_status} /></span>}
        actions={<Link to="/crop-doctor"><Button variant="outline"><Stethoscope className="mr-1 h-4 w-4" />Check a photo</Button></Link>} />
      {g.image_url && <figure><img src={g.image_url} alt={g.name} className="max-h-72 rounded-xl object-cover" /><figcaption className="mt-1 text-xs text-gray-500">{g.image_credit} · {g.image_license}</figcaption></figure>}
      {g.crops?.length > 0 && <p className="text-sm">Crops: {g.crops.map(cropName).join(', ')}</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="What you will see"><p className="whitespace-pre-line text-sm">{g.symptoms}</p></Section>
        {g.identification && <Section title="How to check"><p className="whitespace-pre-line text-sm">{g.identification}</p></Section>}
        <Section title="What to do"><p className="whitespace-pre-line text-sm">{g.management}</p><p className="mt-2 text-xs text-gray-500">Use only products registered for this crop and problem, at the dose on the label.</p></Section>
        {g.seek_help && <Section title="When to get expert help"><p className="text-sm">{g.seek_help}</p><Link to="/experts" className="mt-2 inline-block text-sm font-semibold text-emerald-700 underline">Ask an expert</Link></Section>}
      </div>
      {r.data.related_advisories.length > 0 && (
        <Section title="Related advisories">
          <ul className="list-disc pl-5 text-sm">{r.data.related_advisories.map((a: any) => <li key={a.id}><Link className="underline" to="/advisory">{a.title}</Link> <span className="text-xs text-gray-500">({cropName(a.crop_id)})</span></li>)}</ul>
        </Section>
      )}
      <p className="text-xs text-gray-500">Source: {g.source_name || 'FARMDirect editorial'}{g.source_url && <> · <a className="underline" href={g.source_url} target="_blank" rel="noreferrer">link</a></>}</p>
    </div>
  );
}

const METRIC_LABEL: Record<string, string> = { area: 'Area', production: 'Production', yield: 'Yield' };
const STATUS_LABEL: Record<string, { label: string; tone: 'green' | 'amber' | 'blue' }> = {
  official: { label: 'Final official figure', tone: 'green' }, provisional: { label: 'Provisional', tone: 'amber' }, advance_estimate: { label: 'Advance estimate', tone: 'blue' },
};

export function StatisticsPage() {
  const { can } = useAuth();
  const [f, setF] = useState({ crop: '', state: '', year: '', metric: '' });
  const r = useAsync(() => api.get(`/v1/statistics${qs({ crop: f.crop || undefined, state: f.state || undefined, year: f.year || undefined, metric: f.metric || undefined })}`), [f.crop, f.state, f.year, f.metric]);
  const ecrop = useAsync(() => api.get('/v1/ecrop/status'));
  return (
    <div className="space-y-4">
      <PageHeader title="Crop Statistics" icon={<BarChart3 />} subtitle="Area, production and yield from official government publications, with the source and date for every figure." />
      {r.loading ? <Skeleton lines={6} /> : r.error ? <ErrorBox error={r.error} onRetry={r.reload} /> : (
        <>
          {!r.data.facets.crops.length ? (
            <Empty title="No official statistics published yet" icon={<BarChart3 />}>
              FARMDirect shows crop statistics only after an administrator imports them from an official publication (for example, the Ministry of Agriculture & Farmers Welfare’s area, production and yield releases). Nothing is estimated or filled in.
            </Empty>
          ) : (
            <>
              <div className="grid gap-2 sm:grid-cols-4">
                <Select aria-label="Crop" value={f.crop} onChange={(e) => setF({ ...f, crop: e.target.value })} placeholder="All crops" options={r.data.facets.crops.map((c: string) => ({ value: c, label: c }))} />
                <Select aria-label="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} placeholder="All states" options={r.data.facets.states.map((c: string) => ({ value: c, label: c }))} />
                <Select aria-label="Year" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} placeholder="All years" options={r.data.facets.years.map((c: string) => ({ value: c, label: c }))} />
                <Select aria-label="Measure" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })} placeholder="All measures" options={Object.entries(METRIC_LABEL).map(([value, label]) => ({ value, label }))} />
              </div>
              <div className="overflow-x-auto rounded-2xl border bg-white">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs text-gray-600"><tr><th className="p-2">Crop</th><th className="p-2">Area</th><th className="p-2">Year / season</th><th className="p-2">Measure</th><th className="p-2 text-right">Value</th><th className="p-2">Status</th></tr></thead>
                  <tbody className="divide-y">
                    {r.data.rows.map((x: any) => (
                      <tr key={x.id}>
                        <td className="p-2">{x.crop}</td><td className="p-2">{[x.district, x.state].filter(Boolean).join(', ')}</td><td className="p-2">{x.year}{x.season ? ` · ${x.season}` : ''}</td>
                        <td className="p-2">{METRIC_LABEL[x.metric]}</td><td className="p-2 text-right tabular-nums">{Number(x.value).toLocaleString('en-IN')} <span className="text-xs text-gray-500">{x.unit}</span></td>
                        <td className="p-2"><Badge tone={STATUS_LABEL[x.data_status]?.tone ?? 'gray'}>{STATUS_LABEL[x.data_status]?.label ?? x.data_status}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Section title="Sources">
                <ul className="space-y-1 text-sm">{r.data.sources.map((s: any, i: number) => (
                  <li key={i}><a className="inline-flex items-center gap-1 underline" href={s.source_url} target="_blank" rel="noreferrer">{s.source_name}<ExternalLink className="h-3 w-3" /></a> <span className="text-xs text-gray-500">· published {fmtDate(s.publication_date)} · imported {fmtDate(s.retrieved_at)} · {s.n} rows</span></li>
                ))}</ul>
                <p className="mt-2 text-xs text-gray-500">{r.data.note}</p>
              </Section>
            </>
          )}
        </>
      )}
      {can('data.manage') && <StatisticsImport onDone={r.reload} />}
      {ecrop.data && (
        <Notice tone="warn" title="Government e-crop records">
          {ecrop.data.message}
          <details className="mt-1"><summary className="cursor-pointer text-xs font-semibold">What is needed to connect them</summary><ul className="mt-1 list-disc pl-5 text-xs">{ecrop.data.requirements.map((x: string) => <li key={x}>{x}</li>)}</ul></details>
        </Notice>
      )}
    </div>
  );
}

const SAMPLE = 'crop,state,district,season,year,metric,value,unit';

function StatisticsImport({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [m, setM] = useState({ source_name: '', source_url: '', publication_date: '', data_status: 'official', csv: '' });
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const lines = m.csv.trim().split(/\r?\n/).filter(Boolean);
    const head = lines.shift()?.split(',').map((h) => h.trim().toLowerCase());
    if (!head || SAMPLE.split(',').some((c) => !head.includes(c))) { toast(`First line must be: ${SAMPLE}`, 'error'); return; }
    const rows = lines.map((ln) => {
      const cells = ln.split(',').map((c) => c.trim());
      const o: any = Object.fromEntries(head.map((h, i) => [h, cells[i] ?? '']));
      return { ...o, value: Number(o.value) };
    });
    setBusy(true);
    try {
      const r = await api.post('/v1/statistics/import', { source_name: m.source_name, source_url: m.source_url, publication_date: m.publication_date || null, data_status: m.data_status, rows });
      toast(`Imported ${r.imported} rows`); setM({ ...m, csv: '' }); onDone();
    } catch (e: any) { toast(e.fields?.[0] ? `${e.fields[0].path}: ${e.fields[0].message}` : e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Section title="Import official statistics (administrators)" description="Paste rows copied from the official publication. Every row is stored with this source, link and status. Units: area – hectare / thousand hectare; production – tonne / thousand tonne / lakh bale (170 kg); yield – kg/hectare / tonne/hectare.">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Publication name" required>{(id) => <Input id={id} value={m.source_name} onChange={(e) => setM({ ...m, source_name: e.target.value })} />}</Field>
        <Field label="Official link (https)" required>{(id) => <Input id={id} value={m.source_url} onChange={(e) => setM({ ...m, source_url: e.target.value })} />}</Field>
        <Field label="Publication date">{(id) => <Input id={id} type="date" value={m.publication_date} onChange={(e) => setM({ ...m, publication_date: e.target.value })} />}</Field>
        <Field label="Status">{(id) => <Select id={id} value={m.data_status} onChange={(e) => setM({ ...m, data_status: e.target.value })} options={Object.entries(STATUS_LABEL).map(([value, s]) => ({ value, label: s.label }))} />}</Field>
      </div>
      <Field label="Rows (CSV)" hint={`First line: ${SAMPLE}`}>{(id) => <Textarea id={id} rows={5} className="font-mono text-xs" value={m.csv} onChange={(e) => setM({ ...m, csv: e.target.value })} placeholder={SAMPLE} />}</Field>
      <Button className="mt-2" disabled={busy || !m.source_name || !m.source_url || !m.csv.trim()} onClick={submit}>Import</Button>
    </Section>
  );
}

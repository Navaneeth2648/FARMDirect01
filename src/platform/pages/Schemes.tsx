import { useState } from 'react';
import { Bookmark, ExternalLink, Landmark } from 'lucide-react';
import { api, fmtDate, qs } from '../api';
import { useAuth } from '../auth';
import { Badge, Empty, ErrorBox, INDIAN_STATES, Notice, PageHeader, Section, Select, Skeleton, SpeakButton, useAsync, useToast } from '../ui';
import { CropSelect } from '../shared';

const TYPES = ['income_support', 'insurance', 'credit', 'irrigation', 'soil', 'market', 'subsidy', 'mechanisation', 'other'];
const CATS = [{ value: 'small', label: 'Small farmer' }, { value: 'marginal', label: 'Marginal farmer' }, { value: 'tenant', label: 'Tenant / sharecropper' }];

export function SchemesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ state: user?.state || '', type: '', category: '', crop: '', level: '' });
  const r = useAsync(() => api.get(`/v1/schemes${qs(f)}`), [f]);
  return (
    <div className="space-y-4">
      <PageHeader title="Government Schemes" icon={<Landmark />} subtitle="Central and state schemes for farmers, with links to official websites" />
      {r.data && <Notice tone="warn">{r.data.disclaimer}</Notice>}
      <Section>
        <div className="grid gap-2 sm:grid-cols-5">
          <Select aria-label="State" value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })} options={INDIAN_STATES} placeholder="All states" />
          <Select aria-label="Level" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })} options={[{ value: 'central', label: 'Central' }, { value: 'state', label: 'State' }]} placeholder="Central & state" />
          <Select aria-label="Type" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} options={TYPES.map((t) => ({ value: t, label: t.replace('_', ' ') }))} placeholder="All types" />
          <Select aria-label="Farmer category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} options={CATS} placeholder="Any farmer" />
          <CropSelect value={f.crop} onChange={(v) => setF({ ...f, crop: v })} />
        </div>
      </Section>
      {r.loading ? <Skeleton lines={6} /> : r.error ? <ErrorBox error={r.error} /> : r.data.schemes.length === 0 ? <Empty title="No schemes match these filters" /> : (
        <div className="space-y-3">
          {r.data.schemes.map((s: any) => (
            <Section key={s.id}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={s.level === 'central' ? 'blue' : 'purple'}>{s.level === 'central' ? 'Central scheme' : `State: ${s.state}`}</Badge>
                <Badge>{s.scheme_type.replace('_', ' ')}</Badge>
                {s.last_verified_at ? <Badge tone="green">Checked {fmtDate(s.last_verified_at)}</Badge> : <Badge tone="amber">Not yet re-checked by admin</Badge>}
              </div>
              <h2 className="mt-2 text-lg font-semibold">{s.name}</h2>
              <p className="text-xs text-gray-500">{s.department}</p>
              <dl className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div><dt className="font-semibold">Benefits</dt><dd className="text-gray-700">{s.benefits}</dd></div>
                <div><dt className="font-semibold">Who can apply</dt><dd className="text-gray-700">{s.eligibility}</dd></div>
                {s.documents && <div><dt className="font-semibold">Documents</dt><dd className="text-gray-700">{s.documents}</dd></div>}
                {s.process && <div><dt className="font-semibold">How to apply</dt><dd className="text-gray-700">{s.process}</dd></div>}
                {s.deadline && <div><dt className="font-semibold">Deadline</dt><dd className="text-gray-700">{s.deadline}</dd></div>}
              </dl>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                <a href={s.official_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-emerald-700 underline">Official website <ExternalLink className="h-3 w-3" /></a>
                <SpeakButton text={`${s.name}. ${s.benefits}. ${s.eligibility}`} />
                <button className="inline-flex items-center gap-1 text-xs text-gray-600 hover:underline" onClick={async () => { await api.post('/v1/me/saved', { item_type: 'scheme', item_id: s.id, title: s.name }); toast('Saved'); }}><Bookmark className="h-3 w-3" />Save</button>
              </div>
            </Section>
          ))}
        </div>
      )}
    </div>
  );
}

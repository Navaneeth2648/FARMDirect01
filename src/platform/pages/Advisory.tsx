import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, Sprout } from 'lucide-react';
import { api, qs } from '../api';
import { Badge, Empty, ErrorBox, PageHeader, Section, Select, Skeleton, SpeakButton, Tabs, useAsync, useToast } from '../ui';
import { CropSelect, useCropName } from '../shared';

function AdvisoryCard({ a }: { a: any }) {
  const toast = useToast();
  return (
    <article className="rounded-xl border border-gray-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="blue">{a.topic}</Badge>
        {a.review_status === 'approved' ? <Badge tone="green">Expert approved</Badge> : <Badge tone="amber">General guidance · awaiting expert review</Badge>}
        {a.region && <Badge>{a.region}</Badge>}
      </div>
      <h3 className="mt-2 font-semibold">{a.title}</h3>
      <p className="mt-1 text-sm text-gray-700">{a.body}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {a.source_name && <span>Source: {a.source_url ? <a className="underline" href={a.source_url} target="_blank" rel="noreferrer">{a.source_name}</a> : a.source_name}</span>}
        <SpeakButton text={`${a.title}. ${a.body}`} />
        <button className="inline-flex items-center gap-1 text-emerald-800 hover:underline" onClick={async () => {
          await api.post('/v1/me/saved', { item_type: 'advisory', item_id: a.id, title: a.title }); toast('Saved');
        }}><Bookmark className="h-3 w-3" />Save</button>
      </div>
    </article>
  );
}

export function AdvisoryPage() {
  const [tab, setTab] = useState<'mine' | 'browse'>('mine');
  const mine = useAsync(() => api.get('/v1/advisory/my').then((r) => r.items));
  const cropName = useCropName();
  const [crop, setCrop] = useState('');
  const [topic, setTopic] = useState('');
  const stages = useAsync(() => (crop ? api.get(`/v1/crops/${crop}`) : Promise.resolve(null)), [crop]);
  const browse = useAsync(() => (crop ? api.get(`/v1/advisory${qs({ crop_id: crop, topic })}`).then((r) => r.advisories) : Promise.resolve([])), [crop, topic]);

  return (
    <div>
      <PageHeader title="Crop Advisory" icon={<Sprout />} subtitle="Stage-wise guidance for your crops. Chemical doses are never prescribed here; follow product labels and your local agriculture officer." />
      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'mine', label: 'My crops' }, { id: 'browse', label: 'Browse by crop' }]} />

      {tab === 'mine' && (mine.loading ? <Skeleton lines={6} /> : mine.error ? <ErrorBox error={mine.error} onRetry={mine.reload} /> : mine.data!.length === 0 ? (
        <Empty title="No active crops" action={<Link to="/farm?add=crop" className="text-emerald-700 underline">Add a crop</Link>}>Add a crop with its sowing date to see guidance for its current stage.</Empty>
      ) : (
        <div className="space-y-4">
          {mine.data!.map(({ cycle, advisories }: any) => (
            <Section key={cycle.id} title={`${cropName(cycle.crop_id, cycle.crop_name)} – ${cycle.farm_name}`}
              description={cycle.stage_status === 'in_progress' ? `Day ${cycle.current_day}: ${cycle.stage?.name}` : cycle.stage_status === 'not_started' ? 'Not yet sown' : 'Past expected cycle length – update status if harvested'}>
              {advisories.length === 0 ? <p className="text-sm text-gray-500">No guidance recorded for this stage yet.</p> : <div className="space-y-3">{advisories.map((a: any) => <AdvisoryCard key={a.id} a={a} />)}</div>}
            </Section>
          ))}
        </div>
      ))}

      {tab === 'browse' && (
        <div className="space-y-4">
          <Section>
            <div className="grid gap-3 sm:grid-cols-2">
              <CropSelect value={crop} onChange={setCrop} />
              <Select value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="All topics" aria-label="Topic"
                options={['general', 'soil', 'irrigation', 'nutrient', 'weed', 'pest', 'disease', 'harvest'].map((t) => ({ value: t, label: t }))} />
            </div>
          </Section>
          {stages.data && (
            <Section title="Crop stages" description="Typical durations for a medium-duration variety. Your variety and region may differ.">
              <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {stages.data.stages.map((s: any) => (
                  <li key={s.key} className="rounded-lg bg-gray-50 p-2 text-sm">
                    <p className="font-medium">{s.seq}. {s.name}</p>
                    <p className="text-xs text-gray-600">Day {s.start_day} to {s.end_day} · water need: {s.water_need}</p>
                  </li>
                ))}
              </ol>
            </Section>
          )}
          {!crop ? <Empty title="Choose a crop to browse guidance" /> : browse.loading ? <Skeleton /> : (
            <div className="space-y-3">{(browse.data || []).map((a: any) => <AdvisoryCard key={a.id} a={a} />)}</div>
          )}
        </div>
      )}
      <p className="mt-6 text-xs text-gray-500">Experts can add region-specific advisories from the Expert Desk. Approved guidance is shown first.</p>
    </div>
  );
}

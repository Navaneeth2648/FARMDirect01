import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, Bookmark, Newspaper, Share2, ThumbsDown, ThumbsUp } from 'lucide-react';
import { api, fmtDate, qs } from '../api';
import { useAuth } from '../auth';
import { LANGUAGES } from '../i18n';
import { Badge, Empty, ErrorBox, Input, Notice, PageHeader, Section, Select, Skeleton, SpeakButton, useAsync, useToast } from '../ui';
import { CropSelect } from '../shared';

const KNOWLEDGE_TYPES = ['article', 'guide', 'video', 'audio', 'infographic', 'success_story'];
const NEWS_TYPES = ['news', 'event', 'webinar', 'training'];

export function KnowledgePage({ kind }: { kind: 'knowledge' | 'news' }) {
  const { lang } = useAuth();
  const [f, setF] = useState({ q: '', type: '', crop: '', lang: '' });
  const [query, setQuery] = useState(f);
  useEffect(() => { setF({ q: '', type: '', crop: '', lang: '' }); setQuery({ q: '', type: '', crop: '', lang: '' }); }, [kind]);
  const r = useAsync(() => api.get(`/v1/content${qs({ ...query, kind })}`), [query, kind]);
  const types = kind === 'news' ? NEWS_TYPES : KNOWLEDGE_TYPES;
  return (
    <div className="space-y-4">
      <PageHeader title={kind === 'news' ? 'News & Events' : 'Knowledge Centre'} icon={kind === 'news' ? <Newspaper /> : <BookOpen />}
        subtitle={kind === 'news' ? 'Agricultural news, fairs, trainings and webinars' : 'Expert articles, crop guides, videos and audio advisories'} />
      <Section>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); setQuery(f); }}>
          <Input aria-label="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search…" />
          <Select aria-label="Type" value={f.type} onChange={(e) => { const n = { ...f, type: e.target.value }; setF(n); setQuery(n); }} options={types.map((t) => ({ value: t, label: t.replace('_', ' ') }))} placeholder="All types" />
          <CropSelect value={f.crop} onChange={(v) => { const n = { ...f, crop: v }; setF(n); setQuery(n); }} />
          <Select aria-label="Language" value={f.lang} onChange={(e) => { const n = { ...f, lang: e.target.value }; setF(n); setQuery(n); }} options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} placeholder={`All languages (yours: ${lang})`} />
        </form>
      </Section>
      {r.loading ? <Skeleton lines={6} /> : r.error ? <ErrorBox error={r.error} /> : r.data.items.length === 0 ? (
        <Empty title="Nothing published yet">Content appears here after editors and experts publish it through the review workflow.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {r.data.items.map((c: any) => (
            <Link key={c.id} to={`/knowledge/${c.id}`} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 hover:border-emerald-400">
              <div className="flex flex-wrap gap-1"><Badge tone="blue">{c.type.replace('_', ' ')}</Badge><Badge>{c.language}</Badge>{c.reading_minutes && <Badge>{c.reading_minutes} min read</Badge>}</div>
              <p className="mt-2 font-semibold">{c.title}</p>
              {c.summary && <p className="mt-1 line-clamp-3 text-sm text-gray-600">{c.summary}</p>}
              <p className="mt-auto pt-2 text-xs text-gray-500">{c.event_date ? `Event: ${fmtDate(c.event_date)}${c.event_location ? ` · ${c.event_location}` : ''}` : fmtDate(c.published_at)}{c.author_name && ` · ${c.author_name}`}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const isYouTube = (u: string) => /youtube\.com\/watch\?v=|youtu\.be\//.test(u);
const ytEmbed = (u: string) => `https://www.youtube-nocookie.com/embed/${u.includes('youtu.be/') ? u.split('youtu.be/')[1].split(/[?&]/)[0] : new URL(u).searchParams.get('v')}`;

export function ContentDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const r = useAsync(() => api.get(`/v1/content/${id}`), [id]);
  useEffect(() => {
    if (r.data?.item) api.post('/v1/me/recent', { item_type: 'content', item_id: r.data.item.id, title: r.data.item.title }).catch(() => {});
  }, [r.data?.item]);
  if (r.loading) return <Skeleton lines={10} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const c = r.data.item;
  const share = async () => {
    const url = window.location.href;
    try { if (navigator.share) await navigator.share({ title: c.title, url }); else { await navigator.clipboard.writeText(url); toast('Link copied'); } } catch { /* cancelled */ }
  };
  return (
    <article className="mx-auto max-w-3xl space-y-4">
      <div>
        <div className="flex flex-wrap gap-1"><Badge tone="blue">{c.type.replace('_', ' ')}</Badge>{c.status !== 'published' && <Badge tone="amber">{c.status}</Badge>}</div>
        <h1 className="mt-2 text-2xl font-bold">{c.title}</h1>
        <p className="text-sm text-gray-500">
          {c.author_name && <>By {c.author_name}{c.author_role === 'expert' && ' (verified expert)'} · </>}
          Published {fmtDate(c.published_at)} · Updated {fmtDate(c.updated_at)}{c.reading_minutes && ` · ${c.reading_minutes} min read`}
        </p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          <SpeakButton text={`${c.title}. ${c.summary || ''} ${c.body || c.transcript || ''}`} />
          <button className="inline-flex items-center gap-1 text-emerald-800 hover:underline" onClick={share}><Share2 className="h-4 w-4" />Share</button>
          <button className="inline-flex items-center gap-1 text-emerald-800 hover:underline" onClick={async () => { await api.post('/v1/me/saved', { item_type: 'content', item_id: c.id, title: c.title }); toast('Saved'); }}><Bookmark className="h-4 w-4" />Save</button>
        </div>
      </div>
      {c.event_date && <Notice>Event on {fmtDate(c.event_date)}{c.event_location && ` at ${c.event_location}`}</Notice>}
      {c.media_url && (c.type === 'video' && isYouTube(c.media_url)
        ? <iframe className="aspect-video w-full rounded-xl" src={ytEmbed(c.media_url)} title={c.title} allowFullScreen loading="lazy" />
        : c.type === 'audio' ? <audio controls src={c.media_url} className="w-full" />
        : c.type === 'video' ? <video controls src={c.media_url} className="w-full rounded-xl" preload="none" />
        : c.type === 'infographic' ? <img src={c.media_url} alt={c.title} className="w-full rounded-xl" loading="lazy" />
        : <a href={c.media_url} className="text-emerald-700 underline" target="_blank" rel="noreferrer">Open media</a>)}
      {c.summary && <p className="text-lg text-gray-700">{c.summary}</p>}
      {c.body && <div className="whitespace-pre-wrap leading-relaxed text-gray-800">{c.body}</div>}
      {c.transcript && <details className="rounded-xl border p-3"><summary className="cursor-pointer font-medium">Transcript / text version</summary><p className="mt-2 whitespace-pre-wrap text-sm">{c.transcript}</p></details>}
      {(c.source_name || c.license) && <p className="text-xs text-gray-500">{c.source_name && <>Source: {c.source_url ? <a className="underline" href={c.source_url} target="_blank" rel="noreferrer">{c.source_name}</a> : c.source_name}. </>}{c.license && `License: ${c.license}`}</p>}
      <Section title="Was this helpful?">
        <div className="flex gap-2">
          <button className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-emerald-50" onClick={async () => { await api.post(`/v1/content/${c.id}/feedback`, { helpful: true }); toast('Thanks for your feedback'); }}><ThumbsUp className="h-4 w-4" />Yes</button>
          <button className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-red-50" onClick={async () => { await api.post(`/v1/content/${c.id}/feedback`, { helpful: false }); toast('Thanks for your feedback'); }}><ThumbsDown className="h-4 w-4" />No</button>
          {r.data.feedback?.total > 0 && <span className="self-center text-xs text-gray-500">{r.data.feedback.yes} of {r.data.feedback.total} found this helpful</span>}
        </div>
      </Section>
      {r.data.related.length > 0 && (
        <Section title="Related">
          <ul className="space-y-1 text-sm">{r.data.related.map((x: any) => <li key={x.id}><Link className="underline" to={`/knowledge/${x.id}`}>{x.title}</Link></li>)}</ul>
        </Section>
      )}
    </article>
  );
}

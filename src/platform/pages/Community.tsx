import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Flag, MessagesSquare, Plus, ShieldCheck } from 'lucide-react';
import { api, fmtDateTime, qs } from '../api';
import { useAuth, isVerifiedPro } from '../auth';
import { Badge, Button, Empty, ErrorBox, Field, Input, Modal, Notice, PageHeader, Section, Select, Skeleton, Textarea, useAsync, useToast } from '../ui';
import { CropSelect, useCropName } from '../shared';

const CATS = [{ value: 'question', label: 'Questions' }, { value: 'experience', label: 'Farmer experiences' }, { value: 'discussion', label: 'Discussion' }];

function ReportButton({ type, id }: { type: string; id: string }) {
  const toast = useToast();
  return (
    <button aria-label="Report" className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-700" onClick={async () => {
      const reason = prompt('Why are you reporting this? (spam, scam, abusive, misleading…)');
      if (!reason) return;
      await api.post('/v1/community/report', { target_type: type, target_id: id, reason }); toast('Reported to moderators');
    }}><Flag className="h-3 w-3" />Report</button>
  );
}

export function CommunityPage() {
  const toast = useToast();
  const nav = useNavigate();
  const cropName = useCropName();
  const [f, setF] = useState({ category: '', crop: '', q: '' });
  const [query, setQuery] = useState(f);
  const posts = useAsync(() => api.get(`/v1/community/posts${qs(query)}`), [query]);
  const [form, setForm] = useState<any>(null);

  return (
    <div className="space-y-4">
      <PageHeader title="Community" icon={<MessagesSquare />} subtitle="Share experiences and ask other farmers"
        actions={<Button onClick={() => setForm({ category: 'question', title: '', body: '', crop_id: '' })}><Plus className="mr-1 h-4 w-4" />New post</Button>} />
      <Notice tone="warn">{posts.data?.notice || 'Community posts are not verified advice.'} Never share OTPs, bank details or UPI PINs. Report anyone offering guaranteed profits or loans.</Notice>
      <Section>
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={(e) => { e.preventDefault(); setQuery(f); }}>
          <Input aria-label="Search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Search posts" />
          <Select aria-label="Category" value={f.category} onChange={(e) => { const n = { ...f, category: e.target.value }; setF(n); setQuery(n); }} options={CATS} placeholder="All" />
          <CropSelect value={f.crop} onChange={(v) => { const n = { ...f, crop: v }; setF(n); setQuery(n); }} />
          <Button type="submit" variant="outline">Search</Button>
        </form>
      </Section>
      {posts.loading ? <Skeleton lines={6} /> : posts.error ? <ErrorBox error={posts.error} /> : posts.data.posts.length === 0 ? <Empty title="No posts yet">Be the first to start a discussion.</Empty> : (
        <ul className="space-y-2">
          {posts.data.posts.map((p: any) => (
            <li key={p.id}>
              <Link to={`/community/${p.id}`} className="block rounded-2xl border border-gray-200 bg-white p-4 hover:border-emerald-400">
                <div className="flex flex-wrap items-center gap-1"><Badge>{p.category}</Badge>{p.crop_id && <Badge tone="purple">{cropName(p.crop_id)}</Badge>}{p.expert_verified ? <Badge tone="green"><ShieldCheck className="h-3 w-3" />Expert verified</Badge> : null}</div>
                <p className="mt-1 font-semibold">{p.title}</p>
                <p className="line-clamp-2 text-sm text-gray-600">{p.body}</p>
                <p className="mt-1 text-xs text-gray-500">{p.author} · {fmtDateTime(p.created_at)} · {p.comments} replies</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Modal open={!!form} onClose={() => setForm(null)} title="New post">
        {form && (
          <form className="space-y-3" onSubmit={async (e) => {
            e.preventDefault();
            try {
              const r = await api.post('/v1/community/posts', { ...form, crop_id: form.crop_id || null });
              toast(r.held ? r.message : 'Posted', r.held ? 'info' : 'ok'); setForm(null);
              if (!r.held) nav(`/community/${r.id}`); else posts.reload();
            } catch (err: any) { toast(err.message, 'error'); }
          }}>
            <Field label="Type">{(id) => <Select id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} options={CATS} />}</Field>
            <Field label="Title" required>{(id) => <Input id={id} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required maxLength={200} />}</Field>
            <Field label="Details" required>{(id) => <Textarea id={id} rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required />}</Field>
            <Field label="Crop">{(id) => <CropSelect id={id} value={form.crop_id} onChange={(v) => setForm({ ...form, crop_id: v })} />}</Field>
            <div className="flex justify-end"><Button type="submit">Post</Button></div>
          </form>
        )}
      </Modal>
    </div>
  );
}

export function PostDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const r = useAsync(() => api.get(`/v1/community/posts/${id}`), [id]);
  const [body, setBody] = useState('');
  if (r.loading) return <Skeleton lines={6} />;
  if (r.error) return <ErrorBox error={r.error} />;
  const p = r.data.post;
  const canModerate = user && ['admin', 'super_admin'].includes(user.role);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Section>
        <div className="flex flex-wrap items-center gap-1"><Badge>{p.category}</Badge>{p.expert_verified ? <Badge tone="green">Expert verified</Badge> : <Badge tone="amber">Not verified advice</Badge>}{p.status !== 'visible' && <Badge tone="red">{p.status}</Badge>}</div>
        <h1 className="mt-2 text-xl font-bold">{p.title}</h1>
        <p className="text-xs text-gray-500">{p.author} · {fmtDateTime(p.created_at)}</p>
        <p className="mt-3 whitespace-pre-wrap text-gray-800">{p.body}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <ReportButton type="post" id={p.id} />
          {user && ['expert', 'admin', 'super_admin'].includes(user.role) && isVerifiedPro(user) && !p.expert_verified && (
            <button className="text-xs text-emerald-700 underline" onClick={async () => { await api.post(`/v1/community/posts/${p.id}/verify`); r.reload(); }}>Mark expert verified</button>
          )}
          {(p.user_id === user?.id || canModerate) && <button className="text-xs text-red-700 underline" onClick={async () => { if (confirm('Delete this post?')) { await api.del(`/v1/community/posts/${p.id}`); nav('/community'); } }}>Delete</button>}
        </div>
      </Section>
      <Section title={`${r.data.comments.length} replies`}>
        <ul className="space-y-3">
          {r.data.comments.map((c: any) => (
            <li key={c.id} className={`rounded-xl p-3 text-sm ${c.is_expert ? 'border border-emerald-200 bg-emerald-50' : 'bg-gray-50'}`}>
              <p className="text-xs font-semibold">{c.author}{c.is_expert ? ' · verified expert' : ''} · {fmtDateTime(c.created_at)} {c.status !== 'visible' && <Badge tone="amber">awaiting moderation</Badge>}</p>
              <p className="mt-1 whitespace-pre-wrap">{c.body}</p>
              <div className="mt-1"><ReportButton type="comment" id={c.id} /></div>
            </li>
          ))}
        </ul>
        <form className="mt-3 space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          try { const res = await api.post(`/v1/community/posts/${p.id}/comments`, { body }); setBody(''); if (res.held) toast('Your reply will appear after moderation', 'info'); r.reload(); }
          catch (err: any) { toast(err.message, 'error'); }
        }}>
          <Textarea aria-label="Reply" value={body} onChange={(e) => setBody(e.target.value)} required placeholder="Write a reply" />
          <div className="flex justify-end"><Button type="submit">Reply</Button></div>
        </form>
      </Section>
    </div>
  );
}

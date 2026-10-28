import { Link } from 'react-router-dom';
import { Bell, Bookmark, Trash2 } from 'lucide-react';
import { api, fmtDateTime } from '../api';
import { Badge, Button, Empty, ErrorBox, PageHeader, Section, Skeleton, useAsync } from '../ui';

const KIND_TONE: Record<string, any> = { weather: 'blue', task: 'gray', pest: 'red', price: 'green', content: 'purple', scheme: 'purple', expert: 'green', system: 'gray' };

export function NotificationsPage() {
  const r = useAsync(() => api.get('/v1/notifications'));
  return (
    <div>
      <PageHeader title="Notifications" icon={<Bell />} subtitle="Manage channels and quiet hours in Settings"
        actions={r.data?.unread > 0 && <Button variant="outline" onClick={async () => { await api.post('/v1/notifications/read-all'); r.reload(); }}>Mark all read</Button>} />
      {r.loading ? <Skeleton lines={6} /> : r.error ? <ErrorBox error={r.error} onRetry={r.reload} /> : r.data.notifications.length === 0 ? <Empty title="No notifications" icon={<Bell className="h-8 w-8" />} /> : (
        <Section>
          <ul className="divide-y">
            {r.data.notifications.map((n: any) => (
              <li key={n.id} className={`flex items-start gap-3 py-3 ${n.read_at ? '' : 'bg-emerald-50/50'}`}>
                {!n.read_at && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-emerald-600" aria-label="unread" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2"><Badge tone={KIND_TONE[n.kind]}>{n.kind}</Badge><span className="text-xs text-gray-500">{fmtDateTime(n.created_at)}</span></div>
                  <p className="mt-1 font-medium">{n.link ? <Link to={n.link} className="hover:underline" onClick={() => api.post(`/v1/notifications/${n.id}/read`)}>{n.title}</Link> : n.title}</p>
                  {n.body && <p className="text-sm text-gray-600">{n.body}</p>}
                </div>
                <div className="flex flex-col gap-1 text-xs">
                  {!n.read_at && <button className="text-emerald-700 underline" onClick={async () => { await api.post(`/v1/notifications/${n.id}/read`); r.reload(); }}>Read</button>}
                  <button aria-label="Delete" className="text-gray-400 hover:text-red-600" onClick={async () => { await api.del(`/v1/notifications/${n.id}`); r.reload(); }}><Trash2 className="h-4 w-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

const LINK: Record<string, (id: string) => string> = {
  content: (id) => `/knowledge/${id}`, diagnosis: (id) => `/crop-doctor/${id}`, product: (id) => `/products/${id}`,
  scheme: () => '/schemes', advisory: () => '/advisory', market: () => '/mandi',
};

export function SavedPage() {
  const r = useAsync(() => api.get('/v1/me/saved').then((x) => x.items));
  return (
    <div>
      <PageHeader title="Saved" icon={<Bookmark />} subtitle="Advisories, articles, schemes and products you saved" />
      {r.loading ? <Skeleton /> : r.error ? <ErrorBox error={r.error} /> : !r.data?.length ? <Empty title="Nothing saved yet">Use the Save button on advisories, articles, schemes and products.</Empty> : (
        <Section>
          <ul className="divide-y">
            {r.data.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between py-2 text-sm">
                <Link className="hover:underline" to={(LINK[s.item_type] || (() => '/'))(s.item_id)}>{s.title}</Link>
                <span className="flex items-center gap-2"><Badge>{s.item_type}</Badge>
                  <button aria-label="Remove" className="text-gray-400 hover:text-red-600" onClick={async () => { await api.del(`/v1/me/saved/${s.item_type}/${encodeURIComponent(s.item_id)}`); r.reload(); }}><Trash2 className="h-4 w-4" /></button></span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

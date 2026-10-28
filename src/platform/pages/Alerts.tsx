import { useState } from 'react';
import { TriangleAlert, Trash2 } from 'lucide-react';
import { api, fmtDateTime } from '../api';
import { Badge, Button, Empty, ErrorBox, INDIAN_STATES, Input, PageHeader, Section, Select, Skeleton, SpeakButton, severityTone, useAsync, useToast } from '../ui';
import { CropSelect, useCropName } from '../shared';

export function AlertsPage() {
  const toast = useToast();
  const cropName = useCropName();
  const alerts = useAsync(() => api.get('/v1/alerts').then((r) => r.alerts));
  const subs = useAsync(() => api.get('/v1/alerts/subscriptions').then((r) => r.subscriptions));
  const [sub, setSub] = useState({ state: '', district: '', crop_id: '' });

  return (
    <div className="space-y-4">
      <PageHeader title="Pest, Disease & Weather Alerts" icon={<TriangleAlert />} subtitle="Alerts for your farms' areas, from verified sources and your farm's forecast" />
      {alerts.loading ? <Skeleton lines={6} /> : alerts.error ? <ErrorBox error={alerts.error} onRetry={alerts.reload} /> : alerts.data!.length === 0 ? (
        <Empty title="No active alerts" icon={<TriangleAlert className="h-8 w-8" />}>You will see alerts here when verified sources report problems in your area or when the forecast affects your crops.</Empty>
      ) : (
        <div className="space-y-3">
          {alerts.data!.map((a: any) => (
            <Section key={a.id} className={a.is_read ? 'opacity-80' : 'border-l-4 border-l-amber-500'}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={severityTone(a.severity)}>{a.severity}</Badge>
                <Badge>{a.category.replace('_', ' ')}</Badge>
                {a.verified ? <Badge tone="green">verified source</Badge> : <Badge tone="gray">forecast-derived</Badge>}
                {a.crop_id && <Badge tone="purple">{cropName(a.crop_id)}</Badge>}
                {!a.is_read && <Badge tone="red">new</Badge>}
              </div>
              <h2 className="mt-2 font-semibold">{a.title}</h2>
              <p className="mt-1 text-sm text-gray-700">{a.body}</p>
              {a.precautions && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm text-amber-900"><b>Precautions:</b> {a.precautions}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span>Area: {[a.district, a.state].filter(Boolean).join(', ') || 'All'}</span>
                <span>Valid until {fmtDateTime(a.expires_at)}</span>
                <span>Source: {a.source_url ? <a className="underline" href={a.source_url} target="_blank" rel="noreferrer">{a.source}</a> : a.source}</span>
                {a.affected_farms?.length > 0 && <span>Your farms: {a.affected_farms.map((f: any) => f.name).join(', ')}</span>}
                <SpeakButton text={`${a.title}. ${a.body}. ${a.precautions || ''}`} />
                {!a.is_read && <button className="text-emerald-700 underline" onClick={async () => { await api.post(`/v1/alerts/${a.id}/read`); alerts.reload(); }}>Mark read</button>}
              </div>
            </Section>
          ))}
        </div>
      )}

      <Section title="Alert subscriptions" description="Get alerts for other areas or crops besides your farms (e.g. where you buy inputs or sell produce).">
        <form className="grid gap-2 sm:grid-cols-4" onSubmit={async (e) => {
          e.preventDefault();
          try { await api.post('/v1/alerts/subscriptions', { state: sub.state || null, district: sub.district || null, crop_id: sub.crop_id || null }); toast('Subscribed'); subs.reload(); alerts.reload(); }
          catch (err: any) { toast(err.message, 'error'); }
        }}>
          <Select aria-label="State" value={sub.state} onChange={(e) => setSub({ ...sub, state: e.target.value })} options={INDIAN_STATES} placeholder="Any state" />
          <Input aria-label="District" value={sub.district} onChange={(e) => setSub({ ...sub, district: e.target.value })} placeholder="District (optional)" />
          <CropSelect value={sub.crop_id} onChange={(v) => setSub({ ...sub, crop_id: v })} />
          <Button type="submit" disabled={!sub.state && !sub.crop_id}>Subscribe</Button>
        </form>
        <ul className="mt-3 divide-y text-sm">
          {(subs.data || []).map((s: any) => (
            <li key={s.id} className="flex items-center justify-between py-2">
              <span>{[s.district, s.state].filter(Boolean).join(', ') || 'All areas'}{s.crop_id && ` · ${cropName(s.crop_id)}`}</span>
              <button aria-label="Remove subscription" className="p-1 text-gray-400 hover:text-red-600" onClick={async () => { await api.del(`/v1/alerts/subscriptions/${s.id}`); subs.reload(); }}><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

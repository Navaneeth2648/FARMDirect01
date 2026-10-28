import { useState, type FormEvent } from 'react';
import { Flag, Share2, Star, TrendingUp, Trash2 } from 'lucide-react';
import { api, fmtDate, fmtDateTime, inr, qs } from '../api';
import { useAuth } from '../auth';
import {
  Badge, Button, Empty, ErrorBox, Field, Input, INDIAN_STATES, LineChart, Modal, PageHeader, Section, Select, SetupNotice, Skeleton, SourceNote, Spinner,
  Tabs, Textarea, useAsync, useToast,
} from '../ui';
import { CropChips, useCrops } from '../shared';

export function MandiPage() {
  const { user } = useAuth();
  const toast = useToast();
  const crops = useCrops();
  const status = useAsync(() => api.get('/v1/market/status'));
  const watch = useAsync(() => api.get('/v1/market/watchlist').then((r) => r.items));
  const [tab, setTab] = useState<'search' | 'watch' | 'compare'>('search');
  const [f, setF] = useState({ commodity: '', state: user?.state || '', district: '', market: '', variety: '', from: '', to: '', min_price: '', max_price: '' });
  const [query, setQuery] = useState<typeof f | null>(null);
  const [offset, setOffset] = useState(0);
  const prices = useAsync(() => (query ? api.get(`/v1/market/prices${qs({ ...query, offset, limit: 50 })}`) : Promise.resolve(null)), [query, offset]);
  const history = useAsync(() => (query?.commodity ? api.get(`/v1/market/history${qs({ commodity: query.commodity, state: query.state, days: 90 })}`) : Promise.resolve(null)), [query]);
  const [feedback, setFeedback] = useState<any>(null);
  const [fbText, setFbText] = useState('');
  const [cmp, setCmp] = useState({ commodity: '', markets: '' });
  const [cmpRes, setCmpRes] = useState<any[] | null>(null);

  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });
  const search = (e: FormEvent) => { e.preventDefault(); setOffset(0); setQuery({ ...f }); };
  const commodityOptions = crops.filter((c) => c.agmarknet_name).map((c) => ({ value: c.agmarknet_name!, label: `${c.name} (${c.agmarknet_name})` }));

  const share = async (p: any) => {
    const text = `${p.commodity}${p.variety ? ` (${p.variety})` : ''} at ${p.market}, ${p.district || ''} ${p.state}: modal ₹${p.modal_price}/quintal (min ₹${p.min_price}, max ₹${p.max_price}) on ${p.arrival_date}. Source: Agmarknet via FARMDirect.`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast('Price copied to clipboard'); }
    } catch { /* user cancelled */ }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Mandi Prices" icon={<TrendingUp />} subtitle="Official Agmarknet arrivals and prices (INR per quintal). Prices are as of the arrival date, not live." />
      {status.data && !status.data.configured && <SetupNotice service="Agmarknet mandi prices" setup={status.data.setup} />}
      {status.data?.configured && <SourceNote source={status.data.source} updated={status.data.lastFetch} note={status.data.latestArrivalDate ? `Latest arrival date in our records: ${fmtDate(status.data.latestArrivalDate)}.` : undefined} />}

      <Tabs value={tab} onChange={setTab} tabs={[{ id: 'search', label: 'Search' }, { id: 'watch', label: `Watchlist (${watch.data?.length ?? 0})` }, { id: 'compare', label: 'Compare markets' }]} />

      {tab === 'search' && (
        <>
          <CropChips label="Choose a crop" value={f.commodity}
            items={crops.filter((c) => c.agmarknet_name).map((c) => ({ id: c.id, value: c.agmarknet_name!, name: c.name.split(' (')[0] }))}
            onChange={(v) => { const next = { ...f, commodity: v }; setF(next); setOffset(0); setQuery(next); }} />
          <Section>
            <form onSubmit={search} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Crop / commodity">{(id) => <Select id={id} value={f.commodity} onChange={set('commodity')} options={commodityOptions} placeholder="Any" />}</Field>
              <Field label="State">{(id) => <Select id={id} value={f.state} onChange={set('state')} options={INDIAN_STATES} placeholder="Any" />}</Field>
              <Field label="District">{(id) => <Input id={id} value={f.district} onChange={set('district')} />}</Field>
              <Field label="Mandi">{(id) => <Input id={id} value={f.market} onChange={set('market')} />}</Field>
              <Field label="Variety">{(id) => <Input id={id} value={f.variety} onChange={set('variety')} />}</Field>
              <Field label="From date">{(id) => <Input id={id} type="date" value={f.from} onChange={set('from')} />}</Field>
              <Field label="Min modal price (₹/q)">{(id) => <Input id={id} type="number" min="0" value={f.min_price} onChange={set('min_price')} />}</Field>
              <Field label="Max modal price (₹/q)">{(id) => <Input id={id} type="number" min="0" value={f.max_price} onChange={set('max_price')} />}</Field>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-4">
                <Button type="submit">Search</Button>
                {f.commodity && <Button type="button" variant="outline" onClick={async () => {
                  try { await api.post('/v1/market/watchlist', { commodity: f.commodity, state: f.state || null, district: f.district || null, market: f.market || null, alert_change_pct: 5 }); toast('Added to watchlist (alerts on 5% change)'); watch.reload(); }
                  catch (e: any) { toast(e.message, 'error'); }
                }}><Star className="mr-1 h-4 w-4" />Watch</Button>}
              </div>
            </form>
          </Section>

          {query && (prices.loading ? <Skeleton lines={6} /> : prices.error ? <ErrorBox error={prices.error} onRetry={prices.reload} /> : prices.data && (
            <>
              {prices.data.refreshError && prices.data.refreshError !== 'not_configured' && <p className="text-sm text-amber-700">{prices.data.refreshError}</p>}
              {history.data?.series?.length > 1 && (
                <Section title={`${query.commodity} – average modal price, last 90 days`} description={history.data.trend}>
                  <LineChart unit="" series={[{ name: 'Modal', color: '#168a39', points: history.data.series.map((s: any) => ({ x: s.date.slice(5), y: s.modal })) }]} />
                  <SourceNote note={history.data.note} />
                </Section>
              )}
              <Section title={`${prices.data.total} records`} description={prices.data.note}>
                {prices.data.prices.length === 0 ? <Empty title="No prices found">{prices.data.configured ? 'Try a wider search (fewer filters).' : 'Prices appear here once the Agmarknet API key is configured.'}</Empty> : (
                  <>
                  <ul className="-mx-4 divide-y divide-gray-100 sm:hidden">
                    {prices.data.prices.map((p: any) => (
                      <li key={p.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="truncate font-semibold uppercase tracking-wide text-gray-900">{p.market}</p><p className="text-xs text-gray-500">{p.district}, {p.state}</p></div>
                          <div className="text-right"><p className="font-bold text-gray-900">{inr(p.min_price)} – {inr(p.max_price)}</p><p className="text-xs text-gray-500">{fmtDate(p.arrival_date)} · per quintal</p></div>
                        </div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="text-gray-600">{p.commodity}{p.variety ? ` · ${p.variety}` : ''} · modal <b>{inr(p.modal_price)}</b></span>
                          <span className="flex gap-1">
                            <button aria-label="Share" className="p-1 text-gray-500" onClick={() => share(p)}><Share2 className="h-4 w-4" /></button>
                            <button aria-label="Report incorrect data" className="p-1 text-gray-500" onClick={() => { setFeedback(p); setFbText(''); }}><Flag className="h-4 w-4" /></button>
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <div className="hidden overflow-x-auto sm:block">
                    <table className="min-w-full text-sm">
                      <thead className="text-left text-xs text-gray-500"><tr><th className="p-2">Mandi</th><th className="p-2">Commodity</th><th className="p-2">Date</th><th className="p-2 text-right">Min</th><th className="p-2 text-right">Max</th><th className="p-2 text-right">Modal</th><th className="p-2" /></tr></thead>
                      <tbody>
                        {prices.data.prices.map((p: any) => (
                          <tr key={p.id} className="border-t">
                            <td className="p-2"><p className="font-medium">{p.market}</p><p className="text-xs text-gray-500">{p.district}, {p.state}</p></td>
                            <td className="p-2">{p.commodity}<p className="text-xs text-gray-500">{[p.variety, p.grade].filter(Boolean).join(' · ')}</p></td>
                            <td className="p-2 whitespace-nowrap">{fmtDate(p.arrival_date)}</td>
                            <td className="p-2 text-right">{inr(p.min_price)}</td>
                            <td className="p-2 text-right">{inr(p.max_price)}</td>
                            <td className="p-2 text-right font-semibold">{inr(p.modal_price)}</td>
                            <td className="p-2 whitespace-nowrap">
                              <button aria-label="Share" className="p-1 text-gray-500 hover:text-emerald-700" onClick={() => share(p)}><Share2 className="h-4 w-4" /></button>
                              <button aria-label="Report incorrect data" className="p-1 text-gray-500 hover:text-red-700" onClick={() => { setFeedback(p); setFbText(''); }}><Flag className="h-4 w-4" /></button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  </>
                )}
                <div className="mt-3 flex justify-between text-sm">
                  <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={offset + 50 >= prices.data.total} onClick={() => setOffset(offset + 50)}>Next</Button>
                </div>
                <SourceNote source="Agmarknet (data.gov.in)" note={`Unit: ${prices.data.unit}.`} />
              </Section>
            </>
          ))}
        </>
      )}

      {tab === 'watch' && (
        <Section title="Watchlist" description="You get a notification when the latest modal price moves by your threshold.">
          {watch.loading ? <Skeleton /> : !watch.data?.length ? <Empty title="Nothing on your watchlist">Search for a crop and press Watch.</Empty> : (
            <ul className="divide-y">
              {watch.data.map((w: any) => (
                <li key={w.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div>
                    <p className="font-medium">{w.commodity}</p>
                    <p className="text-xs text-gray-500">{[w.market, w.district, w.state].filter(Boolean).join(', ') || 'All markets'} · alert on {w.alert_change_pct ?? '–'}% change</p>
                  </div>
                  <div className="text-right">
                    {w.latest ? <><p className="font-semibold">{inr(w.latest.modal_price)}/q</p><p className="text-xs text-gray-500">{w.latest.market} · {fmtDate(w.latest.arrival_date)}</p></> : <Badge>No data yet</Badge>}
                  </div>
                  <button aria-label="Remove" className="p-1 text-gray-400 hover:text-red-600" onClick={async () => { await api.del(`/v1/market/watchlist/${w.id}`); watch.reload(); }}><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      {tab === 'compare' && (
        <Section title="Compare markets" description="Latest stored price per market">
          <form className="grid gap-3 sm:grid-cols-3" onSubmit={async (e) => {
            e.preventDefault();
            try { setCmpRes((await api.get(`/v1/market/compare${qs(cmp)}`)).comparison); } catch (err: any) { toast(err.message, 'error'); }
          }}>
            <Select aria-label="Commodity" value={cmp.commodity} onChange={(e) => setCmp({ ...cmp, commodity: e.target.value })} options={commodityOptions} placeholder="Commodity" required />
            <Input aria-label="Markets" value={cmp.markets} onChange={(e) => setCmp({ ...cmp, markets: e.target.value })} placeholder="Market names, comma separated" required />
            <Button type="submit">Compare</Button>
          </form>
          {cmpRes && (
            <ul className="mt-4 divide-y text-sm">
              {cmpRes.map((r: any) => (
                <li key={r.market} className="flex justify-between py-2">
                  <span>{r.market}</span>
                  {r.missing ? <span className="text-gray-500">No stored data</span> : <span><b>{inr(r.modal_price)}</b>/q <span className="text-xs text-gray-500">{fmtDate(r.arrival_date)} · fetched {fmtDateTime(r.fetched_at)}</span></span>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      )}

      <Modal open={!!feedback} onClose={() => setFeedback(null)} title="Report incorrect price">
        <form className="space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          try { await api.post('/v1/market/feedback', { price_id: feedback.id, message: fbText }); toast('Thanks – our team will review it'); setFeedback(null); }
          catch (err: any) { toast(err.message, 'error'); }
        }}>
          <p className="text-sm text-gray-600">{feedback?.commodity} at {feedback?.market} on {fmtDate(feedback?.arrival_date)}</p>
          <Textarea value={fbText} onChange={(e) => setFbText(e.target.value)} placeholder="What looks wrong?" required minLength={5} aria-label="Details" />
          <div className="flex justify-end"><Button type="submit">{prices.loading ? <Spinner /> : 'Send'}</Button></div>
        </form>
      </Modal>
    </div>
  );
}

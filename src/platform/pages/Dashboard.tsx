import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Bot, CalendarDays, Camera, ChevronDown, CloudRain, CloudSun, Droplets, IndianRupee, LifeBuoy, MapPin, Plus, QrCode, Search, Sprout, Stethoscope, TrendingUp, TriangleAlert, Truck, Warehouse, Wind } from 'lucide-react';
import { api, fmtDate, inr } from '../api';
import { useAuth } from '../auth';
import { Badge, Empty, ErrorBox, Grid, Notice, Section, Skeleton, SourceNote, severityTone, useAsync } from '../ui';
import { useCropName } from '../shared';
import { weatherIcon } from './Weather';

type Service = { to: string; label: string; icon: any; tint: string };

const TINTS = ['bg-emerald-50 text-emerald-700', 'bg-sky-50 text-sky-700', 'bg-amber-50 text-amber-700', 'bg-violet-50 text-violet-800'];

/** Square service tiles with a soft tinted icon, four per row on phones, with "View more". */
function ServiceGrid({ items, label }: { items: Service[]; label: string }) {
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, 8);
  return (
    <section className="rounded-xl border border-gray-100 bg-white p-3 sm:p-4" aria-label={label}>
      <nav className="grid grid-cols-4 gap-x-2 gap-y-3 sm:grid-cols-6 lg:grid-cols-8">
        {shown.map((a) => (
          <Link key={a.to + a.label} to={a.to} className="group flex flex-col items-center gap-1.5 text-center text-xs font-medium leading-tight text-gray-800">
            <span className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-transform group-hover:scale-105 ${a.tint}`}><a.icon className="h-7 w-7" aria-hidden /></span>
            {a.label}
          </Link>
        ))}
      </nav>
      {items.length > 8 && (
        <button type="button" onClick={() => setAll(!all)} className="mx-auto mt-3 flex items-center gap-1 text-sm font-semibold text-emerald-700" aria-expanded={all}>
          {all ? 'View less' : 'View more'}<ChevronDown className={`h-4 w-4 transition-transform ${all ? 'rotate-180' : ''}`} aria-hidden />
        </button>
      )}
    </section>
  );
}

/** Marketplace items that need the farmer's attention, shown first. */
function FarmerTradePanel() {
  const { t, user } = useAuth();
  const threads = useAsync(() => api.get('/v1/offers/threads').then((r) => r.threads));
  const orders = useAsync(() => api.get('/v1/orders').then((r) => r.orders));
  const bookings = useAsync(() => api.get('/v1/storage/bookings').then((r) => r.bookings));
  const payments = useAsync(() => api.get('/v1/payments').then((r) => r.payments));
  const soon = new Date(Date.now() + 3 * 86400_000).toISOString().slice(0, 10);
  const awaiting = (threads.data || []).filter((x: any) => x.awaiting_me);
  const confirmed = (orders.data || []).filter((o: any) => ['pending_confirmation', 'confirmed', 'pickup_scheduled', 'in_transit', 'delivered'].includes(o.status));
  const ending = (bookings.data || []).filter((b: any) => ['in_storage', 'confirmed', 'check_in_scheduled'].includes(b.status) && b.end_date <= soon);
  const toReceive = (payments.data || []).filter((p: any) => p.payee_id === user?.id && ['required', 'pending'].includes(p.status));
  const card = (title: string, items: any[], render: (x: any) => React.ReactNode, link: string, tone: string) => items.length > 0 && (
    <Link to={link} className={`block rounded-xl border p-4 ${tone}`}>
      <p className="font-semibold">{title} ({items.length})</p>
      <ul className="mt-1 space-y-0.5 text-sm">{items.slice(0, 3).map((x, i) => <li key={i}>{render(x)}</li>)}</ul>
    </Link>
  );
  return (
    <>
      {awaiting.length + confirmed.length + ending.length + toReceive.length > 0 && <div className="grid gap-3 md:grid-cols-2">
        {card('Offers waiting for your reply', awaiting, (x) => `${x.commodity}: ${x.quantity} ${x.unit} @ ${inr(x.price_per_unit)}`, '/trade', 'border-sky-200 bg-sky-50')}
        {card('Orders in progress', confirmed, (o) => `${o.order_no} · ${o.commodity} · ${o.status.replace(/_/g, ' ')}`, '/trade?tab=orders', 'border-emerald-200 bg-emerald-50')}
        {card('Storage ending soon', ending, (b) => `${b.booking_ref} ends ${fmtDate(b.end_date)}`, '/storage', 'border-amber-200 bg-amber-50')}
        {card('Payments to receive', toReceive, (p) => `${p.order_no || p.booking_ref}: ${inr(p.amount)} – ${p.status === 'pending' ? 'buyer says paid, please confirm' : 'due'}`, '/trade?tab=payments', 'border-violet-300 bg-violet-50')}
      </div>}
    </>
  );
}

export function DashboardPage() {
  const { t, user } = useAuth();
  const { data: d, error, loading, reload } = useAsync(() => api.get('/v1/dashboard'));
  const cropName = useCropName();

  if (loading) return <div className="space-y-4"><Skeleton lines={2} /><Grid><Skeleton lines={5} /><Skeleton lines={5} /><Skeleton lines={5} /></Grid></div>;
  if (error) return <ErrorBox error={error} onRetry={reload} />;

  const seller = user?.role === 'farmer' || user?.role === 'fpo_manager';
  const services: Service[] = [
    ...(seller ? [
      { to: '/sell/new', label: t('sellMyCrop'), icon: Sprout },
      { to: '/market?tab=demand', label: t('findBuyer'), icon: Search },
      { to: '/storage', label: t('bookStorage'), icon: Warehouse },
    ] : []),
    { to: '/crop-doctor', label: t('cropDoctor'), icon: Stethoscope },
    { to: '/mandi', label: t('mandi'), icon: TrendingUp },
    { to: '/verify', label: t('verify'), icon: QrCode },
    { to: '/weather', label: t('weather'), icon: CloudSun },
    { to: '/farm?add=crop', label: t('addCrop'), icon: Plus },
    ...(seller ? [
      { to: '/trade?tab=orders', label: t('trackProduce'), icon: Truck },
      { to: '/trade?tab=payments', label: t('paymentStatus'), icon: IndianRupee },
    ] : []),
    { to: '/assistant', label: t('assistant'), icon: Bot },
    { to: '/experts', label: t('getHelp'), icon: LifeBuoy },
  ].map((x, i) => ({ ...x, tint: TINTS[i % TINTS.length] }));
  const w = d.weather;
  const warnings = (w?.recommendations || []).filter((r: any) => r.severity === 'warning');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Namaskar, {user?.full_name?.split(' ')[0]} 🙏</h1>
        <p className="text-sm text-gray-600">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      </div>

      {w && !w.error && (
        <Link to="/weather" className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-sm font-semibold text-gray-900"><MapPin className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />Today, {w.location}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-600"><CloudRain className="h-3.5 w-3.5" aria-hidden />Rain {w.daily.precipitation_sum?.[0] ?? 0} mm · {w.daily.precipitation_probability_max[0] ?? '–'}% chance</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{Math.round(w.current.temperature_2m)}°</p>
          <div className="text-sky-600">{weatherIcon(w.current.weather_code, 'h-8 w-8')}</div>
        </Link>
      )}

      {(!user?.village || !user?.district) && (
        <Link to="/settings" className="flex items-center gap-3 rounded-xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-4 py-4">
          <div className="flex-1"><p className="font-semibold text-gray-900">Complete your profile</p><p className="text-xs text-gray-600">Unlock local weather, prices and nearby buyers</p></div>
          <span className="rounded-full bg-emerald-700 p-1.5 text-white"><ArrowRight className="h-5 w-5" aria-hidden /></span>
        </Link>
      )}

      {user?.role !== 'farmer' && user?.verification_status === 'pending' && (
        <Notice tone="warn">Your professional account is awaiting verification by an administrator. Farmer features are available meanwhile.</Notice>
      )}

      {warnings.map((r: any) => (
        <Notice key={r.id} tone="warn" title={r.title}>{r.detail}</Notice>
      ))}

      <ServiceGrid items={services} label={t('quickActions')} />

      {seller && <FarmerTradePanel />}

      <div className="flex items-center gap-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <div className="flex-1">
          <p className="text-lg font-bold text-gray-900">{t('cropDoctor')}</p>
          <p className="text-sm text-gray-700">Send a photo of a sick plant and get likely causes and next steps.</p>
          <Link to="/crop-doctor" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><Camera className="h-4 w-4" aria-hidden />Take a picture</Link>
        </div>
        <div className="hidden h-20 w-20 shrink-0 items-center justify-center rounded-full bg-white text-emerald-600 sm:flex"><Stethoscope className="h-10 w-10" aria-hidden /></div>
      </div>

      <Grid>
        <Section title="Weather" actions={<Link to="/weather" className="text-sm font-semibold text-emerald-700">Details</Link>}>
          {!w ? (
            <Empty title="No farm location yet">Add a location to your farm to see local weather. <div className="mt-2"><Link className="text-emerald-700 underline" to="/farm">Go to My Farm</Link></div></Empty>
          ) : w.error ? <ErrorBox error={w.error} /> : (
            <>
              <div className="flex items-center gap-4">
                <div className="text-emerald-700">{weatherIcon(w.current.weather_code, 'h-12 w-12')}</div>
                <div>
                  <p className="text-3xl font-bold">{Math.round(w.current.temperature_2m)}°C</p>
                  <p className="text-sm text-gray-600">{w.location}</p>
                </div>
                <div className="ml-auto space-y-1 text-sm text-gray-700">
                  <p className="flex items-center gap-1"><Droplets className="h-4 w-4" aria-hidden />{w.current.relative_humidity_2m}% humidity</p>
                  <p className="flex items-center gap-1"><Wind className="h-4 w-4" aria-hidden />{Math.round(w.current.wind_speed_10m)} km/h</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-5 gap-1 text-center text-xs">
                {w.daily.time.slice(0, 5).map((day: string, i: number) => (
                  <div key={day} className="rounded-lg bg-gray-50 p-1.5">
                    <p className="font-medium">{new Date(day).toLocaleDateString('en-IN', { weekday: 'short' })}</p>
                    <p>{Math.round(w.daily.temperature_2m_max[i])}°/{Math.round(w.daily.temperature_2m_min[i])}°</p>
                    <p className="text-sky-700">{w.daily.precipitation_probability_max[i] ?? '–'}%</p>
                  </div>
                ))}
              </div>
              <SourceNote source={w.provider} updated={w.fetchedAt} stale={w.stale} />
            </>
          )}
        </Section>

        <Section title="Active crops" actions={<Link to="/farm" className="text-sm font-semibold text-emerald-700">Manage</Link>}>
          {d.cycles.length === 0 ? (
            <Empty title="No active crops" action={<Link to="/farm?add=crop" className="text-emerald-700 underline">{t('addCrop')}</Link>}>Add a crop to get stage-wise advice and reminders.</Empty>
          ) : (
            <ul className="space-y-3">
              {d.cycles.map((c: any) => (
                <li key={c.id}>
                  <div className="flex justify-between text-sm">
                    <span className="font-semibold">{cropName(c.crop_id, c.crop_name)} <span className="font-normal text-gray-500">· {c.farm_name}</span></span>
                    <span className="text-gray-600">Day {c.current_day}</span>
                  </div>
                  <p className="text-xs text-gray-600">{c.stage_status === 'not_started' ? 'Not sown yet' : c.stage?.name}{c.expected_harvest_date && ` · harvest ~${fmtDate(c.expected_harvest_date)}`}</p>
                  {c.progress_pct != null && <div className="mt-1 h-1.5 rounded bg-gray-100"><div className="h-1.5 rounded bg-emerald-600" style={{ width: `${c.progress_pct}%` }} /></div>}
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="This week's tasks" actions={<Link to="/calendar" className="text-sm font-semibold text-emerald-700">Calendar</Link>}>
          {d.tasks.length === 0 ? <Empty title="Nothing due this week" icon={<CalendarDays />} /> : (
            <ul className="divide-y text-sm">
              {d.tasks.map((t: any) => (
                <li key={t.id} className="flex items-start justify-between gap-2 py-2">
                  <span>{t.title}</span>
                  <Badge tone={t.overdue ? 'red' : 'gray'}>{t.overdue ? 'Overdue' : fmtDate(t.due_date)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Farm recommendations" description="Based on your crops' stages and the forecast">
          {!w || w.error ? <p className="text-sm text-gray-500">Available once weather is available for your farm.</p>
            : w.recommendations.length === 0 ? <p className="text-sm text-gray-600">No weather-related actions needed right now.</p> : (
            <ul className="space-y-2">
              {w.recommendations.map((r: any) => (
                <li key={r.id} className="rounded-lg border border-gray-100 p-2">
                  <div className="flex items-center gap-2"><Badge tone={severityTone(r.severity)}>{r.type}</Badge><span className="text-sm font-medium">{r.title}</span></div>
                  <p className="mt-1 text-xs text-gray-600">{r.detail}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Mandi prices" actions={<Link to="/mandi" className="text-sm font-semibold text-emerald-700">All prices</Link>}>
          {d.prices.length === 0 ? <Empty title="No crops to track yet">Add crops or a watchlist to see nearby prices.</Empty> : (
            <ul className="divide-y text-sm">
              {d.prices.map((p: any) => (
                <li key={p.commodity} className="flex justify-between py-2">
                  <span>{p.commodity}{p.market && <span className="text-xs text-gray-500"> · {p.market}</span>}</span>
                  {p.missing ? <span className="text-xs text-gray-500">No data</span> : <span className="font-semibold">{inr(p.modal_price)}/q <span className="text-xs font-normal text-gray-500">{fmtDate(p.arrival_date)}</span></span>}
                </li>
              ))}
            </ul>
          )}
          <SourceNote source="Agmarknet (data.gov.in)" note="Prices are as of the arrival date shown, not live." />
        </Section>

        <Section title="Alerts" actions={<Link to="/alerts" className="text-sm font-semibold text-emerald-700">All alerts</Link>}>
          {d.alerts.length === 0 ? <Empty title="No active alerts for your area" icon={<TriangleAlert />} /> : (
            <ul className="space-y-2">
              {d.alerts.map((a: any) => (
                <li key={a.id} className="text-sm"><Badge tone={severityTone(a.severity)}>{a.severity}</Badge> <span className="font-medium">{a.title}</span><p className="text-xs text-gray-500">{a.source}</p></li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Government schemes" actions={<Link to="/schemes" className="text-sm font-semibold text-emerald-700">View all</Link>}>
          <ul className="space-y-2 text-sm">
            {d.schemes.map((s: any) => <li key={s.id}><a className="text-emerald-800 underline" href={s.official_url} target="_blank" rel="noreferrer">{s.name}</a> <Badge>{s.level}</Badge></li>)}
          </ul>
        </Section>

        <Section title="News & events" actions={<Link to="/news" className="text-sm font-semibold text-emerald-700">More</Link>}>
          {d.news.length === 0 ? <p className="text-sm text-gray-500">No published news yet.</p> : (
            <ul className="space-y-2 text-sm">{d.news.map((n: any) => <li key={n.id}><Link className="underline" to={`/knowledge/${n.id}`}>{n.title}</Link></li>)}</ul>
          )}
        </Section>

        {(d.saved.length > 0 || d.recent.length > 0) && (
          <Section title="Saved & recently viewed">
            <ul className="space-y-1 text-sm">
              {[...d.saved, ...d.recent].slice(0, 6).map((s: any, i: number) => <li key={i} className="truncate">• {s.title} <span className="text-xs text-gray-400">{s.item_type}</span></li>)}
            </ul>
          </Section>
        )}
      </Grid>
    </div>
  );
}

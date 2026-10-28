import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Lightbulb, Monitor, Search, Users } from 'lucide-react';
import { TUTORIALS, type Audience } from '../learn/tutorials';
import { PublicFooter, PublicHeader } from './Landing';
import { VoiceHint } from '../trade-ui';

const AUD_LABEL: Record<Audience, string> = { farmer: 'Farmers', buyer: 'Buyers and businesses', everyone: 'Everyone' };

export function LearnIndexPage() {
  const [aud, setAud] = useState<'all' | Audience>('all');
  const [q, setQ] = useState('');
  const list = TUTORIALS.filter((t) => (aud === 'all' || t.audience === aud || t.audience === 'everyone') && (!q || `${t.title} ${t.summary}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-emerald-700">Learning Centre</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight">How to use FARMDirect</h1>
        <p className="mt-3 max-w-2xl text-lg text-gray-600">Step-by-step guides. Each one tells you who it is for, what you need, the exact buttons to press, and the common mistakes to avoid.</p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <div role="tablist" className="flex flex-wrap gap-2">
            {(['all', 'farmer', 'buyer'] as const).map((a) => (
              <button key={a} role="tab" aria-selected={aud === a} onClick={() => setAud(a)} className={`rounded-full px-5 py-2.5 text-base font-semibold ${aud === a ? 'bg-emerald-700 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`}>
                {a === 'all' ? 'All guides' : a === 'farmer' ? 'For farmers' : 'For buyers'}
              </button>
            ))}
          </div>
          <label className="relative ml-auto w-full max-w-sm">
            <span className="sr-only">Search guides</span>
            <Search className="pointer-events-none absolute left-3 top-3.5 h-5 w-5 text-gray-400" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search guides" className="w-full rounded-xl border border-gray-300 py-3 pl-10 pr-3 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30" />
          </label>
        </div>
        <ol className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {list.map((t) => (
            <li key={t.slug}>
              <Link to={`/learn/${t.slug}`} className="flex h-full flex-col rounded-2xl border border-gray-200 p-6 hover:border-emerald-400 hover:shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Guide {TUTORIALS.indexOf(t) + 1} · {AUD_LABEL[t.audience]}</p>
                <h2 className="mt-2 text-xl font-semibold">{t.title}</h2>
                <p className="mt-2 flex-1 text-[15px] text-gray-600">{t.summary}</p>
                <p className="mt-4 flex items-center justify-between text-sm text-gray-500"><span>{t.steps.length} steps</span>{t.needs && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">Needs server setup</span>}</p>
              </Link>
            </li>
          ))}
        </ol>
        {!list.length && <p className="mt-8 text-gray-600">No guides match your search.</p>}
      </main>
      <PublicFooter />
    </div>
  );
}

export function LearnGuidePage() {
  const { slug } = useParams();
  const i = TUTORIALS.findIndex((t) => t.slug === slug);
  const t = TUTORIALS[i];
  if (!t) {
    return (
      <div className="min-h-screen bg-white"><PublicHeader /><main className="mx-auto max-w-3xl px-4 py-16"><h1 className="text-2xl font-bold">Guide not found</h1><Link to="/learn" className="mt-4 inline-block text-emerald-700 underline">See all guides</Link></main></div>
    );
  }
  const prev = TUTORIALS[i - 1];
  const next = TUTORIALS[i + 1];
  const spoken = `${t.title}. ${t.steps.map((s, n) => `Step ${n + 1}. ${s.text}`).join(' ')}`;
  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <Link to="/learn" className="inline-flex items-center gap-1 text-base font-medium text-emerald-800 hover:underline"><ArrowLeft className="h-4 w-4" aria-hidden />All guides</Link>
        <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-emerald-700">Guide {i + 1} of {TUTORIALS.length}</p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3"><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t.title}</h1><VoiceHint text={spoken} /></div>
        <p className="mt-3 text-lg text-gray-700">{t.summary}</p>
        {t.needs && <p className="mt-4 flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-base text-amber-900"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />{t.needs}</p>}

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl bg-gray-50 p-5"><p className="flex items-center gap-2 font-semibold"><Users className="h-5 w-5 text-emerald-700" aria-hidden />Who this is for</p><p className="mt-2 text-base text-gray-700">{AUD_LABEL[t.audience]}</p></div>
          <div className="rounded-2xl bg-gray-50 p-5"><p className="flex items-center gap-2 font-semibold"><ClipboardList className="h-5 w-5 text-emerald-700" aria-hidden />Before you start</p><ul className="mt-2 list-disc space-y-1 pl-5 text-base text-gray-700">{t.before.map((b) => <li key={b}>{b}</li>)}</ul></div>
        </div>

        <h2 className="mt-10 text-2xl font-bold">Steps</h2>
        <ol className="mt-4 space-y-4">
          {t.steps.map((s, n) => (
            <li key={n} className="flex gap-4 rounded-2xl border border-gray-200 p-5">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-emerald-700 text-lg font-bold text-white">{n + 1}</span>
              <div>
                <p className="text-lg leading-relaxed text-gray-900">{s.text}</p>
                {s.screen && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-sm text-emerald-800"><Monitor className="h-4 w-4" aria-hidden />Screen: {s.screen}</p>}
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5"><p className="flex items-center gap-2 font-semibold text-emerald-900"><Lightbulb className="h-5 w-5" aria-hidden />Tips</p><ul className="mt-2 space-y-2 text-base text-gray-800">{t.tips.map((x) => <li key={x} className="flex gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />{x}</li>)}</ul></div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5"><p className="flex items-center gap-2 font-semibold text-amber-900"><AlertTriangle className="h-5 w-5" aria-hidden />Common mistakes</p><ul className="mt-2 space-y-2 text-base text-gray-800">{t.mistakes.map((x) => <li key={x}>• {x}</li>)}</ul></div>
        </div>

        <Link to={t.action.to} className="mt-8 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-6 py-4 text-lg font-semibold text-white hover:bg-emerald-800">{t.action.label}<ArrowRight className="h-5 w-5" aria-hidden /></Link>
        <p className="mt-2 text-center text-sm text-gray-500">You will be asked to sign in if you are not signed in.</p>

        <nav aria-label="More guides" className="mt-10 flex justify-between gap-3 border-t pt-6 text-base">
          {prev ? <Link to={`/learn/${prev.slug}`} className="text-emerald-800 hover:underline">← {prev.title}</Link> : <span />}
          {next ? <Link to={`/learn/${next.slug}`} className="text-right text-emerald-800 hover:underline">{next.title} →</Link> : <span />}
        </nav>
      </main>
      <PublicFooter />
    </div>
  );
}

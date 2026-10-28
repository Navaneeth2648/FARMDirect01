import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, Mic, MicOff, Settings2, Volume2, VolumeX, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ApiError, fmtDateTime } from './api';
import { LANGUAGES } from './i18n';
import { useAuth } from './auth';

export { Button };

// ---------- Data loading ----------
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await fnRef.current());
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(0, String((e as Error)?.message || e)));
    } finally {
      setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { reload(); }, deps);
  return { data, error, loading, reload, setData };
}

// ---------- Layout ----------
export function PageHeader({ title, subtitle, actions, icon }: { title: string; subtitle?: ReactNode; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-3 min-w-0">
        {icon && <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700" aria-hidden>{icon}</div>}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-gray-600">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, actions, children, className = '', description }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; description?: ReactNode }) {
  return (
    <section className={`rounded-xl border border-gray-100 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,20,0.04)] sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            {title && <h2 className="text-[17px] font-bold text-gray-900">{title}</h2>}
            {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Grid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const c = cols === 2 ? 'md:grid-cols-2' : cols === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-2 xl:grid-cols-3';
  return <div className={`grid grid-cols-1 gap-4 ${c}`}>{children}</div>;
}

// ---------- Feedback ----------
const BADGE: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800',
  blue: 'bg-sky-100 text-sky-800', gray: 'bg-gray-100 text-gray-700', purple: 'bg-violet-100 text-violet-800',
};
export function Badge({ children, tone = 'gray' }: { children: ReactNode; tone?: keyof typeof BADGE }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}>{children}</span>;
}

export const severityTone = (s?: string): keyof typeof BADGE =>
  s === 'severe' || s === 'warning' || s === 'high' ? 'red' : s === 'advisory' || s === 'moderate' ? 'amber' : s === 'info' || s === 'low' ? 'blue' : 'gray';

export function Skeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`} aria-busy="true" aria-label="Loading">
      {Array.from({ length: lines }, (_, i) => <div key={i} className="h-4 rounded bg-gray-200" style={{ width: `${90 - i * 12}%` }} />)}
    </div>
  );
}

export function Empty({ title, children, action, icon }: { title: string; children?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 py-8 text-center">
      {icon && <div className="mb-2 text-gray-400" aria-hidden>{icon}</div>}
      <p className="font-medium text-gray-800">{title}</p>
      {children && <div className="mt-1 max-w-md text-sm text-gray-600">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: ApiError | Error | string; onRetry?: () => void }) {
  const msg = typeof error === 'string' ? error : error.message;
  const setup = typeof error !== 'string' && (error as ApiError).details?.setup;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <div className="flex-1">
        <p>{msg}</p>
        {setup && <p className="mt-1 text-xs text-red-700">Setup: {setup}</p>}
      </div>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

export function Notice({ tone = 'info', children, title }: { tone?: 'info' | 'warn' | 'ok'; children: ReactNode; title?: string }) {
  const cls = tone === 'warn' ? 'border-amber-200 bg-amber-50 text-amber-900' : tone === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-sky-200 bg-sky-50 text-sky-900';
  const Icon = tone === 'warn' ? AlertTriangle : tone === 'ok' ? CheckCircle2 : Info;
  return (
    <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${cls}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div>{title && <p className="font-semibold">{title}</p>}{children}</div>
    </div>
  );
}

export function SetupNotice({ service, setup }: { service: string; setup?: string | null }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-gray-300 bg-gray-50 p-4 text-sm text-gray-700">
      <Settings2 className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" aria-hidden />
      <div>
        <p className="font-semibold text-gray-900">{service} is not configured on this server</p>
        <p className="mt-1">No data is shown rather than showing made-up data.{setup ? ` ${setup}` : ''}</p>
      </div>
    </div>
  );
}

export function SourceNote({ source, updated, stale, note }: { source?: string; updated?: string | null; stale?: boolean; note?: string }) {
  return (
    <p className="mt-2 text-xs text-gray-500">
      {source && <>Source: {source}. </>}
      {updated && <>Last updated {fmtDateTime(updated)}. </>}
      {stale && <span className="font-semibold text-amber-700">Showing older cached data; the provider is unavailable. </span>}
      {note}
    </p>
  );
}

// ---------- Toasts & dialogs ----------
type Toast = { id: number; tone: 'ok' | 'error' | 'info'; msg: string };
const ToastCtx = createContext<(msg: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, tone: Toast['tone'] = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, tone, msg }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="fixed bottom-20 left-1/2 z-[60] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2 lg:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${t.tone === 'error' ? 'bg-red-700 text-white' : t.tone === 'info' ? 'bg-gray-800 text-white' : 'bg-emerald-700 text-white'}`}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    (ref.current?.querySelector<HTMLElement>('input,select,textarea') ?? ref.current?.querySelector<HTMLElement>('button'))?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-gray-100" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Confirm({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: {
  open: boolean; title: string; message: ReactNode; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <div className="text-sm text-gray-700">{message}</div>
      <div className="mt-5 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'destructive' : 'default'} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

export function useConfirm() {
  const [state, setState] = useState<{ title: string; message: ReactNode; danger?: boolean; label?: string; resolve: (v: boolean) => void } | null>(null);
  const ask = (title: string, message: ReactNode, opts: { danger?: boolean; label?: string } = {}) =>
    new Promise<boolean>((resolve) => setState({ title, message, ...opts, resolve }));
  const node = state ? (
    <Confirm open title={state.title} message={state.message} danger={state.danger} confirmLabel={state.label}
      onConfirm={() => { state.resolve(true); setState(null); }} onCancel={() => { state.resolve(false); setState(null); }} />
  ) : null;
  return { ask, node };
}

// ---------- Forms ----------
export function Field({ label, children, hint, error, required }: { label: string; children: (id: string) => ReactNode; hint?: string; error?: string; required?: boolean }) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-gray-800">{label}{required && <span className="text-red-600"> *</span>}</label>
      {children(id)}
      {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      {error && <p className="text-xs text-red-700" role="alert">{error}</p>}
    </div>
  );
}

const inputCls = 'block w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600/30 disabled:bg-gray-100';
export const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${inputCls} ${p.className || ''}`} />;
export const Textarea = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea rows={3} {...p} className={`${inputCls} ${p.className || ''}`} />;
export function Select({ options, placeholder, ...p }: React.SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...p} className={`${inputCls} ${p.className || ''}`}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Map server field errors (path → message). */
export const fieldErrors = (e: unknown) => {
  const out: Record<string, string> = {};
  if (e instanceof ApiError && e.fields) for (const f of e.fields) out[f.path] = f.message;
  return out;
};

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-gray-100 p-1">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${value === t.id ? 'bg-white text-emerald-800 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const Spinner = () => <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;

// ---------- Voice ----------
const speechLang = (l: string) => LANGUAGES.find((x) => x.code === l)?.speech || 'en-IN';

export function SpeakButton({ text, className = '' }: { text: string; className?: string }) {
  const { lang, t } = useAuth();
  const [speaking, setSpeaking] = useState(false);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  useEffect(() => () => { if (supported) window.speechSynthesis.cancel(); }, [supported]);
  if (!supported) return null;
  const toggle = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = speechLang(lang);
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang === u.lang);
    if (voice) u.voice = voice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  };
  return (
    <button type="button" onClick={toggle} className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-emerald-800 hover:bg-emerald-50 ${className}`} aria-label={speaking ? t('stop') : t('listen')}>
      {speaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />} {speaking ? t('stop') : t('listen')}
    </button>
  );
}

export function useSpeechInput(onText: (t: string) => void) {
  const { lang } = useAuth();
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null;
  const start = () => {
    if (!SR) return;
    const rec = new SR();
    rec.lang = speechLang(lang);
    rec.interimResults = false;
    rec.onresult = (e: any) => onText(Array.from(e.results).map((r: any) => r[0].transcript).join(' '));
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };
  const stop = () => { recRef.current?.stop(); setListening(false); };
  return { supported: !!SR, listening, start, stop };
}

export function MicButton({ onText }: { onText: (t: string) => void }) {
  const { t } = useAuth();
  const s = useSpeechInput(onText);
  if (!s.supported) return null; // typing remains available
  return (
    <button type="button" onClick={s.listening ? s.stop : s.start} aria-label={t('speak')} aria-pressed={s.listening}
      className={`rounded-lg border p-2.5 ${s.listening ? 'border-red-300 bg-red-50 text-red-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
      {s.listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
    </button>
  );
}

// ---------- Charts (dependency-free SVG) ----------
export function LineChart({ series, height = 180, unit = '', yLabel }: {
  series: { name: string; color: string; points: { x: string; y: number | null }[] }[]; height?: number; unit?: string; yLabel?: string;
}) {
  const all = series.flatMap((s) => s.points.map((p) => p.y)).filter((v): v is number => v != null);
  if (!all.length) return <p className="text-sm text-gray-500">No data to chart.</p>;
  const xs = series[0].points.map((p) => p.x);
  const min = Math.min(...all), max = Math.max(...all);
  const pad = (max - min) * 0.1 || 1;
  const lo = min - pad, hi = max + pad;
  const W = 600, H = height, L = 44, B = 24, T = 8, R = 8;
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(1, xs.length - 1);
  const y = (v: number) => T + ((hi - v) * (H - T - B)) / (hi - lo);
  const ticks = [lo, (lo + hi) / 2, hi];
  const step = Math.ceil(xs.length / 6);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={yLabel || 'chart'}>
        {ticks.map((tv, i) => (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y(tv)} y2={y(tv)} style={{ stroke: "var(--color-gray-200)" }} />
            <text x={L - 4} y={y(tv) + 4} textAnchor="end" fontSize="11" style={{ fill: "var(--color-gray-500)" }}>{Math.round(tv)}{unit}</text>
          </g>
        ))}
        {xs.map((lbl, i) => i % step === 0 && <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="11" style={{ fill: "var(--color-gray-500)" }}>{lbl}</text>)}
        {series.map((s) => {
          const d = s.points.map((p, i) => (p.y == null ? null : `${x(i)},${y(p.y)}`)).filter(Boolean).join(' L ');
          return d ? <path key={s.name} d={`M ${d}`} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" /> : null;
        })}
      </svg>
      {series.length > 1 && (
        <figcaption className="mt-1 flex flex-wrap gap-3 text-xs text-gray-600">
          {series.map((s) => <span key={s.name} className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded" style={{ background: s.color }} />{s.name}</span>)}
        </figcaption>
      )}
    </figure>
  );
}

export function Bars({ data, unit = '', color = '#0284c7', height = 140 }: { data: { label: string; value: number | null }[]; unit?: string; color?: string; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <div className="flex items-end gap-1" style={{ height }} role="img" aria-label="bar chart">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-[10px] text-gray-600">{d.value != null ? `${Math.round(d.value)}${unit}` : '–'}</span>
          <div className="w-full rounded-t" style={{ height: `${((d.value ?? 0) / max) * (height - 34)}px`, background: color, minHeight: d.value ? 2 : 0 }} />
          <span className="text-[10px] text-gray-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
].map((s) => ({ value: s, label: s }));

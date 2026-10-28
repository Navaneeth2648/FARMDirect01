import { useSyncExternalStore } from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';

export type ThemeMode = 'light' | 'dark' | 'system';

const read = (): ThemeMode => {
  try {
    const m = localStorage.getItem('fd_theme');
    return m === 'light' || m === 'dark' ? m : 'system';
  } catch { return 'system'; }
};

const systemDark = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;

function apply(mode: ThemeMode) {
  document.documentElement.classList.toggle('dark', mode === 'dark' || (mode === 'system' && systemDark()));
}

// One shared value so every theme control on screen stays in step.
let current: ThemeMode = typeof window === 'undefined' ? 'system' : read();
const listeners = new Set<() => void>();
function setTheme(mode: ThemeMode) {
  current = mode;
  apply(mode);
  try { localStorage.setItem('fd_theme', mode); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}
if (typeof window !== 'undefined') {
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => { if (current === 'system') apply('system'); });
}

/** Light, dark or follow the phone/computer setting. Saved on this device only. */
export function useTheme() {
  const mode = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => current, () => current);
  return { mode, setMode: setTheme };
}

const NEXT: Record<ThemeMode, ThemeMode> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<ThemeMode, string> = { system: 'Theme: follow device', light: 'Theme: light', dark: 'Theme: dark' };

/** One button that cycles device → light → dark. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const { mode, setMode } = useTheme();
  const Icon = mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor;
  return (
    <button type="button" onClick={() => setMode(NEXT[mode])} title={LABEL[mode]} aria-label={`${LABEL[mode]}. Change theme`}
      className={`rounded-lg p-2 text-gray-700 hover:bg-gray-100 ${className}`}>
      <Icon className="h-5 w-5" aria-hidden />
    </button>
  );
}

/** Three explicit choices, for the More / Settings screens. */
export function ThemeChoice() {
  const { mode, setMode } = useTheme();
  const opts: { id: ThemeMode; label: string; icon: any }[] = [{ id: 'light', label: 'Light', icon: Sun }, { id: 'dark', label: 'Dark', icon: Moon }, { id: 'system', label: 'Device', icon: Monitor }];
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-full border border-gray-200 bg-gray-50 p-0.5">
      {opts.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={mode === o.id} onClick={() => setMode(o.id)}
          className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${mode === o.id ? 'bg-emerald-600 text-white' : 'text-gray-600'}`}>
          <o.icon className="h-3.5 w-3.5" aria-hidden />{o.label}
        </button>
      ))}
    </div>
  );
}

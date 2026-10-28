import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, ChevronRight, LogOut, Pencil, UserRound } from 'lucide-react';
import { useAuth } from '../auth';
import { LANGUAGES } from '../i18n';
import { useVisibleNav } from '../Layout';
import { ThemeChoice } from '../theme';
import { MedhaAvatar } from '../medha';

const GROUPS = [
  { g: 'work', label: 'Workspace' },
  { g: 'market', label: 'Buy & sell' },
  { g: 'farm', label: 'Farm tools' },
  { g: 'learn', label: 'Learn & connect' },
  { g: 'account', label: 'My account' },
] as const;

/** Phone "More" screen: every destination in plain grouped lists. */
export function MorePage() {
  const { user, t, lang, setLang, logout } = useAuth();
  const nav = useNavigate();
  const items = useVisibleNav();
  if (!user) return null;
  const initials = user.full_name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const incomplete = !user.village || !user.district || !user.state;

  return (
    <div className="-mx-3 -mt-5 sm:mx-0 sm:mt-0">
      <section className="flex items-center gap-4 bg-white px-4 py-5 sm:rounded-xl">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xl font-bold text-emerald-800" aria-hidden>
          {initials || <UserRound className="h-8 w-8" />}
        </div>
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold text-gray-900">{user.full_name}</p>
          <p className="truncate text-sm text-gray-500">{[user.village, user.district, user.state].filter(Boolean).join(', ') || user.role.replace('_', ' ')}</p>
          <Link to="/settings" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><Pencil className="h-3.5 w-3.5" aria-hidden />Edit profile</Link>
        </div>
      </section>

      {incomplete && (
        <Link to="/settings" className="mt-px flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-white px-4 py-4 sm:mt-3 sm:rounded-xl">
          <div className="flex-1">
            <p className="font-semibold text-gray-900">Complete your profile</p>
            <p className="text-xs text-gray-600">Add your village and district for local weather, prices and buyers.</p>
          </div>
          <span className="rounded-full bg-emerald-700 p-1.5 text-white"><ArrowRight className="h-5 w-5" aria-hidden /></span>
        </Link>
      )}

      <Link to="/assistant" className="mt-2 flex items-center gap-3 bg-white px-4 py-3 sm:mt-3 sm:rounded-xl">
        <MedhaAvatar size={44} />
        <div className="flex-1"><p className="font-semibold text-gray-900">Ask Medha AI</p><p className="text-xs text-gray-500">Farming questions in your language</p></div>
        <ChevronRight className="h-5 w-5 text-emerald-700" aria-hidden />
      </Link>

      {GROUPS.map(({ g, label }) => {
        const list = items.filter((n) => n.group === g);
        if (!list.length) return null;
        return (
          <section key={g} className="mt-2 bg-white px-4 pt-4 sm:mt-3 sm:rounded-xl">
            <h2 className="text-base font-bold text-gray-900">{label}</h2>
            <ul className="divide-y divide-gray-100">
              {list.map((n) => (
                <li key={n.to}>
                  <Link to={n.to} className="flex items-center gap-3 py-3.5 text-[15px] text-gray-800">
                    <n.icon className="h-5 w-5 text-gray-700" aria-hidden />
                    <span className="flex-1">{t(n.key)}</span>
                    <ChevronRight className="h-5 w-5 text-emerald-700" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="mt-2 space-y-3 bg-white px-4 py-4 sm:mt-3 sm:rounded-xl">
        <h2 className="text-base font-bold text-gray-900">Appearance</h2>
        <div className="flex items-center justify-between gap-3"><span className="text-sm text-gray-700">Theme</span><ThemeChoice /></div>
        <label className="flex items-center justify-between gap-3 text-sm text-gray-700">
          {t('language')}
          <select value={lang} onChange={(e) => setLang(e.target.value as any)} className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-800">
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
        </label>
      </section>

      <button onClick={async () => { await logout(); nav(user.is_staff ? '/admin/login' : '/login'); }}
        className="mt-2 flex w-full items-center gap-3 bg-white px-4 py-4 text-[15px] font-semibold text-red-700 sm:mt-3 sm:rounded-xl">
        <LogOut className="h-5 w-5" aria-hidden />{t('logout')}
      </button>
    </div>
  );
}

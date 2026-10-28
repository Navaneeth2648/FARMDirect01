import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BadgeCheck, BarChart3, Building2, ClipboardCheck, GraduationCap, Leaf, ShoppingCart, Bell, BookOpen, Bot, Bookmark, Briefcase, CalendarDays, ClipboardList, CloudSun, Contact, Gauge, Handshake, Home, Landmark, LayoutGrid, LogOut, Menu, MessagesSquare,
  Newspaper, Package, QrCode, Satellite, Settings, ShieldCheck, Sprout, Stethoscope, Store, TrendingUp, TriangleAlert, Droplets, Tractor, Truck, UserRound, Warehouse, WifiOff, X,
} from 'lucide-react';
import { useAuth, isVerifiedPro, type Role } from './auth';
import type { TKey } from './i18n';
import { LANGUAGES } from './i18n';
import { api } from './api';
import { Badge } from './ui';
import { ThemeToggle } from './theme';
import { FloatingMedha } from './medha';

interface NavItem { to: string; key: TKey; icon: any; roles?: Role[]; group: 'farm' | 'market' | 'learn' | 'account' | 'work' }

const FARMER_ROLES: Role[] = ['farmer', 'field_agent', 'fpo_manager', 'expert', 'dealer'];
const STAFF: Role[] = ['admin', 'super_admin', 'content_editor', 'verification_officer', 'marketplace_admin', 'storage_officer', 'dispute_officer', 'finance_officer'];
// Farm tools are for farmers, extension staff and administrators – not buyers or logistics partners.
const FARM_AUDIENCE: Role[] = [...FARMER_ROLES, 'admin', 'super_admin', 'content_editor'];
const SELLERS: Role[] = ['farmer', 'fpo_manager'];
const TRADERS: Role[] = ['farmer', 'fpo_manager', 'buyer'];

export const NAV: NavItem[] = [
  { to: '/buyer', key: 'buyerHome', icon: Home, group: 'market', roles: ['buyer'] },
  { to: '/', key: 'home', icon: Home, group: 'farm', roles: FARM_AUDIENCE },
  { to: '/sell', key: 'sell', icon: Sprout, group: 'market', roles: SELLERS },
  { to: '/storage', key: 'storage', icon: Warehouse, group: 'market', roles: SELLERS },
  { to: '/market', key: 'market', icon: Store, group: 'market', roles: [...TRADERS, ...STAFF] },
  { to: '/buyer/demand', key: 'myRequirements', icon: ClipboardList, group: 'market', roles: ['buyer'] },
  { to: '/trade', key: 'trade', icon: Handshake, group: 'market', roles: [...TRADERS, 'storage_provider', 'transport_provider'] },
  { to: '/storage/provider', key: 'providerDesk', icon: Warehouse, group: 'work', roles: ['storage_provider'] },
  { to: '/transport/provider', key: 'transportDesk', icon: Truck, group: 'work', roles: ['transport_provider'] },
  { to: '/farm', key: 'myFarm', icon: Tractor, group: 'farm', roles: FARMER_ROLES },
  { to: '/weather', key: 'weather', icon: CloudSun, group: 'farm', roles: FARM_AUDIENCE },
  { to: '/crop-doctor', key: 'cropDoctor', icon: Stethoscope, group: 'farm', roles: FARM_AUDIENCE },
  { to: '/advisory', key: 'advisory', icon: Sprout, group: 'farm', roles: FARM_AUDIENCE },
  { to: '/assistant', key: 'assistant', icon: Bot, group: 'farm', roles: FARM_AUDIENCE },
  { to: '/calendar', key: 'calendar', icon: CalendarDays, group: 'farm', roles: FARMER_ROLES },
  { to: '/operations', key: 'operations', icon: Briefcase, group: 'farm', roles: FARMER_ROLES },
  { to: '/soil-water', key: 'soilWater', icon: Droplets, group: 'farm', roles: FARMER_ROLES },
  { to: '/satellite', key: 'satellite', icon: Satellite, group: 'farm', roles: FARMER_ROLES },
  { to: '/alerts', key: 'alerts', icon: TriangleAlert, group: 'farm', roles: FARM_AUDIENCE },
  { to: '/mandi', key: 'mandi', icon: TrendingUp, group: 'market' },
  { to: '/products', key: 'products', icon: Package, group: 'market', roles: FARM_AUDIENCE },
  { to: '/verify', key: 'verify', icon: QrCode, group: 'market', roles: FARM_AUDIENCE },
  { to: '/schemes', key: 'schemes', icon: Landmark, group: 'learn' },
  { to: '/knowledge', key: 'knowledge', icon: BookOpen, group: 'learn' },
  { to: '/news', key: 'news', icon: Newspaper, group: 'learn' },
  { to: '/experts', key: 'experts', icon: Contact, group: 'learn' },
  { to: '/community', key: 'community', icon: MessagesSquare, group: 'learn' },
  { to: '/guides', key: 'fieldGuide', icon: Leaf, group: 'learn' },
  { to: '/statistics', key: 'cropStats', icon: BarChart3, group: 'learn' },
  { to: '/businesses', key: 'businesses', icon: Building2, group: 'market', roles: ['farmer', 'fpo_manager', 'buyer', 'admin', 'super_admin', 'marketplace_admin'] },
  { to: '/inputs', key: 'inputs', icon: ShoppingCart, group: 'market', roles: ['farmer', 'fpo_manager', 'dealer'] },
  { to: '/grading', key: 'grading', icon: ClipboardCheck, group: 'work', roles: ['field_agent', 'expert', 'admin', 'super_admin', 'marketplace_admin'] },
  { to: '/learn', key: 'learningCentre', icon: GraduationCap, group: 'learn' },
  { to: '/notifications', key: 'notifications', icon: Bell, group: 'account' },
  { to: '/account/verification', key: 'verification', icon: BadgeCheck, group: 'account', roles: ['farmer', 'fpo_manager'] },
  { to: '/buyer/verification', key: 'verification', icon: BadgeCheck, group: 'account', roles: ['buyer'] },
  { to: '/saved', key: 'saved', icon: Bookmark, group: 'account' },
  { to: '/settings', key: 'settings', icon: Settings, group: 'account' },
  { to: '/expert-desk', key: 'expertDesk', icon: ShieldCheck, group: 'work', roles: ['expert', 'field_agent', 'admin', 'super_admin', 'content_editor'] },
  { to: '/admin', key: 'admin', icon: Gauge, group: 'work', roles: STAFF },
];

export const GROUP_LABEL = { work: 'Workspace', farm: 'Farm', market: 'Market', learn: 'Learn & connect', account: 'Account' };

/** A small set of core destinations per kind of user on phones. */
function mobileTabs(role?: Role): { to: string; key: TKey; icon: any }[] {
  const acct = { to: '/more', key: 'more' as TKey, icon: LayoutGrid };
  if (role === 'farmer' || role === 'fpo_manager') return [{ to: '/', key: 'home', icon: Home }, { to: '/mandi', key: 'mandi', icon: TrendingUp }, { to: '/sell', key: 'sell', icon: Sprout }, { to: '/market', key: 'market', icon: Store }, acct];
  if (role === 'buyer') return [{ to: '/buyer', key: 'home', icon: Home }, { to: '/market', key: 'market', icon: Store }, { to: '/trade', key: 'trade', icon: Handshake }, { to: '/buyer/demand', key: 'myRequirements', icon: ClipboardList }, acct];
  if (role === 'storage_provider') return [{ to: '/storage/provider', key: 'home', icon: Warehouse }, { to: '/trade?tab=payments', key: 'trade', icon: Handshake }, { to: '/notifications', key: 'notifications', icon: Bell }, acct];
  if (role === 'transport_provider') return [{ to: '/transport/provider', key: 'home', icon: Truck }, { to: '/notifications', key: 'notifications', icon: Bell }, acct];
  if (role && STAFF.includes(role) && role !== 'content_editor') return [{ to: '/admin', key: 'admin', icon: Gauge }, { to: '/market', key: 'market', icon: Store }, { to: '/notifications', key: 'notifications', icon: Bell }, acct];
  return [{ to: '/', key: 'home', icon: Home }, { to: '/weather', key: 'weather', icon: CloudSun }, { to: '/crop-doctor', key: 'cropDoctor', icon: Stethoscope }, { to: '/mandi', key: 'mandi', icon: TrendingUp }, acct];
}

function useA11yPrefs() {
  const [large, setLarge] = useState(() => { try { return localStorage.getItem('fd_large') === '1'; } catch { return false; } });
  const [contrast, setContrast] = useState(() => { try { return localStorage.getItem('fd_contrast') === '1'; } catch { return false; } });
  useEffect(() => {
    document.documentElement.classList.toggle('fd-large', large);
    document.documentElement.classList.toggle('fd-contrast', contrast);
    try { localStorage.setItem('fd_large', large ? '1' : '0'); localStorage.setItem('fd_contrast', contrast ? '1' : '0'); } catch { /* ignore */ }
  }, [large, contrast]);
  return { large, setLarge, contrast, setContrast };
}

/** Navigation entries this user may open (same rules as the sidebar). */
export function useVisibleNav() {
  const { user } = useAuth();
  return NAV.filter((n) => {
    if (!n.roles) return true;
    if (!user || !n.roles.includes(user.role)) return user?.role === 'super_admin' && n.roles.includes('admin');
    if ((n.key === 'expertDesk' || n.key === 'admin') && !isVerifiedPro(user)) return false;
    return true;
  });
}

export function Layout() {
  const { user, t, lang, setLang, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);
  const loc = useLocation();
  const nav = useNavigate();
  const a11y = useA11yPrefs();

  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => {
    let alive = true;
    const load = () => api.get('/v1/notifications?unread=1').then((r) => alive && setUnread(r.unread)).catch(() => {});
    load();
    const i = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(i); };
  }, [loc.pathname]);

  const visible = useVisibleNav();
  const groups = (['work', 'farm', 'market', 'learn', 'account'] as const).map((g) => ({ g, items: visible.filter((n) => n.group === g) })).filter((x) => x.items.length);

  const link = (n: NavItem) => (
    <NavLink key={n.to} to={n.to} end={n.to === '/'}
      className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-emerald-50 font-semibold text-emerald-800' : 'text-gray-700 hover:bg-gray-100'}`}>
      <n.icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">{t(n.key)}</span>
      {n.key === 'notifications' && unread > 0 && <span className="rounded-full bg-red-600 px-1.5 text-xs text-white">{unread}</span>}
    </NavLink>
  );

  const sidebar = (
    <nav aria-label="Main" className="flex h-full flex-col">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="rounded-xl bg-emerald-600 p-1.5 text-white"><Sprout className="h-5 w-5" aria-hidden /></div>
        <p className="text-lg font-extrabold leading-tight tracking-tight text-gray-900">FARM<span className="text-emerald-600">Direct</span></p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-4">
        {groups.map(({ g, items }) => (
          <div key={g}>
            <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{GROUP_LABEL[g]}</p>
            <div className="space-y-0.5">{items.map(link)}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-gray-200 p-3">
        <button onClick={async () => { await logout(); nav(user?.is_staff ? '/admin/login' : '/login'); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
          <LogOut className="h-5 w-5" aria-hidden /> {t('logout')}
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-gray-100 bg-white lg:block">{sidebar}</aside>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-white shadow-xl">
            <button className="absolute right-2 top-3 rounded p-2 hover:bg-gray-100" onClick={() => setOpen(false)} aria-label={t('close')}><X className="h-5 w-5" /></button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-gray-100 bg-white px-3 py-2 sm:px-5">
          <button className="rounded-lg p-2 hover:bg-gray-100 lg:hidden" onClick={() => setOpen(true)} aria-label={t('menu')}><Menu className="h-6 w-6" /></button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-900">{user?.full_name}</p>
            <p className="truncate text-xs text-gray-500">
              {[user?.village, user?.district, user?.state].filter(Boolean).join(', ') || user?.role}
              {user && user.role !== 'farmer' && user.verification_status === 'pending' && <> · <Badge tone="amber">verification pending</Badge></>}
            </p>
          </div>
          <select aria-label={t('language')} value={lang} onChange={(e) => setLang(e.target.value as any)} className="rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-800">
            {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
          </select>
          <button onClick={() => a11y.setLarge(!a11y.large)} aria-pressed={a11y.large} title={t('textSize')} aria-label={t('textSize')}
            className={`hidden rounded-full border px-2 py-1 text-sm font-bold text-gray-800 sm:block ${a11y.large ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200'}`}>A+</button>
          <button onClick={() => a11y.setContrast(!a11y.contrast)} aria-pressed={a11y.contrast} title={t('highContrast')} aria-label={t('highContrast')}
            className={`hidden rounded-full border px-2 py-1 text-sm font-bold text-gray-800 sm:block ${a11y.contrast ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200'}`}>◐</button>
          <ThemeToggle />
          <NavLink to="/notifications" className="relative rounded-lg p-2 text-gray-700 hover:bg-gray-100" aria-label={`${t('notifications')} (${unread})`}>
            <Bell className="h-5 w-5" />
            {unread > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-red-600" />}
          </NavLink>
        </header>
        {!online && (
          <div className="flex items-center justify-center gap-2 bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white">
            <WifiOff className="h-4 w-4" aria-hidden /> {t('offline')}
          </div>
        )}
        <main id="main" className="mx-auto max-w-7xl px-3 py-5 pb-24 sm:px-5 lg:pb-8">
          <Outlet />
        </main>
      </div>

      <FloatingMedha />

      {/* Bottom tab bar for phones; everything else is under "More" */}
      <nav aria-label="Quick" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-gray-100 bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_10px_rgba(0,0,0,0.04)] lg:hidden">
        {mobileTabs(user?.role).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `group flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] ${isActive ? 'font-bold text-gray-900' : 'font-medium text-gray-600'}`}>
            {({ isActive }) => (<>
              <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition-colors ${isActive ? 'bg-emerald-100 text-emerald-700' : ''}`}>
                <n.icon className="h-[22px] w-[22px]" aria-hidden />
                {n.key === 'more' && unread > 0 && <span className="absolute right-2 top-0.5 h-2 w-2 rounded-full bg-red-600" />}
              </span>
              <span className="max-w-full truncate px-0.5">{t(n.key)}</span>
            </>)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Language } from '../types';
import { api } from './api';
import { translate, type TKey } from './i18n';

export type Role = 'farmer' | 'buyer' | 'expert' | 'dealer' | 'field_agent' | 'fpo_manager' | 'storage_provider' | 'transport_provider'
  | 'content_editor' | 'admin' | 'super_admin' | 'verification_officer' | 'marketplace_admin' | 'storage_officer' | 'dispute_officer' | 'finance_officer';

export const STAFF_ROLES: Role[] = ['super_admin', 'admin', 'verification_officer', 'marketplace_admin', 'storage_officer', 'dispute_officer', 'finance_officer', 'content_editor'];

export interface FarmerStanding {
  level: number; levels: { level: number; name: string; done: boolean }[]; missing_profile_fields: string[];
  identity_application: { id: string; status: string } | null; transaction_eligible: boolean; max_order_value_inr: number | null;
  restriction: { id: string; kind: string; reason: string } | null; next_step: string | null;
}

export interface PlatformUser {
  permissions: string[]; is_staff: boolean; has_password: boolean;
  buyer_profile?: { status: string; buyer_type: string; business_name?: string | null } | null;
  farmer_standing?: FarmerStanding;
  id: string; full_name: string; phone: string; email?: string | null; role: Role; verification_status: string; status: string;
  language: Language; state?: string | null; district?: string | null; subdistrict?: string | null; village?: string | null; pincode?: string | null;
  latitude?: number | null; longitude?: number | null; location_consent: number; onboarding_complete: number;
  notify_channels: string[]; quiet_hours_start?: string | null; quiet_hours_end?: string | null; keep_diagnosis_history: number;
}

interface AuthCtx {
  user: PlatformUser | null;
  loading: boolean;
  lang: Language;
  t: (k: TKey) => string;
  setLang: (l: Language) => void;
  refresh: () => Promise<void>;
  setUser: (u: PlatformUser | null) => void;
  logout: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
  can: (perm: string) => boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

const storedLang = (): Language => {
  try {
    const l = localStorage.getItem('fc_language');
    return l === 'hi' || l === 'te' || l === 'ml' ? l : 'en';
  } catch { return 'en'; }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [lang, setLangState] = useState<Language>(storedLang);

  const refresh = useCallback(async () => {
    try {
      const r = await api.get<{ user: PlatformUser | null }>('/auth/me');
      setUser(r.user);
      if (r.user?.language) setLangState(r.user.language);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);

  const setLang = useCallback((l: Language) => {
    setLangState(l);
    try { localStorage.setItem('fc_language', l); } catch { /* ignore */ }
    if (user) api.patch('/v1/me', { language: l }).catch(() => {});
  }, [user]);

  const value = useMemo<AuthCtx>(() => ({
    user, loading, lang, setLang, refresh, setUser,
    t: (k) => translate(lang, k),
    logout: async () => { await api.post('/auth/logout').catch(() => {}); setUser(null); },
    hasRole: (...roles) => !!user && (roles.includes(user.role) || (user.role === 'super_admin' && roles.includes('admin'))),
    can: (perm) => !!user?.permissions?.includes(perm),
  }), [user, loading, lang, setLang, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}

export const isVerifiedPro = (u: PlatformUser | null) =>
  !!u && (STAFF_ROLES.includes(u.role) || u.verification_status === 'verified');

/** Where each kind of account lands after signing in. */
export const homeFor = (u: PlatformUser | null) =>
  !u ? '/login' : u.role === 'buyer' ? '/buyer' : u.role === 'storage_provider' ? '/storage/provider'
    : u.role === 'transport_provider' ? '/transport/provider' : u.is_staff && u.role !== 'content_editor' ? '/admin' : '/';

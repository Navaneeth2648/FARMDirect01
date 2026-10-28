import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { HelpCircle, KeyRound, ShieldCheck, ShoppingBasket, Sprout, Tractor, Warehouse } from 'lucide-react';
import { api } from '../api';
import { homeFor, useAuth } from '../auth';
import { LANGUAGES } from '../i18n';
import { Button, ErrorBox, Field, Input, Modal, Notice, Select, Spinner, fieldErrors } from '../ui';
import { VoiceHint } from '../trade-ui';
import { AadhaarQrFill, rememberAadhaarAddress } from '../aadhaar';

function Shell({ title, children, footer, accent = 'emerald', voice }: { title: string; children: ReactNode; footer?: ReactNode; accent?: 'emerald' | 'sky' | 'slate'; voice?: string }) {
  const { lang, setLang, t } = useAuth();
  const [help, setHelp] = useState(false);
  const bg = accent === 'sky' ? 'from-sky-50' : accent === 'slate' ? 'from-slate-100' : 'from-emerald-50';
  return (
    <div className={`flex min-h-screen flex-col items-center justify-center bg-gradient-to-b ${bg} to-white px-4 py-8`}>
      <div className="w-full max-w-md">
        <div className="mb-5 flex items-center justify-between gap-2">
          <Link to="/" className="flex items-center gap-2" aria-label="FARMDirect home">
            <div className="rounded-xl bg-emerald-600 p-2 text-white"><Sprout className="h-6 w-6" aria-hidden /></div>
            <p className="text-xl font-bold">FARMDirect</p>
          </Link>
          <div className="flex items-center gap-2">
            <select aria-label="Language" value={lang} onChange={(e) => setLang(e.target.value as any)} className="rounded-lg border border-gray-300 bg-white px-2 py-2 text-base">
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
            <button onClick={() => setHelp(true)} className="rounded-lg border border-gray-300 bg-white p-2" aria-label={t('help')}><HelpCircle className="h-6 w-6 text-emerald-700" /></button>
          </div>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-2"><h1 className="text-2xl font-bold">{title}</h1>{voice && <VoiceHint text={voice} />}</div>
          {children}
        </div>
        {footer && <div className="mt-4 space-y-2 text-center text-base text-gray-700">{footer}</div>}
      </div>
      <Modal open={help} onClose={() => setHelp(false)} title={t('help')}>
        <ul className="list-disc space-y-2 pl-5 text-base text-gray-700">
          <li>Type your 10-digit mobile number and press the green button.</li>
          <li>We send a 6-digit code by SMS. Type it in to sign in. No password is needed.</li>
          <li>Did not get the code? Wait for the timer and press “Resend code”.</li>
          <li>Press the speaker button to hear the instructions in your language.</li>
          <li>Never share your code with anyone, including people who say they work for FARMDirect.</li>
          <li>Need help in person? Ask at your nearest Krishi Vigyan Kendra or Common Service Centre.</li>
        </ul>
      </Modal>
    </div>
  );
}

function DevOtpNotice({ code }: { code?: string }) {
  if (!code) return null;
  return <Notice tone="warn" title="Development mode">No SMS provider is configured, so the code is shown here: <b className="font-mono">{code}</b></Notice>;
}

function useCountdown() {
  const [left, setLeft] = useState(0);
  useEffect(() => { if (left <= 0) return; const t = setTimeout(() => setLeft(left - 1), 1000); return () => clearTimeout(t); }, [left]);
  return { left, start: (s: number) => setLeft(s) };
}

const bigInput = 'text-lg py-3';

/** Mobile + OTP sign-in with an optional password path. */
function SignIn({ portal }: { portal: 'farmer' | 'buyer' }) {
  const { setUser, t } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const [mode, setMode] = useState<'otp' | 'password'>('otp');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState<{ devCode?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const cd = useCountdown();

  const done = (u: any) => { setUser(u); nav(loc.state?.from || homeFor(u), { replace: true }); };
  const sendCode = async () => {
    setBusy(true); setErr(null);
    try { const r = await api.post('/auth/otp/request', { phone, purpose: 'login' }); setSent(r); cd.start(r.resendAfterSeconds ?? 30); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'otp' && !sent) return sendCode();
    setBusy(true); setErr(null);
    try {
      done(mode === 'password' ? (await api.post('/auth/login', { phone, password, portal })).user : (await api.post('/auth/login/otp', { phone, otp })).user);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={t('mobileNumber')} required hint="Example: 98765 43210">{(id) => <Input id={id} className={bigInput} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={!!sent && mode === 'otp'} />}</Field>
      {mode === 'password' ? (
        <Field label="Password" required>{(id) => <Input id={id} className={bigInput} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
      ) : sent ? (
        <>
          <DevOtpNotice code={sent.devCode} />
          <Field label={t('enterCode')} hint="If this number is registered, we sent a code by SMS.">{(id) => <Input id={id} className={`${bigInput} tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required autoFocus />}</Field>
          <div className="text-center text-base">
            {cd.left > 0 ? <span className="text-gray-600">{t('resendIn')} {cd.left}s</span>
              : <button type="button" className="font-semibold text-emerald-700 underline" onClick={sendCode}>{t('resend')}</button>}
          </div>
        </>
      ) : null}
      {err && <ErrorBox error={err} />}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? <Spinner /> : mode === 'otp' && !sent ? t('sendCode') : t('signIn')}</Button>
      <div className="flex flex-wrap justify-between gap-2 text-base">
        <button type="button" className="text-emerald-700 underline" onClick={() => { setMode(mode === 'otp' ? 'password' : 'otp'); setSent(null); setErr(null); }}>
          {mode === 'otp' ? 'Use password instead' : 'Use SMS code instead'}
        </button>
        <Link to="/forgot" className="text-gray-600 underline">Forgot password?</Link>
      </div>
    </form>
  );
}

export function LoginChooser() {
  const { t } = useAuth();
  const card = (to: string, icon: ReactNode, title: string, text: string, cls: string) => (
    <Link to={to} className={`flex items-center gap-4 rounded-2xl border-2 bg-white p-5 shadow-sm transition hover:shadow ${cls}`}>
      <div className="shrink-0">{icon}</div>
      <div><p className="text-xl font-bold text-gray-900">{title}</p><p className="text-base text-gray-600">{text}</p></div>
    </Link>
  );
  return (
    <Shell title="Welcome" voice="Choose: I am a farmer, or I am a buyer.">
      <div className="space-y-3">
        {card('/login/farmer', <Tractor className="h-12 w-12 text-emerald-700" />, t('iAmFarmer'), 'Sell crops, book storage, get advice', 'border-emerald-200 hover:border-emerald-500')}
        {card('/login/buyer', <ShoppingBasket className="h-12 w-12 text-sky-700" />, t('iAmBuyer'), 'Buy directly from verified farmers', 'border-sky-200 hover:border-sky-500')}
      </div>
      <div className="mt-6 space-y-2 border-t pt-4 text-sm text-gray-600">
        <Link to="/register/partner" className="flex items-center gap-2 underline"><Warehouse className="h-4 w-4" />Storage, transport or agri professional? Register here</Link>
        <Link to="/admin/login" className="flex items-center gap-2 underline"><ShieldCheck className="h-4 w-4" />{t('administrator')} sign-in</Link>
      </div>
    </Shell>
  );
}

export function FarmerLoginPage() {
  const { t } = useAuth();
  return (
    <Shell title={`${t('signIn')} – ${t('iAmFarmer')}`} voice="Type your mobile number and press Send code. Then type the 6 digit code you get by SMS."
      footer={<><p>New here? <Link to="/register/farmer" className="font-semibold text-emerald-700 underline">{t('register')}</Link></p><p><Link to="/login" className="underline">{t('back')}</Link></p></>}>
      <SignIn portal="farmer" />
    </Shell>
  );
}

export function BuyerLoginPage() {
  const { t } = useAuth();
  return (
    <Shell accent="sky" title={`${t('signIn')} – ${t('iAmBuyer')}`}
      footer={<><p>New buyer? <Link to="/register/buyer" className="font-semibold text-sky-700 underline">Create a buyer account</Link></p><p><Link to="/login" className="underline">{t('back')}</Link></p></>}>
      <SignIn portal="buyer" />
    </Shell>
  );
}

/** Administrator sign-in: password, then a one-time code (MFA). No public registration. */
export function AdminLoginPage() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [challenge, setChallenge] = useState<{ challenge: string; devCode?: string } | null>(null);
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      if (!challenge) {
        const r = await api.post('/auth/login', { phone, password, portal: 'admin' });
        if (r.mfa_required) setChallenge(r); else { setUser(r.user); nav(homeFor(r.user), { replace: true }); }
      } else {
        const r = await api.post('/auth/login/mfa', { challenge: challenge.challenge, otp });
        setUser(r.user); nav(homeFor(r.user), { replace: true });
      }
    } catch (er) { setErr(er); } finally { setBusy(false); }
  };
  return (
    <Shell accent="slate" title="Administrator sign-in" footer={<Link to="/login" className="underline">Back</Link>}>
      <form onSubmit={submit} className="space-y-4">
        {!challenge ? (
          <>
            <Field label="Mobile number" required>{(id) => <Input id={id} inputMode="tel" autoComplete="username" value={phone} onChange={(e) => setPhone(e.target.value)} required />}</Field>
            <Field label="Password" required>{(id) => <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />}</Field>
          </>
        ) : (
          <>
            <Notice><KeyRound className="mr-1 inline h-4 w-4" />Second step: enter the one-time code sent to your registered phone.</Notice>
            <DevOtpNotice code={challenge.devCode} />
            <Field label="6-digit code" required>{(id) => <Input id={id} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} required autoFocus />}</Field>
          </>
        )}
        {err && <ErrorBox error={err} />}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : challenge ? 'Verify and sign in' : 'Continue'}</Button>
        <p className="text-xs text-gray-500">Administrator accounts are created by a super administrator. Repeated failed attempts lock the account for 15 minutes. All actions are audited.</p>
      </form>
    </Shell>
  );
}

/** Step 1 of registration (shared): name, mobile, OTP, language, consent. Later steps continue after the account exists. */
function BasicRegistration({ role, buyerType, onDone, accent }: { role: 'farmer' | 'buyer'; buyerType?: string; onDone: (u: any) => void; accent?: 'sky' }) {
  const { lang, setLang, t } = useAuth();
  const key = `fd_reg_${role}`;
  const saved = (() => { try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; } })();
  const [f, setF] = useState({ full_name: saved.full_name || '', phone: saved.phone || '', otp: '', consent: false });
  const [sent, setSent] = useState<{ devCode?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const cd = useCountdown();
  const fe = fieldErrors(err);
  // Save progress on this device (never the code).
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify({ full_name: f.full_name, phone: f.phone })); } catch { /* ignore */ } }, [f.full_name, f.phone, key]);

  const send = async () => {
    setBusy(true); setErr(null);
    try { const r = await api.post('/auth/otp/request', { phone: f.phone, purpose: 'verify' }); setSent(r); cd.start(r.resendAfterSeconds ?? 30); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sent) return send();
    setBusy(true); setErr(null);
    try {
      const r = await api.post('/auth/register', { full_name: f.full_name, phone: f.phone, otp: f.otp, consent: f.consent, role, language: lang, buyer_type: buyerType });
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      onDone(r.user);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      {role === 'farmer' && !sent && <AadhaarQrFill onFilled={(d) => { setF((x) => ({ ...x, full_name: d.name })); rememberAadhaarAddress(d); }} />}
      <Field label={role === 'buyer' ? 'Full name of the authorised representative' : 'Your name'} required hint={role === 'farmer' ? 'Example: Ravi Kumar' : undefined} error={fe.full_name}>
        {(id) => <Input id={id} className={bigInput} autoComplete="name" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required disabled={!!sent} />}
      </Field>
      <Field label={t('mobileNumber')} required hint="We will send a 6-digit code to verify it" error={fe.phone}>
        {(id) => <Input id={id} className={bigInput} inputMode="tel" autoComplete="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required disabled={!!sent} />}
      </Field>
      <Field label={t('language')}>{(id) => <Select id={id} className={bigInput} value={lang} onChange={(e) => setLang(e.target.value as any)} options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />}</Field>
      {sent && (
        <>
          <DevOtpNotice code={sent.devCode} />
          <Field label={t('enterCode')} required error={fe.otp}>{(id) => <Input id={id} className={`${bigInput} tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={f.otp} onChange={(e) => setF({ ...f, otp: e.target.value.replace(/\D/g, '') })} required autoFocus />}</Field>
          <div className="text-center">{cd.left > 0 ? <span className="text-gray-600">{t('resendIn')} {cd.left}s</span> : <button type="button" className="font-semibold text-emerald-700 underline" onClick={send}>{t('resend')}</button>}</div>
          <label className="flex items-start gap-3 rounded-xl bg-gray-50 p-3 text-base text-gray-800">
            <input type="checkbox" className="mt-1 h-6 w-6" checked={f.consent} onChange={(e) => setF({ ...f, consent: e.target.checked })} required />
            <span>I agree to the privacy policy and terms. FARMDirect will keep my details to run my account. I can download or delete my data any time.</span>
          </label>
        </>
      )}
      {err && <ErrorBox error={err} />}
      <Button type="submit" size="lg" className={`w-full ${accent === 'sky' ? 'bg-sky-700 hover:bg-sky-800' : ''}`} disabled={busy}>{busy ? <Spinner /> : sent ? 'Create my account' : t('sendCode')}</Button>
    </form>
  );
}

export function FarmerRegisterPage() {
  const { setUser, t } = useAuth();
  const nav = useNavigate();
  return (
    <Shell title={t('register')} voice="Step 1 of 4. Type your name and mobile number, then press Send code."
      footer={<><p>Already registered? <Link to="/login/farmer" className="font-semibold text-emerald-700 underline">{t('signIn')}</Link></p></>}>
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">Step 1 of 4 · Basic details</p>
      <BasicRegistration role="farmer" onDone={(u) => { setUser(u); nav('/onboarding', { replace: true }); }} />
    </Shell>
  );
}

const BUYER_TYPES = [
  { value: 'trader', label: 'Individual trader' }, { value: 'wholesaler', label: 'Wholesaler' }, { value: 'retailer', label: 'Retailer' },
  { value: 'processor', label: 'Food processor' }, { value: 'exporter', label: 'Exporter' }, { value: 'institutional', label: 'Restaurant / institutional buyer' },
  { value: 'cooperative', label: 'Cooperative / FPO' }, { value: 'other', label: 'Other authorised commercial buyer' },
];

export function BuyerRegisterPage() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [type, setType] = useState('trader');
  return (
    <Shell accent="sky" title="Create a buyer account" footer={<p>Already registered? <Link to="/login/buyer" className="font-semibold text-sky-700 underline">Sign in</Link></p>}>
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-sky-700">Step 1 of 4 · Identity and contact</p>
      <div className="mb-4"><Field label="Type of buyer">{(id) => <Select id={id} value={type} onChange={(e) => setType(e.target.value)} options={BUYER_TYPES} />}</Field></div>
      <BasicRegistration role="buyer" buyerType={type} accent="sky" onDone={(u) => { setUser(u); nav('/buyer/verification', { replace: true }); }} />
      <p className="mt-3 text-xs text-gray-500">Next you will add business details and purchasing needs. You can browse produce right away; making offers needs verification.</p>
    </Shell>
  );
}

const PARTNER_ROLES = [
  { value: 'storage_provider', label: 'Warehouse / cold-storage operator' },
  { value: 'transport_provider', label: 'Transport provider' },
  { value: 'expert', label: 'Agricultural expert / agronomist (needs verification)' },
  { value: 'dealer', label: 'Input dealer (needs verification)' },
  { value: 'field_agent', label: 'Field agent / extension worker (needs verification)' },
  { value: 'fpo_manager', label: 'FPO / cooperative manager (needs verification)' },
];

export function PartnerRegisterPage() {
  const { setUser, lang } = useAuth();
  const nav = useNavigate();
  const [f, setF] = useState({ full_name: '', phone: '', password: '', role: 'storage_provider', otp: '', consent: false });
  const [sent, setSent] = useState<{ devCode?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const fe = fieldErrors(err);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      if (!sent) setSent(await api.post('/auth/otp/request', { phone: f.phone, purpose: 'verify' }));
      else { const r = await api.post('/auth/register', { ...f, language: lang }); setUser(r.user); nav(homeFor(r.user), { replace: true }); }
    } catch (er) { setErr(er); } finally { setBusy(false); }
  };
  return (
    <Shell accent="slate" title="Partner registration" footer={<Link to="/login" className="underline">Back</Link>}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="I am registering as">{(id) => <Select id={id} value={f.role} onChange={set('role')} options={PARTNER_ROLES} disabled={!!sent} />}</Field>
        <Field label="Full name" required error={fe.full_name}>{(id) => <Input id={id} value={f.full_name} onChange={set('full_name')} required disabled={!!sent} />}</Field>
        <Field label="Mobile number" required error={fe.phone}>{(id) => <Input id={id} inputMode="tel" value={f.phone} onChange={set('phone')} required disabled={!!sent} />}</Field>
        <Field label="Password" required hint="At least 8 characters" error={fe.password}>{(id) => <Input id={id} type="password" autoComplete="new-password" minLength={8} value={f.password} onChange={set('password')} required />}</Field>
        {sent && (
          <>
            <DevOtpNotice code={sent.devCode} />
            <Field label="Verification code" required error={fe.otp}>{(id) => <Input id={id} inputMode="numeric" maxLength={6} value={f.otp} onChange={set('otp')} required />}</Field>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 h-4 w-4" checked={f.consent} onChange={set('consent')} required /><span>I agree to the privacy policy, terms, and marketplace rules.</span></label>
          </>
        )}
        {err && <ErrorBox error={err} />}
        <Button type="submit" className="w-full" disabled={busy}>{busy ? <Spinner /> : sent ? 'Create account' : 'Send verification code'}</Button>
        <p className="text-xs text-gray-500">Facilities and vehicles are listed publicly only after FARMDirect verifies your documents.</p>
      </form>
    </Shell>
  );
}

export function ForgotPage() {
  const nav = useNavigate();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [pw, setPw] = useState('');
  const [sent, setSent] = useState<{ devCode?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const [done, setDone] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      if (!sent) setSent(await api.post('/auth/otp/request', { phone, purpose: 'reset' }));
      else { await api.post('/auth/reset', { phone, otp, new_password: pw }); setDone(true); setTimeout(() => nav('/login'), 1500); }
    } catch (er) { setErr(er); } finally { setBusy(false); }
  };
  return (
    <Shell title="Reset password" footer={<Link to="/login" className="underline">Back to sign in</Link>}>
      {done ? <Notice tone="ok">Password changed. Please sign in.</Notice> : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Mobile number" required>{(id) => <Input id={id} className={bigInput} inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} required disabled={!!sent} />}</Field>
          {sent && (
            <>
              <DevOtpNotice code={sent.devCode} />
              <Field label="6-digit code" hint="If this number is registered, a code has been sent.">{(id) => <Input id={id} className={bigInput} inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value)} required />}</Field>
              <Field label="New password" hint="At least 8 characters (12 for administrators)">{(id) => <Input id={id} type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required />}</Field>
            </>
          )}
          {err && <ErrorBox error={err} />}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy ? <Spinner /> : sent ? 'Change password' : 'Send code'}</Button>
        </form>
      )}
    </Shell>
  );
}

// Kept for older links.
export const LoginPage = LoginChooser;
export const RegisterPage = FarmerRegisterPage;

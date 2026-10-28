import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { api, today } from '../api';
import { useAuth } from '../auth';
import { Button, ErrorBox, Field, Input, INDIAN_STATES, Notice, Select, Spinner } from '../ui';
import { CropSelect, LocationPicker } from '../shared';
import { VoiceHint } from '../trade-ui';
import { AadhaarQrFill, aadhaarLocation } from '../aadhaar';

const KEY = 'fd_onboarding';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };

/**
 * Registration steps 2–4 for farmers (step 1 – name, mobile, OTP, language, consent – created the account).
 * Every step is optional and progress is saved on the device, so farmers can stop and return later.
 */
export function OnboardingPage() {
  const { user, setUser, t } = useAuth();
  const nav = useNavigate();
  const saved = load();
  const [step, setStep] = useState<number>(saved.step ?? 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<any>(null);
  const [loc, setLoc] = useState(saved.loc ?? { state: user?.state || '', district: user?.district || '', subdistrict: '', village: '', pincode: '' });
  const [geo, setGeo] = useState<{ latitude: number; longitude: number; gps?: boolean } | null>(saved.geo ?? null);
  const [farm, setFarm] = useState(saved.farm ?? { name: '', total_area: '', area_unit: 'acre', ownership: '', irrigation_method: '' });
  const [crop, setCrop] = useState(saved.crop ?? { crop_id: '', sowing_date: today() });
  const [password, setPassword] = useState('');
  const [channels, setChannels] = useState<string[]>(saved.channels ?? ['in_app']);
  const [finished, setFinished] = useState(false);

  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify({ step, loc, geo, farm, crop, channels })); } catch { /* ignore */ } }, [step, loc, geo, farm, crop, channels]);

  const saveLocation = async () => {
    await api.patch('/v1/me', {
      state: loc.state || null, district: loc.district || null, subdistrict: loc.subdistrict || null, village: loc.village || null, pincode: loc.pincode || null,
      ...(geo ? { latitude: geo.latitude, longitude: geo.longitude, location_consent: true } : {}),
    });
  };
  const saveFarm = async () => {
    if (!farm.total_area && !crop.crop_id && !farm.name) return;
    const f = await api.post('/v1/farms', {
      name: farm.name || 'My farm', state: loc.state || null, district: loc.district || null, subdistrict: loc.subdistrict || null, village: loc.village || null,
      pincode: loc.pincode || null, total_area: farm.total_area ? Number(farm.total_area) : null, area_unit: farm.area_unit,
      ownership: farm.ownership || null, irrigation_method: farm.irrigation_method || null, latitude: geo?.latitude ?? null, longitude: geo?.longitude ?? null,
    }).catch((e) => { if (e.code === 'duplicate') return null; throw e; });
    if (f && crop.crop_id) await api.post('/v1/cycles', { farm_id: f.farm.id, crop_id: crop.crop_id, sowing_date: crop.sowing_date });
  };
  const finish = async () => {
    if (password && !user?.has_password) await api.post('/auth/set-password', { new_password: password });
    await api.patch('/v1/me', { notify_channels: channels, onboarding_complete: true });
    const me = await api.get('/v1/me');
    setUser(me.user);
    try { localStorage.removeItem(KEY); } catch { /* ignore */ }
    setFinished(true);
  };

  const next = async () => {
    setBusy(true); setErr(null);
    try {
      if (step === 0) await saveLocation();
      if (step === 1) await saveFarm();
      if (step === 2) { await finish(); return; }
      setStep(step + 1);
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const skipAll = async () => {
    setBusy(true);
    try { await api.patch('/v1/me', { onboarding_complete: true }); setUser((await api.get('/v1/me')).user); nav('/', { replace: true }); }
    catch (e) { setErr(e); } finally { setBusy(false); }
  };

  if (finished) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-emerald-50 px-4">
        <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <CheckCircle2 className="mx-auto h-16 w-16 text-emerald-600" aria-hidden />
          <h1 className="mt-3 text-2xl font-bold">Your account is ready</h1>
          <p className="mt-2 text-gray-600">You can sell crops, book storage and get advice. Sign in next time with your mobile number and an SMS code{password ? ' or your password' : ''}.</p>
          <Button size="lg" className="mt-6 w-full" onClick={() => nav('/', { replace: true })}>Open my dashboard</Button>
        </div>
      </div>
    );
  }

  const steps = [
    {
      title: 'Where is your farm?', voice: 'Step 2 of 4. Choose your state and type your district, mandal and village. You can also search your village.',
      body: (
        <div className="space-y-3">
          <AadhaarQrFill compact onFilled={(d) => { const a = aadhaarLocation(d); setLoc((l: any) => Object.fromEntries(Object.entries({ ...l, ...a }).map(([k, v]) => [k, v || l[k] || '']))); }} />
          <Field label="State" hint="Example: Telangana">{(id) => <Select id={id} className="py-3 text-lg" value={loc.state} onChange={(e) => setLoc({ ...loc, state: e.target.value })} options={INDIAN_STATES} placeholder="Select state" />}</Field>
          <Field label="District" hint="Example: Warangal">{(id) => <Input id={id} className="py-3 text-lg" value={loc.district} onChange={(e) => setLoc({ ...loc, district: e.target.value })} />}</Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mandal / Taluka">{(id) => <Input id={id} className="py-3 text-lg" value={loc.subdistrict} onChange={(e) => setLoc({ ...loc, subdistrict: e.target.value })} />}</Field>
            <Field label="Village">{(id) => <Input id={id} className="py-3 text-lg" value={loc.village} onChange={(e) => setLoc({ ...loc, village: e.target.value })} />}</Field>
          </div>
          <Field label="PIN code (if you know it)">{(id) => <Input id={id} className="py-3 text-lg" inputMode="numeric" maxLength={6} value={loc.pincode} onChange={(e) => setLoc({ ...loc, pincode: e.target.value })} />}</Field>
          <LocationPicker label="Find your village on the map (optional)" onPick={(p) => {
            setGeo({ latitude: p.latitude, longitude: p.longitude, gps: p.gps });
            setLoc((l: any) => ({ ...l, state: l.state || p.state || '', district: l.district || p.district || '', village: l.village || (p.gps ? '' : p.name) }));
          }} />
          {geo && <Notice tone="ok">Location saved for weather and nearby storage.</Notice>}
        </div>
      ),
    },
    {
      title: 'Your farm (optional)', voice: 'Step 3 of 4. Tell us your farm size and what you grow. You can skip this.',
      body: (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Farm size" hint="Approximate">{(id) => <Input id={id} className="py-3 text-lg" type="number" min="0" step="0.1" value={farm.total_area} onChange={(e) => setFarm({ ...farm, total_area: e.target.value })} />}</Field>
            <Field label="Unit">{(id) => <Select id={id} className="py-3 text-lg" value={farm.area_unit} onChange={(e) => setFarm({ ...farm, area_unit: e.target.value })} options={['acre', 'hectare', 'guntha', 'cent', 'bigha'].map((u) => ({ value: u, label: u }))} />}</Field>
          </div>
          <Field label="Land">{(id) => <Select id={id} className="py-3 text-lg" value={farm.ownership} onChange={(e) => setFarm({ ...farm, ownership: e.target.value })} placeholder="Prefer not to say"
            options={[{ value: 'owned', label: 'Own land' }, { value: 'leased', label: 'Leased / tenant' }, { value: 'shared', label: 'Sharecropping' }, { value: 'other', label: 'Other' }]} />}</Field>
          <Field label="Irrigation">{(id) => <Select id={id} className="py-3 text-lg" value={farm.irrigation_method} onChange={(e) => setFarm({ ...farm, irrigation_method: e.target.value })} placeholder="Skip"
            options={['rainfed', 'canal', 'borewell', 'drip', 'sprinkler', 'flood', 'tank', 'other'].map((v) => ({ value: v, label: v }))} />}</Field>
          <Field label="Crop you are growing now">{(id) => <CropSelect id={id} value={crop.crop_id} onChange={(v) => setCrop({ ...crop, crop_id: v })} state={loc.state} />}</Field>
          {crop.crop_id && <Field label="Sowing date">{(id) => <Input id={id} type="date" value={crop.sowing_date} onChange={(e) => setCrop({ ...crop, sowing_date: e.target.value })} />}</Field>}
          <p className="text-sm text-gray-500">Owning land is not required to sell on FARMDirect.</p>
        </div>
      ),
    },
    {
      title: 'Protect your account', voice: 'Step 4 of 4. You can add a password, or keep using SMS codes. Choose how we send you messages.',
      body: (
        <div className="space-y-4">
          {!user?.has_password ? (
            <Field label="Password (optional)" hint="You can always sign in with an SMS code. A password helps when SMS is slow. At least 8 characters.">
              {(id) => <Input id={id} type="password" autoComplete="new-password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />}
            </Field>
          ) : <Notice tone="ok">Your account has a password.</Notice>}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-gray-800">How should we tell you about offers and bookings?</legend>
            {[['in_app', 'In the app'], ['sms', 'SMS'], ['email', 'Email'], ['push', 'Phone notification']].map(([v, l]) => (
              <label key={v} className="flex items-center gap-3 text-base">
                <input type="checkbox" className="h-5 w-5" checked={channels.includes(v)} disabled={v === 'in_app'} onChange={(e) => setChannels(e.target.checked ? [...channels, v] : channels.filter((c) => c !== v))} />{l}
              </label>
            ))}
            <p className="text-xs text-gray-500">SMS, email and phone notifications are sent only when those services are set up.</p>
          </fieldset>
        </div>
      ),
    },
  ];
  const s = steps[step];

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-6">
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Step {step + 2} of 4</p><VoiceHint text={s.voice} /></div>
        <div className="my-3 h-2 rounded bg-gray-100"><div className="h-2 rounded bg-emerald-600 transition-all" style={{ width: `${((step + 2) / 4) * 100}%` }} /></div>
        <h1 className="mb-4 text-2xl font-bold">{s.title}</h1>
        {s.body}
        {err && <div className="mt-3"><ErrorBox error={err} /></div>}
        <div className="mt-6 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={skipAll} disabled={busy}>{t('skip')}</Button>
          <div className="flex gap-2">
            {step > 0 && <Button variant="outline" size="lg" onClick={() => setStep(step - 1)} disabled={busy}>{t('back')}</Button>}
            <Button size="lg" onClick={next} disabled={busy}>{busy ? <Spinner /> : step === 2 ? 'Finish' : t('next')}</Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">Your answers are saved on this phone until you finish.</p>
      </div>
    </div>
  );
}

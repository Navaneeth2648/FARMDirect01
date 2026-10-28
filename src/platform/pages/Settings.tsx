import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Settings } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../auth';
import { LANGUAGES } from '../i18n';
import { Button, ErrorBox, Field, Input, INDIAN_STATES, Modal, Notice, PageHeader, Section, Select, Spinner, fieldErrors, useToast } from '../ui';

export function SettingsPage() {
  const { user, setUser, setLang, logout } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [p, setP] = useState<any>({ ...user, email: user?.email || '', quiet_hours_start: user?.quiet_hours_start || '', quiet_hours_end: user?.quiet_hours_end || '' });
  const [err, setErr] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const [del, setDel] = useState(false);
  const [delPw, setDelPw] = useState('');
  const fe = fieldErrors(err);

  if (!user) return null;
  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const r = await api.patch('/v1/me', {
        full_name: p.full_name, email: p.email || null, language: p.language, state: p.state || null, district: p.district || null,
        subdistrict: p.subdistrict || null, village: p.village || null, pincode: p.pincode || null, notify_channels: p.notify_channels,
        quiet_hours_start: p.quiet_hours_start || null, quiet_hours_end: p.quiet_hours_end || null,
        keep_diagnosis_history: !!p.keep_diagnosis_history, location_consent: !!p.location_consent,
      });
      setUser(r.user); setLang(r.user.language); toast('Settings saved');
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Profile & Settings" icon={<Settings />} />
      <form onSubmit={save} className="space-y-4">
        <Section title="Profile">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full name" error={fe.full_name}>{(id) => <Input id={id} value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} />}</Field>
            <Field label="Mobile number" hint="Verified with OTP">{(id) => <Input id={id} value={user.phone} disabled />}</Field>
            <Field label="Email (optional)" error={fe.email}>{(id) => <Input id={id} type="email" value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} />}</Field>
            <Field label="Language">{(id) => <Select id={id} value={p.language} onChange={(e) => setP({ ...p, language: e.target.value })} options={LANGUAGES.map((l) => ({ value: l.code, label: l.label }))} />}</Field>
            <Field label="State">{(id) => <Select id={id} value={p.state || ''} onChange={(e) => setP({ ...p, state: e.target.value })} options={INDIAN_STATES} placeholder="Select" />}</Field>
            <Field label="District">{(id) => <Input id={id} value={p.district || ''} onChange={(e) => setP({ ...p, district: e.target.value })} />}</Field>
            <Field label="Mandal / Taluka">{(id) => <Input id={id} value={p.subdistrict || ''} onChange={(e) => setP({ ...p, subdistrict: e.target.value })} />}</Field>
            <Field label="Village">{(id) => <Input id={id} value={p.village || ''} onChange={(e) => setP({ ...p, village: e.target.value })} />}</Field>
            <Field label="PIN code" error={fe.pincode}>{(id) => <Input id={id} inputMode="numeric" maxLength={6} value={p.pincode || ''} onChange={(e) => setP({ ...p, pincode: e.target.value })} />}</Field>
          </div>
          <p className="mt-3 text-sm text-gray-600">Role: <b>{user.role.replace('_', ' ')}</b>{user.role !== 'farmer' && ` · verification: ${user.verification_status}`}</p>
        </Section>

        <Section title="Notifications">
          <fieldset className="flex flex-wrap gap-4">
            <legend className="sr-only">Channels</legend>
            {[['in_app', 'In-app'], ['sms', 'SMS'], ['email', 'Email'], ['push', 'Push']].map(([v, l]) => (
              <label key={v} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={p.notify_channels.includes(v)} disabled={v === 'in_app'}
                  onChange={(e) => setP({ ...p, notify_channels: e.target.checked ? [...p.notify_channels, v] : p.notify_channels.filter((c: string) => c !== v) })} />{l}
              </label>
            ))}
          </fieldset>
          <p className="mt-1 text-xs text-gray-500">SMS, email and push are delivered only when those providers are configured on the server; otherwise you still get in-app notifications.</p>
          <div className="mt-3 grid max-w-md grid-cols-2 gap-3">
            <Field label="Quiet hours from">{(id) => <Input id={id} type="time" value={p.quiet_hours_start} onChange={(e) => setP({ ...p, quiet_hours_start: e.target.value })} />}</Field>
            <Field label="to">{(id) => <Input id={id} type="time" value={p.quiet_hours_end} onChange={(e) => setP({ ...p, quiet_hours_end: e.target.value })} />}</Field>
          </div>
        </Section>

        <Section title="Privacy">
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!p.keep_diagnosis_history} onChange={(e) => setP({ ...p, keep_diagnosis_history: e.target.checked })} />
            <span>Keep my Crop Doctor history. If off, checks you do not save are deleted (with photos) after 24 hours.</span></label>
          <label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={!!p.location_consent} onChange={(e) => setP({ ...p, location_consent: e.target.checked })} />
            <span>Allow storing my precise GPS location on my profile. Turning this off removes it.</span></label>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/api/v1/me/export" className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"><Download className="h-4 w-4" />Download my data</a>
            <Button type="button" variant="destructive" size="sm" onClick={() => setDel(true)}>Delete my account</Button>
          </div>
        </Section>
        {err && <ErrorBox error={err} />}
        <Button type="submit" disabled={busy}>{busy ? <Spinner /> : 'Save settings'}</Button>
      </form>

      <Section title="Change password">
        <form className="grid max-w-xl gap-3 sm:grid-cols-3" onSubmit={async (e) => {
          e.preventDefault();
          try { await api.post('/auth/change-password', pw); toast('Password changed. Other devices were signed out.'); setPw({ current_password: '', new_password: '' }); }
          catch (err: any) { toast(err.message, 'error'); }
        }}>
          <Input type="password" aria-label="Current password" placeholder="Current" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} required />
          <Input type="password" aria-label="New password" placeholder="New (8+ chars)" autoComplete="new-password" minLength={8} value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} required />
          <Button type="submit" variant="outline">Change</Button>
        </form>
      </Section>

      <Modal open={del} onClose={() => setDel(false)} title="Delete account permanently?">
        <Notice tone="warn">This deletes your profile, farms, crops, records, photos and conversations. It cannot be undone. Download your data first if you need it.</Notice>
        <form className="mt-3 space-y-3" onSubmit={async (e) => {
          e.preventDefault();
          try { await api.del('/v1/me', { password: delPw }); await logout(); nav('/login'); }
          catch (err: any) { toast(err.message, 'error'); }
        }}>
          <Field label="Enter your password to confirm">{(id) => <Input id={id} type="password" value={delPw} onChange={(e) => setDelPw(e.target.value)} required />}</Field>
          <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDel(false)}>Cancel</Button><Button type="submit" variant="destructive">Delete forever</Button></div>
        </form>
      </Modal>
    </div>
  );
}

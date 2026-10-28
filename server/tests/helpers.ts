import request from 'supertest';
import { createApp } from '../app.ts';
import { q } from '../db/index.ts';

export const app = createApp();

let n = 0;
export async function signUp(role = 'farmer', extra: Record<string, unknown> = {}) {
  n++;
  const phone = `9${String(100000000 + n * 7919).slice(0, 9)}`;
  const agent = request.agent(app);
  const otp = await agent.post('/api/auth/otp/request').send({ phone, purpose: 'verify' });
  if (otp.status !== 200) throw new Error(`otp failed ${otp.status} ${JSON.stringify(otp.body)}`);
  const res = await agent.post('/api/auth/register').send({
    full_name: `Test ${role} ${n}`, phone, password: 'password123', otp: otp.body.devCode, role, consent: true, ...extra,
  });
  if (res.status !== 201) throw new Error(`register failed ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, user: res.body.user, phone };
}

export async function signUpAs(role: string) {
  const s = await signUp(['farmer', 'expert', 'dealer', 'field_agent', 'fpo_manager'].includes(role) ? role : 'farmer');
  q.run(`UPDATE users SET role = ?, verification_status = CASE WHEN ? IN ('expert','dealer','field_agent','fpo_manager') THEN 'verified' ELSE verification_status END WHERE id = ?`,
    role, role, s.user.id);
  // Simulate a completed MFA sign-in for staff sessions.
  q.run('UPDATE sessions SET mfa_verified = 1 WHERE user_id = ?', s.user.id);
  return s;
}

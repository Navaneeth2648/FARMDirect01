import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, signUp, signUpAs } from './helpers.ts';
import { q } from '../db/index.ts';

describe('authentication', () => {
  it('registers with OTP, keeps a session, and logs out', async () => {
    const { agent, user } = await signUp();
    expect(user.role).toBe('farmer');
    expect(user.password_hash).toBeUndefined();
    const me = await agent.get('/api/auth/me');
    expect(me.body.user.id).toBe(user.id);
    await agent.post('/api/auth/logout');
    expect((await agent.get('/api/v1/me')).status).toBe(401);
  });

  it('rejects a wrong OTP and locks after repeated failures', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/otp/request').send({ phone: '9876500001', purpose: 'verify' });
    for (let i = 0; i < 5; i++) {
      const r = await agent.post('/api/auth/register').send({ full_name: 'X Y', phone: '9876500001', password: 'password123', otp: '000000', consent: true });
      expect(r.status).toBe(400);
    }
    const locked = await agent.post('/api/auth/register').send({ full_name: 'X Y', phone: '9876500001', password: 'password123', otp: '000000', consent: true });
    expect(locked.status).toBe(429);
  });

  it('rejects expired OTPs', async () => {
    const agent = request.agent(app);
    const otp = await agent.post('/api/auth/otp/request').send({ phone: '9876500002', purpose: 'verify' });
    q.run(`UPDATE otp_codes SET expires_at = datetime('now', '-1 minute') WHERE phone = '+919876500002'`);
    const r = await agent.post('/api/auth/register').send({ full_name: 'X Y', phone: '9876500002', password: 'password123', otp: otp.body.devCode, consent: true });
    expect(r.body.code).toBe('otp_expired');
  });

  it('requires consent and validates phone numbers', async () => {
    const bad = await request(app).post('/api/auth/otp/request').send({ phone: '12345', purpose: 'verify' });
    expect(bad.status).toBe(400);
    const agent = request.agent(app);
    const otp = await agent.post('/api/auth/otp/request').send({ phone: '9876500003', purpose: 'verify' });
    const r = await agent.post('/api/auth/register').send({ full_name: 'X Y', phone: '9876500003', password: 'password123', otp: otp.body.devCode });
    expect(r.status).toBe(400);
  });

  it('logs in with password and does not reveal whether a number exists', async () => {
    const { phone } = await signUp();
    const ok = await request(app).post('/api/auth/login').send({ phone, password: 'password123' });
    expect(ok.status).toBe(200);
    const wrong = await request(app).post('/api/auth/login').send({ phone, password: 'nope-nope' });
    const missing = await request(app).post('/api/auth/login').send({ phone: '9000000000', password: 'nope-nope' });
    expect(wrong.status).toBe(401);
    expect(missing.body.error).toBe(wrong.body.error);
    const resetMissing = await request(app).post('/api/auth/otp/request').send({ phone: '9000000000', purpose: 'reset' });
    expect(resetMissing.status).toBe(200);
    expect(resetMissing.body.devCode).toBeUndefined();
  });

  it('resets the password with OTP and revokes old sessions', async () => {
    const { agent, phone } = await signUp();
    const otp = await request(app).post('/api/auth/otp/request').send({ phone, purpose: 'reset' });
    const r = await request(app).post('/api/auth/reset').send({ phone, otp: otp.body.devCode, new_password: 'newpassword1' });
    expect(r.status).toBe(200);
    expect((await agent.get('/api/v1/me')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ phone, password: 'newpassword1' })).status).toBe(200);
  });

  it('blocks suspended users', async () => {
    const { agent, user, phone } = await signUp();
    q.run(`UPDATE users SET status = 'suspended' WHERE id = ?`, user.id);
    expect((await agent.get('/api/v1/me')).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ phone, password: 'password123' })).status).toBe(403);
  });

  it('rate-limits OTP requests per number', async () => {
    let last = 0;
    for (let i = 0; i < 7; i++) {
      last = (await request(app).post('/api/auth/otp/request').set('x-test-rate-limit', '1').send({ phone: '9876500099', purpose: 'login' })).status;
    }
    expect(last).toBe(429);
  });
});

describe('authorization', () => {
  it('denies admin endpoints to farmers and unverified experts', async () => {
    const { agent } = await signUp();
    expect((await agent.get('/api/v1/admin/stats')).status).toBe(403);
    const expert = await signUp('expert');
    expect(expert.user.verification_status).toBe('pending');
    expect((await expert.agent.get('/api/v1/expert/cases')).status).toBe(403);
  });

  it('allows verified experts into the expert workspace', async () => {
    const { agent } = await signUpAs('expert');
    expect((await agent.get('/api/v1/expert/cases')).status).toBe(200);
  });

  it('only super admins can create admins', async () => {
    const admin = await signUpAs('admin');
    const target = await signUp();
    const r = await admin.agent.patch(`/api/v1/admin/users/${target.user.id}`).send({ role: 'admin' });
    expect(r.status).toBe(403);
    const sup = await signUpAs('super_admin');
    const ok = await sup.agent.patch(`/api/v1/admin/users/${target.user.id}`).send({ role: 'admin' });
    expect(ok.status).toBe(200);
    expect(q.get<any>('SELECT COUNT(*) n FROM audit_logs WHERE action = ?', 'admin.user_update').n).toBeGreaterThan(0);
  });

  it('blocks cross-site writes', async () => {
    const { agent } = await signUp();
    const r = await agent.post('/api/v1/farms').set('Origin', 'https://evil.example').send({ name: 'X' });
    expect(r.status).toBe(403);
  });
});

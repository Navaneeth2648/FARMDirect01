import { describe, it, expect } from 'vitest';
import { signUp } from './helpers.ts';
import { q } from '../db/index.ts';
import { addDays } from '../services/cropStage.ts';

const today = () => new Date().toISOString().slice(0, 10);

describe('farms, plots and crop cycles', () => {
  it('creates farms and plots, scoped to the owner', async () => {
    const a = await signUp();
    const b = await signUp();
    const farm = await a.agent.post('/api/v1/farms').send({ name: 'North field', state: 'Telangana', district: 'Warangal', total_area: 3, area_unit: 'acre' });
    expect(farm.status).toBe(201);
    const plot = await a.agent.post(`/api/v1/farms/${farm.body.farm.id}/plots`).send({ name: 'Plot A', area: 1.5 });
    expect(plot.status).toBe(201);
    expect((await b.agent.get(`/api/v1/farms/${farm.body.farm.id}`)).status).toBe(404);
    expect((await b.agent.post(`/api/v1/farms/${farm.body.farm.id}/plots`).send({ name: 'Hijack' })).status).toBe(404);
    const dup = await a.agent.post('/api/v1/farms').send({ name: 'North field' });
    expect(dup.status).toBe(409);
  });

  it('detects edit conflicts instead of overwriting', async () => {
    const a = await signUp();
    const farm = (await a.agent.post('/api/v1/farms').send({ name: 'Home' })).body.farm;
    q.run(`UPDATE farms SET updated_at = '2000-01-01 00:00:00' WHERE id = ?`, farm.id);
    const r = await a.agent.patch(`/api/v1/farms/${farm.id}`).send({ name: 'Home 2', updated_at: farm.updated_at });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('conflict');
  });

  it('validates input', async () => {
    const a = await signUp();
    const r = await a.agent.post('/api/v1/farms').send({ name: '', latitude: 200 });
    expect(r.status).toBe(400);
    expect(r.body.fields.length).toBeGreaterThan(0);
  });

  it('computes crop stage and generates tasks without duplicates on reschedule', async () => {
    const a = await signUp();
    const farm = (await a.agent.post('/api/v1/farms').send({ name: 'F', state: 'Telangana' })).body.farm;
    const sowing = addDays(today(), -30);
    const res = await a.agent.post('/api/v1/cycles').send({ farm_id: farm.id, crop_id: 'paddy', sowing_date: sowing, season: 'kharif' });
    expect(res.status).toBe(201);
    expect(res.body.cycle.stage.key).toBe('tillering');
    expect(res.body.warning).toBeNull();
    const id = res.body.cycle.id;
    const count = () => q.get<any>('SELECT COUNT(*) n FROM tasks WHERE crop_cycle_id = ?', id).n;
    const before = count();
    expect(before).toBeGreaterThan(10);
    // Past-due generated tasks are backfilled as skipped, not shown as overdue.
    expect(q.get<any>(`SELECT COUNT(*) n FROM tasks WHERE crop_cycle_id = ? AND status = 'pending' AND due_date < date('now', '-1 day')`, id).n).toBe(0);

    // Mark one task done and edit another; reschedule must not touch them or duplicate anything.
    const tasks = (await a.agent.get(`/api/v1/tasks?cycle_id=${id}`)).body.tasks;
    const done = tasks[0];
    await a.agent.patch(`/api/v1/tasks/${done.id}`).send({ status: 'done' });
    const edited = tasks[1];
    await a.agent.patch(`/api/v1/tasks/${edited.id}`).send({ due_date: '2030-01-01' });

    const cyc = (await a.agent.get(`/api/v1/cycles/${id}`)).body.cycle;
    await a.agent.patch(`/api/v1/cycles/${id}`).send({ sowing_date: addDays(sowing, 5), updated_at: cyc.updated_at });
    expect(count()).toBe(before);
    expect(q.get<any>('SELECT status FROM tasks WHERE id = ?', done.id).status).toBe('done');
    expect(q.get<any>('SELECT due_date FROM tasks WHERE id = ?', edited.id).due_date).toBe('2030-01-01');
  });

  it('warns when a crop is outside its configured region', async () => {
    const a = await signUp();
    const farm = (await a.agent.post('/api/v1/farms').send({ name: 'F', state: 'Kerala' })).body.farm;
    const r = await a.agent.post('/api/v1/cycles').send({ farm_id: farm.id, crop_id: 'wheat', sowing_date: today() });
    expect(r.body.warning).toMatch(/not in the configured crop list/);
  });

  it('repeating tasks schedule the next occurrence once', async () => {
    const a = await signUp();
    const t = (await a.agent.post('/api/v1/tasks').send({ title: 'Check pump', due_date: today(), repeat_days: 7 })).body.task;
    await a.agent.patch(`/api/v1/tasks/${t.id}`).send({ status: 'done' });
    await a.agent.patch(`/api/v1/tasks/${t.id}`).send({ status: 'pending' });
    await a.agent.patch(`/api/v1/tasks/${t.id}`).send({ status: 'done' });
    expect(q.get<any>(`SELECT COUNT(*) n FROM tasks WHERE title = 'Check pump' AND user_id = ?`, a.user.id).n).toBe(2);
  });

  it('records expenses and harvests and separates estimates in the summary', async () => {
    const a = await signUp();
    const farm = (await a.agent.post('/api/v1/farms').send({ name: 'F' })).body.farm;
    const cycle = (await a.agent.post('/api/v1/cycles').send({ farm_id: farm.id, crop_id: 'cotton', sowing_date: today() })).body.cycle;
    await a.agent.post('/api/v1/records/expenses').send({ farm_id: farm.id, crop_cycle_id: cycle.id, category: 'seeds', amount_inr: 4000, date: today() });
    await a.agent.post('/api/v1/records/expenses').send({ farm_id: farm.id, crop_cycle_id: cycle.id, category: 'labor', amount_inr: 9000, date: today(), is_estimate: true });
    await a.agent.post('/api/v1/records/harvests').send({ farm_id: farm.id, crop_cycle_id: cycle.id, date: today(), quantity: 10, sold_quantity: 8, price_per_unit_inr: 7000 });
    const s = (await a.agent.get('/api/v1/finance/summary')).body.byCycle[0];
    expect(s.cost_actual).toBe(4000);
    expect(s.cost_estimated).toBe(9000);
    expect(s.revenue_actual).toBe(56000);
    expect(s.profit_actual).toBe(52000);
    expect((await a.agent.post('/api/v1/records/expenses').send({ farm_id: farm.id, category: 'seeds', amount_inr: -5, date: today() })).status).toBe(400);
  });

  it('interprets soil tests with Soil Health Card ratings', async () => {
    const a = await signUp();
    const farm = (await a.agent.post('/api/v1/farms').send({ name: 'F' })).body.farm;
    const t = (await a.agent.post('/api/v1/records/soil-tests').send({ farm_id: farm.id, sample_date: today(), ph: 5.9, organic_carbon: 0.4, nitrogen: 300, phosphorus: 8 })).body.item;
    const r = (await a.agent.get(`/api/v1/advisory/soil/${t.id}`)).body;
    const by = Object.fromEntries(r.items.map((i: any) => [i.parameter, i.rating]));
    expect(by.pH).toBe('acidic');
    expect(by['Organic carbon']).toBe('low');
    expect(by['Available nitrogen']).toBe('medium');
    expect(by['Available phosphorus']).toBe('low');
  });

  it('exports and deletes account data', async () => {
    const a = await signUp();
    await a.agent.post('/api/v1/farms').send({ name: 'F' });
    const exp = await a.agent.get('/api/v1/me/export');
    expect(exp.body.farms.length).toBe(1);
    expect((await a.agent.delete('/api/v1/me').send({ password: 'wrong' })).status).toBe(400);
    expect((await a.agent.delete('/api/v1/me').send({ password: 'password123' })).status).toBe(200);
    expect(q.get('SELECT 1 FROM farms WHERE user_id = ?', a.user.id)).toBeUndefined();
  });
});

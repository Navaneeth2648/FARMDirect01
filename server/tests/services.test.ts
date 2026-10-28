import { describe, it, expect, vi, afterEach } from 'vitest';
import { signUp, signUpAs } from './helpers.ts';
import { q } from '../db/index.ts';
import { evaluate, sprayWindows } from '../services/agroRules.ts';
import { parseRecords, normaliseDate } from '../providers/mandi.ts';
import { notify } from '../services/notify.ts';
import { sniffImage } from '../routes/diagnosis.ts';
import { makeCode, normaliseCode } from '../routes/products.ts';
import { spamCheck } from '../routes/community.ts';
import type { Forecast } from '../providers/weather.ts';

function forecast(over: { rain?: number[]; tmax?: number[]; tmin?: number[]; wind?: number; gust?: number[]; et0?: number[]; rainProb?: number } = {}): Forecast {
  const days = 9;
  const hours = days * 24;
  const start = new Date('2026-10-28T00:00:00Z');
  const ht = Array.from({ length: hours }, (_, i) => new Date(start.getTime() + i * 3600_000).toISOString().slice(0, 16));
  const dt = Array.from({ length: days }, (_, i) => ht[i * 24].slice(0, 10));
  const fill = <T>(a: T[] | undefined, d: T, n: number) => Array.from({ length: n }, (_, i) => a?.[i] ?? d);
  return {
    latitude: 17, longitude: 78, timezone: 'Asia/Kolkata',
    current: { time: ht[0], temperature_2m: 28, apparent_temperature: 30, relative_humidity_2m: 60, precipitation: 0, weather_code: 1, cloud_cover: 20, wind_speed_10m: 5, wind_direction_10m: 90 },
    hourly: {
      time: ht, temperature_2m: fill([], 28, hours), relative_humidity_2m: fill([], 60, hours),
      precipitation_probability: fill([], over.rainProb ?? 5, hours), precipitation: fill([], 0, hours), wind_speed_10m: fill([], over.wind ?? 5, hours),
    },
    daily: {
      time: dt, weather_code: fill([], 1, days), temperature_2m_max: fill(over.tmax, 32, days), temperature_2m_min: fill(over.tmin, 20, days),
      precipitation_sum: fill(over.rain, 0, days), precipitation_probability_max: fill([], 10, days), wind_speed_10m_max: fill([], 10, days),
      wind_gusts_10m_max: fill(over.gust, 20, days), uv_index_max: fill([], 7, days), sunrise: fill([], `${dt[0]}T06:00`, days), sunset: fill([], `${dt[0]}T18:00`, days),
      et0_fao_evapotranspiration: fill(over.et0, 5, days),
    },
  };
}

const cotton = { id: 'c1', crop_id: 'cotton', crop_name: 'Cotton', stage_key: 'flowering', stage_name: 'Flowering', water_need: 'critical' };

describe('weather agronomy rules', () => {
  it('issues nothing when the user has no crops, regardless of weather', () => {
    expect(evaluate(forecast({ rain: [150, 150, 150], tmax: [45, 45, 45] }), [])).toEqual([]);
  });

  it('recommends irrigation for a critical stage in dry, high-ET weather', () => {
    const recs = evaluate(forecast({ et0: [6, 6, 6] }), [cotton]);
    expect(recs.find((r) => r.id === 'irrigation-plan')?.severity).toBe('advisory');
  });

  it('defers irrigation and fertiliser when significant rain is coming', () => {
    const recs = evaluate(forecast({ rain: [15, 15] }), [cotton], [{ id: 't', category: 'fertilizer', title: 'Top dress', due_date: '2026-10-29' }]);
    expect(recs.map((r) => r.id)).toEqual(expect.arrayContaining(['irrigation-defer', 'fertilizer-defer']));
  });

  it('flags waterlogging only for non-paddy crops', () => {
    const paddy = { ...cotton, crop_id: 'paddy', crop_name: 'Paddy', stage_key: 'tillering' };
    expect(evaluate(forecast({ rain: [70, 40, 10] }), [paddy]).some((r) => r.id === 'waterlogging')).toBe(false);
    expect(evaluate(forecast({ rain: [70, 40, 10] }), [paddy]).some((r) => r.id === 'paddy-bunds')).toBe(true);
    expect(evaluate(forecast({ rain: [70, 40, 10] }), [cotton]).some((r) => r.id === 'waterlogging')).toBe(true);
  });

  it('applies a lower heat threshold at sensitive stages only', () => {
    const veg = { ...cotton, stage_key: 'vegetative', stage_name: 'Vegetative', water_need: 'medium' };
    expect(evaluate(forecast({ tmax: [38, 38, 38] }), [cotton]).some((r) => r.type === 'heat')).toBe(true);
    expect(evaluate(forecast({ tmax: [38, 38, 38] }), [veg]).some((r) => r.type === 'heat')).toBe(false);
  });

  it('finds spray windows only in calm, dry hours', () => {
    expect(sprayWindows(forecast()).length).toBeGreaterThan(0);
    expect(sprayWindows(forecast({ wind: 25 })).length).toBe(0);
    expect(evaluate(forecast({ wind: 25 }), [cotton]).some((r) => r.id === 'spray-none')).toBe(true);
  });
});

describe('weather API failure handling', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns 503 when the provider is down and there is no cache', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const a = await signUp();
    const r = await a.agent.get('/api/v1/weather?lat=10.123&lon=76.456');
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('provider_unavailable');
  });

  it('rejects provider responses that fail validation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ hello: 'world' }), { status: 200 })));
    const a = await signUp();
    expect((await a.agent.get('/api/v1/weather?lat=11.5&lon=77.5')).status).toBe(503);
  });

  it('serves validated data and flags stale cache on later failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(forecast()), { status: 200 })));
    const a = await signUp();
    const ok = await a.agent.get('/api/v1/weather?lat=12.5&lon=77.5');
    expect(ok.status).toBe(200);
    expect(ok.body.stale).toBe(false);
    q.run(`UPDATE weather_cache SET fetched_at = datetime('now', '-2 hour')`);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const stale = await a.agent.get('/api/v1/weather?lat=12.5&lon=77.5');
    expect(stale.status).toBe(200);
    expect(stale.body.stale).toBe(true);
  });

  it('asks for a location instead of guessing', async () => {
    const a = await signUp();
    const r = await a.agent.get('/api/v1/weather');
    expect(r.body.code).toBe('no_location');
  });
});

describe('mandi price parsing', () => {
  it('normalises Agmarknet dates and numbers and drops bad rows', () => {
    expect(normaliseDate('05/10/2026')).toBe('2026-10-05');
    const rows = parseRecords({
      records: [
        { state: 'Telangana', district: 'Warangal', market: 'Warangal', commodity: 'Cotton', variety: 'Other', grade: 'FAQ', arrival_date: '27/10/2026', min_price: '6800', max_price: '7400', modal_price: '7100' },
        { state: 'Telangana', market: 'X', commodity: 'Cotton', arrival_date: 'bad-date', min_price: '1' },
        { state: 'Telangana', market: 'Y', commodity: 'Cotton', arrival_date: '27/10/2026', min_price: '9000', max_price: '100', modal_price: '500' },
        { state: 'Telangana', market: 'Z', commodity: 'Cotton', arrival_date: '27/10/2026', min_price: 'NR', max_price: '', modal_price: '7000' },
        { nonsense: true },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ arrival_date: '2026-10-27', modal_price: 7100, unit: 'INR/quintal' });
    expect(rows[1].min_price).toBeNull();
    expect(parseRecords({})).toEqual([]);
  });

  it('reports not-configured instead of fabricating prices', async () => {
    const a = await signUp();
    const status = (await a.agent.get('/api/v1/market/status')).body;
    expect(status.configured).toBe(false);
    const r = (await a.agent.get('/api/v1/market/prices?commodity=Cotton')).body;
    expect(r.prices).toEqual([]);
    expect(r.refreshError).toBe('not_configured');
  });
});

describe('notifications', () => {
  it('deduplicates by key and logs unconfigured channels', async () => {
    const a = await signUp();
    q.run(`UPDATE users SET notify_channels = '["in_app","sms"]' WHERE id = ?`, a.user.id);
    expect(notify(a.user.id, 'task', 'T', 'B', 'k1')).toBeTruthy();
    expect(notify(a.user.id, 'task', 'T', 'B', 'k1')).toBeNull();
    expect(q.get<any>('SELECT COUNT(*) n FROM notifications WHERE user_id = ?', a.user.id).n).toBe(1);
    expect(q.get<any>(`SELECT status FROM delivery_logs WHERE channel = 'sms' ORDER BY id DESC LIMIT 1`).status).toBe('not_configured');
    const list = (await a.agent.get('/api/v1/notifications')).body;
    expect(list.unread).toBe(1);
    await a.agent.post('/api/v1/notifications/read-all');
    expect((await a.agent.get('/api/v1/notifications')).body.unread).toBe(0);
  });
});

describe('crop doctor uploads', () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex');

  it('detects real image types from bytes', () => {
    expect(sniffImage(png)).toBe('image/png');
    expect(sniffImage(Buffer.from('GIF89a-not-allowed'))).toBeNull();
    expect(sniffImage(Buffer.from('<script>alert(1)</script>'))).toBeNull();
  });

  it('rejects non-images even with an image extension', async () => {
    const a = await signUp();
    const r = await a.agent.post('/api/v1/diagnosis').attach('image', Buffer.from('<html>not an image</html>'), { filename: 'leaf.jpg', contentType: 'image/jpeg' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('bad_image');
  });

  it('stores the upload but reports not_configured without an AI key, and protects the image', async () => {
    const a = await signUp();
    const other = await signUp();
    const r = await a.agent.post('/api/v1/diagnosis').field('crop_id', 'tomato').attach('image', png, { filename: 'x.png', contentType: 'image/png' });
    expect(r.status).toBe(202);
    expect(r.body.diagnosis.status).toBe('not_configured');
    expect(r.body.diagnosis.result_json).toBeNull();
    const id = r.body.diagnosis.id;
    expect((await a.agent.get(`/api/v1/diagnosis/${id}/image`)).status).toBe(200);
    expect((await other.agent.get(`/api/v1/diagnosis/${id}/image`)).status).toBe(404);
    // An unrelated verified expert can see it only after the farmer opens a case.
    const expert = await signUpAs('expert');
    expect((await expert.agent.get(`/api/v1/diagnosis/${id}`)).status).toBe(404);
    await a.agent.post(`/api/v1/diagnosis/${id}/expert`).send({ question: 'What is this spot?' });
    expect((await expert.agent.get(`/api/v1/diagnosis/${id}`)).status).toBe(200);
    expect((await a.agent.delete(`/api/v1/diagnosis/${id}/image`)).status).toBe(200);
    expect((await a.agent.get(`/api/v1/diagnosis/${id}/image`)).status).toBe(404);
  });

  it('assistant reports not configured rather than answering', async () => {
    const a = await signUp();
    const r = await a.agent.post('/api/v1/assistant/messages').send({ message: 'When should I irrigate cotton?' });
    expect(r.status).toBe(503);
    expect(r.body.code).toBe('not_configured');
  });
});

describe('product verification', () => {
  it('rejects forged codes, verifies genuine ones once, and flags replays', async () => {
    const admin = await signUpAs('admin');
    const farmer = await signUp();
    const p = (await admin.agent.post('/api/v1/products').send({ name: 'Test Seed', manufacturer: 'Acme Seeds', category: 'seeds', data_source: 'Manufacturer label' })).body.product;
    await admin.agent.patch(`/api/v1/products/${p.id}`).send({ status: 'published' });
    const batch = (await admin.agent.post('/api/v1/verify/batches').send({ product_id: p.id, batch_no: 'B1', issuer_name: 'Acme Seeds', count: 3 })).body;
    expect(batch.codes).toHaveLength(3);
    expect(q.get('SELECT 1 FROM verification_codes WHERE code_hash = ?', batch.codes[0])).toBeUndefined(); // raw codes not stored

    const forged = (await farmer.agent.post('/api/v1/verify').send({ code: 'FD-AAAAAAAAAAAAAAAA-0000' })).body;
    expect(forged.result).toBe('invalid');
    const unknown = (await farmer.agent.post('/api/v1/verify').send({ code: makeCode() })).body;
    expect(unknown.result).toBe('invalid');
    const first = (await farmer.agent.post('/api/v1/verify').send({ code: `https://x.test/v?c=${batch.codes[0]}` })).body;
    expect(first.result).toBe('valid');
    expect(first.product.name).toBe('Test Seed');
    const second = (await farmer.agent.post('/api/v1/verify').send({ code: batch.codes[0] })).body;
    expect(second.result).toBe('already_used');
    expect(normaliseCode(batch.codes[1].toLowerCase())).toBe(batch.codes[1]);
    expect((await farmer.agent.post('/api/v1/verify/batches').send({ product_id: p.id, batch_no: 'B2', issuer_name: 'x', count: 1 })).status).toBe(403);
  });
});

describe('community and providers', () => {
  it('holds scam-like posts for moderation', () => {
    expect(spamCheck('Guaranteed profit! double your money, whatsapp me').hold).toBe(true);
    expect(spamCheck('My chilli leaves are curling, any advice?').hold).toBe(false);
  });

  it('only lists verified providers', async () => {
    const owner = await signUp();
    const admin = await signUpAs('admin');
    const p = (await owner.agent.post('/api/v1/providers').send({ name: 'Green Soil Lab', category: 'soil_lab', state: 'Telangana', district: 'Warangal' })).body.provider;
    expect((await owner.agent.get('/api/v1/providers')).body.providers.find((x: any) => x.id === p.id)).toBeUndefined();
    const queue = await admin.agent.get('/api/v1/admin/providers?status=pending');
    expect(queue.status).toBe(200);
    expect(queue.body.providers.some((x: any) => x.id === p.id)).toBe(true);
    await admin.agent.post(`/api/v1/admin/providers/${p.id}/verify`).send({ decision: 'verified' });
    expect((await owner.agent.get('/api/v1/providers')).body.providers.find((x: any) => x.id === p.id)).toBeTruthy();
  });

  it('runs the content review workflow and filters published items', async () => {
    const editor = await signUpAs('content_editor');
    const farmer = await signUp();
    const c = (await editor.agent.post('/api/v1/content').send({ type: 'news', title: 'Kisan mela in Warangal', body: 'Details', language: 'en' })).body.item;
    expect((await farmer.agent.get('/api/v1/content?kind=news')).body.items).toHaveLength(0);
    expect((await farmer.agent.get(`/api/v1/content/${c.id}`)).status).toBe(404);
    await editor.agent.post(`/api/v1/content/${c.id}/publish`);
    const list = await farmer.agent.get('/api/v1/content?kind=news&lang=en&q=mela');
    expect(list.status).toBe(200);
    expect(list.body.items.map((x: any) => x.id)).toContain(c.id);
    expect((await farmer.agent.get('/api/v1/content?kind=knowledge')).body.items).toHaveLength(0);
    const unsafe = (await editor.agent.post('/api/v1/content').send({ type: 'guide', title: 'Spray guide', body: 'x', safety_critical: true })).body.item;
    expect((await editor.agent.post(`/api/v1/content/${unsafe.id}/publish`)).status).toBe(403);
    expect((await farmer.agent.post('/api/v1/content').send({ type: 'news', title: 'x' })).status).toBe(403);
  });

  it('deduplicates manually issued alerts and notifies affected farmers', async () => {
    const farmer = await signUp();
    await farmer.agent.post('/api/v1/farms').send({ name: 'F', state: 'Punjab', district: 'Ludhiana' });
    const admin = await signUpAs('admin');
    const body = { category: 'pest', severity: 'warning', title: 'Pink bollworm reports', body: 'Reported by KVK', state: 'Punjab', source: 'KVK Ludhiana', expires_at: '2030-01-01' };
    const a1 = await admin.agent.post('/api/v1/alerts').send(body);
    const a2 = await admin.agent.post('/api/v1/alerts').send(body);
    expect(a1.status).toBe(201);
    expect(a2.body.duplicate).toBe(true);
    expect((await farmer.agent.get('/api/v1/alerts')).body.alerts.some((a: any) => a.title === 'Pink bollworm reports')).toBe(true);
    expect((await farmer.agent.post('/api/v1/alerts').send(body)).status).toBe(403);
  });
});

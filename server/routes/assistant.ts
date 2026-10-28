import { Router } from 'express';
import { z } from 'zod';
import { q, out, type Row } from '../db/index.ts';
import { ah, HttpError, id, notFound, parse } from '../lib/http.ts';
import { rateLimit } from '../lib/security.ts';
import { aiConfigured, chat } from '../providers/ai.ts';
import { NotConfiguredError } from '../providers/fetcher.ts';
import { getForecast } from '../providers/weather.ts';
import { cycleWithStage } from '../services/cropStage.ts';
import { marketplaceContext, suggestActions } from '../services/medha.ts';

export const assistantRouter = Router();

const LANG_NAMES: Record<string, string> = { en: 'English', hi: 'Hindi', te: 'Telugu', ml: 'Malayalam' };

/** Builds the VERIFIED DATA block from our own services so the model never has to guess facts. */
async function buildContext(userId: string, role: string, farmId: string | null, question: string) {
  const sources: { type: string; label: string; detail?: string }[] = [];
  const lines: string[] = [];
  const user = q.get<Row>('SELECT language, state, district FROM users WHERE id = ?', userId)!;
  lines.push(`REPLY LANGUAGE: ${LANG_NAMES[user.language] || 'English'} (write the whole answer in this language). User role: ${role}. Region: ${[user.district, user.state].filter(Boolean).join(', ') || 'unknown'}.`);

  const farm = farmId
    ? q.get<Row>('SELECT * FROM farms WHERE id = ? AND user_id = ?', farmId, userId)
    : q.get<Row>('SELECT * FROM farms WHERE user_id = ? ORDER BY created_at LIMIT 1', userId);
  if (farm) {
    lines.push(`Farm: ${farm.name}, ${[farm.village, farm.district, farm.state].filter(Boolean).join(', ')}; irrigation: ${farm.irrigation_method || 'unknown'}; soil: ${farm.soil_type || 'unknown'}.`);
    const cycles = q.all<Row>(
      `SELECT cc.*, c.name AS crop_name FROM crop_cycles cc JOIN crops c ON c.id = cc.crop_id WHERE cc.farm_id = ? AND cc.status = 'active'`, farm.id)
      .map(cycleWithStage);
    for (const c of cycles as any[]) {
      lines.push(`Active crop: ${c.crop_name}${c.variety ? ` (${c.variety})` : ''}, sown ${c.sowing_date}, day ${c.current_day}, stage: ${c.stage?.name ?? 'not started'}.`);
      if (c.stage) {
        const adv = q.all<Row>(`SELECT title, body, review_status FROM advisories WHERE crop_id = ? AND stage_key = ? AND review_status != 'rejected' LIMIT 3`, c.crop_id, c.stage.key);
        for (const a of adv) {
          lines.push(`ADVISORY RECORD "${a.title}" (${a.review_status === 'approved' ? 'expert-approved' : 'general guidance, awaiting expert review'}): ${a.body}`);
          sources.push({ type: 'advisory', label: a.title, detail: a.review_status });
        }
      }
    }
    if (farm.latitude != null && farm.longitude != null) {
      try {
        const w = await getForecast(farm.latitude, farm.longitude);
        const d = w.forecast.daily;
        const days = d.time.slice(0, 5).map((t, i) =>
          `${t}: ${d.temperature_2m_min[i]}–${d.temperature_2m_max[i]}°C, rain ${d.precipitation_sum[i]} mm (${d.precipitation_probability_max[i]}%)`).join('; ');
        lines.push(`WEATHER [source: Open-Meteo forecast, fetched ${w.fetchedAt}${w.stale ? ', STALE' : ''}]: now ${w.forecast.current.temperature_2m}°C, humidity ${w.forecast.current.relative_humidity_2m}%. Next days: ${days}.`);
        sources.push({ type: 'weather', label: 'Open-Meteo forecast', detail: w.fetchedAt });
      } catch {
        lines.push('WEATHER: unavailable right now.');
      }
    } else {
      lines.push('WEATHER: farm location not set, so no forecast is available.');
    }
  }

  // Prices: only stored, sourced records for crops mentioned or grown.
  const crops = q.all<Row>('SELECT name, agmarknet_name FROM crops');
  const lc = question.toLowerCase();
  const mentioned = crops.filter((c) => lc.includes(c.name.split(' ')[0].toLowerCase()) || (c.agmarknet_name && lc.includes(c.agmarknet_name.split('(')[0].toLowerCase())));
  for (const c of mentioned.slice(0, 2)) {
    const rows = q.all<Row>(
      `SELECT market, district, state, modal_price, min_price, max_price, arrival_date FROM market_prices WHERE commodity = ?
       ${user.state ? 'AND state = ?' : ''} ORDER BY arrival_date DESC LIMIT 5`, ...(user.state ? [c.agmarknet_name, user.state] : [c.agmarknet_name]));
    if (rows.length) {
      lines.push(`MANDI PRICES for ${c.name} [source: Agmarknet/data.gov.in, INR/quintal]: ` +
        rows.map((r) => `${r.market} (${r.district}) ${r.arrival_date}: modal ${r.modal_price}, range ${r.min_price}–${r.max_price}`).join('; '));
      sources.push({ type: 'market', label: `Agmarknet – ${c.name}`, detail: rows[0].arrival_date });
    } else {
      lines.push(`MANDI PRICES for ${c.name}: no stored records available.`);
    }
  }
  const mk = marketplaceContext(userId, role, farm);
  lines.push(...mk.lines);
  sources.push(...mk.sources);
  return { block: `VERIFIED DATA (use only this for facts):\n${lines.join('\n')}`, sources };
}

assistantRouter.get('/status', (_req, res) => {
  res.json({ configured: aiConfigured(), setup: aiConfigured() ? null : 'Set GEMINI_API_KEY on the server to enable Medha AI.' });
});

assistantRouter.get('/conversations', ah(async (req, res) => {
  res.json({ conversations: q.all('SELECT * FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50', req.user!.id) });
}));

assistantRouter.get('/conversations/:id', ah(async (req, res) => {
  const c = q.get<Row>('SELECT * FROM conversations WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  if (!c) throw notFound('Conversation');
  res.json({ conversation: c, messages: q.all<Row>('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at', c.id).map(out) });
}));

assistantRouter.delete('/conversations/:id', ah(async (req, res) => {
  q.run('DELETE FROM conversations WHERE id = ? AND user_id = ?', req.params.id, req.user!.id);
  res.json({ ok: true });
}));

assistantRouter.delete('/conversations', ah(async (req, res) => {
  q.run('DELETE FROM conversations WHERE user_id = ?', req.user!.id);
  res.json({ ok: true });
}));

assistantRouter.post('/messages',
  rateLimit({ name: 'assistant', windowMs: 60 * 60_000, max: 60, key: (r) => r.user!.id }),
  ah(async (req, res) => {
    const b = parse(z.object({
      conversation_id: z.string().optional().nullable(), farm_id: z.string().optional().nullable(),
      message: z.string().trim().min(1).max(2000),
    }), req.body);
    const uid = req.user!.id;
    let conv: Row | undefined;
    if (b.conversation_id) {
      conv = q.get<Row>('SELECT * FROM conversations WHERE id = ? AND user_id = ?', b.conversation_id, uid);
      if (!conv) throw notFound('Conversation');
    } else {
      const cid = id();
      q.run('INSERT INTO conversations (id, user_id, title, farm_id) VALUES (?, ?, ?, ?)', cid, uid, b.message.slice(0, 60), b.farm_id ?? null);
      conv = q.get<Row>('SELECT * FROM conversations WHERE id = ?', cid)!;
    }
    q.run(`INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, 'user', ?)`, id(), conv.id, b.message);
    q.run(`INSERT INTO usage_events (user_id, module) VALUES (?, 'assistant')`, uid);

    const history = q.all<Row>('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 12', conv.id).reverse();
    const ctx = await buildContext(uid, req.user!.role, b.farm_id ?? conv.farm_id ?? null, b.message);
    let reply: string;
    try {
      reply = await chat(history as any, ctx.block);
    } catch (e) {
      if (e instanceof NotConfiguredError) throw new HttpError(503, 'Medha AI is not configured on this server yet.', 'not_configured', { setup: e.setup, actions: suggestActions(b.message, req.user!.role) });
      throw new HttpError(503, 'Medha AI is unavailable right now. Please try again.', 'provider_unavailable', { actions: suggestActions(b.message, req.user!.role) });
    }
    if (!reply) throw new HttpError(503, 'The assistant could not produce an answer. Please rephrase and try again.', 'empty_reply');
    const escalate = reply.startsWith('[ESCALATE]');
    const content = escalate ? reply.replace('[ESCALATE]', '').trim() : reply;
    const mid = id();
    const actions = suggestActions(b.message, req.user!.role);
    q.run(`INSERT INTO messages (id, conversation_id, role, content, sources, escalate, actions) VALUES (?, ?, 'assistant', ?, ?, ?, ?)`,
      mid, conv.id, content, JSON.stringify(ctx.sources), escalate ? 1 : 0, JSON.stringify(actions));
    q.run(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?`, conv.id);
    res.json({ conversation: conv, message: out(q.get('SELECT * FROM messages WHERE id = ?', mid)) });
  }));

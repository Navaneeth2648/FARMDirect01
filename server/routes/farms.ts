import { Router, type Request } from 'express';
import { z } from 'zod';
import { q, out, insert, updateSet, type Row } from '../db/index.ts';
import { ah, HttpError, id, notFound, parse, zDate, zLat, zLon, zOptText, zText } from '../lib/http.ts';
import { cycleWithStage } from '../services/cropStage.ts';
import { syncCycleTasks } from '../services/schedule.ts';

export const farmsRouter = Router();

const UNITS = ['acre', 'hectare', 'guntha', 'cent', 'bigha'] as const;

export function ownFarm(req: Request, farmId: string) {
  const farm = q.get<Row>('SELECT * FROM farms WHERE id = ? AND user_id = ?', farmId, req.user!.id);
  if (!farm) throw notFound('Farm');
  return farm;
}

function ownCycle(req: Request, cycleId: string) {
  const c = q.get<Row>('SELECT * FROM crop_cycles WHERE id = ? AND user_id = ?', cycleId, req.user!.id);
  if (!c) throw notFound('Crop cycle');
  return c;
}

/** Optimistic concurrency: reject an update if the record changed since the client loaded it. */
function checkVersion(row: Row, expected?: string) {
  if (expected && expected !== row.updated_at) {
    throw new HttpError(409, 'This record was changed on another device. Reload to see the latest version before saving.', 'conflict', { current: out(row) });
  }
}

const FarmSchema = z.object({
  name: zText(100),
  state: zOptText(80), district: zOptText(80), subdistrict: zOptText(80), village: zOptText(80),
  pincode: z.string().regex(/^\d{6}$/).optional().nullable().or(z.literal('').transform(() => null)),
  latitude: zLat.optional().nullable(), longitude: zLon.optional().nullable(),
  total_area: z.number().positive().max(100000).optional().nullable(),
  area_unit: z.enum(UNITS).default('acre'),
  ownership: z.enum(['owned', 'leased', 'shared', 'other']).optional().nullable(),
  irrigation_method: z.enum(['rainfed', 'canal', 'borewell', 'drip', 'sprinkler', 'flood', 'tank', 'other']).optional().nullable(),
  water_source: zOptText(100),
  soil_type: zOptText(60),
});

// ---------- Farms ----------
farmsRouter.get('/', ah(async (req, res) => {
  const farms = q.all<Row>('SELECT * FROM farms WHERE user_id = ? ORDER BY created_at', req.user!.id);
  const plots = q.all<Row>('SELECT p.* FROM plots p JOIN farms f ON f.id = p.farm_id WHERE f.user_id = ? ORDER BY p.created_at', req.user!.id);
  res.json({ farms: farms.map((f) => ({ ...f, plots: plots.filter((p) => p.farm_id === f.id) })) });
}));

farmsRouter.post('/', ah(async (req, res) => {
  const data = parse(FarmSchema, req.body);
  const fid = id();
  insert('farms', { id: fid, user_id: req.user!.id, ...data });
  res.status(201).json({ farm: q.get('SELECT * FROM farms WHERE id = ?', fid) });
}));

farmsRouter.get('/:farmId', ah(async (req, res) => {
  const farm = ownFarm(req, req.params.farmId);
  res.json({ farm: { ...farm, plots: q.all('SELECT * FROM plots WHERE farm_id = ?', farm.id) } });
}));

farmsRouter.patch('/:farmId', ah(async (req, res) => {
  const farm = ownFarm(req, req.params.farmId);
  checkVersion(farm, req.body?.updated_at);
  const { updated_at: _v, ...rest } = req.body || {};
  const set = updateSet(parse(FarmSchema.partial(), rest));
  if (!set.empty) q.run(`UPDATE farms SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, farm.id);
  res.json({ farm: q.get('SELECT * FROM farms WHERE id = ?', farm.id) });
}));

farmsRouter.delete('/:farmId', ah(async (req, res) => {
  const farm = ownFarm(req, req.params.farmId);
  q.run('DELETE FROM farms WHERE id = ?', farm.id);
  res.json({ ok: true });
}));

// ---------- Plots ----------
const PlotSchema = z.object({
  name: zText(100),
  area: z.number().positive().max(100000).optional().nullable(),
  area_unit: z.enum(UNITS).default('acre'),
  soil_type: zOptText(60),
  irrigation_method: zOptText(40),
  boundary_geojson: z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(z.tuple([zLon, zLat]))).min(1) }).optional().nullable(),
});

farmsRouter.post('/:farmId/plots', ah(async (req, res) => {
  const farm = ownFarm(req, req.params.farmId);
  const data = parse(PlotSchema, req.body);
  const pid = id();
  insert('plots', { id: pid, farm_id: farm.id, ...data });
  res.status(201).json({ plot: q.get('SELECT * FROM plots WHERE id = ?', pid) });
}));

farmsRouter.patch('/:farmId/plots/:plotId', ah(async (req, res) => {
  const farm = ownFarm(req, req.params.farmId);
  const plot = q.get<Row>('SELECT * FROM plots WHERE id = ? AND farm_id = ?', req.params.plotId, farm.id);
  if (!plot) throw notFound('Plot');
  checkVersion(plot, req.body?.updated_at);
  const { updated_at: _v, ...rest } = req.body || {};
  const set = updateSet(parse(PlotSchema.partial(), rest));
  if (!set.empty) q.run(`UPDATE plots SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, plot.id);
  res.json({ plot: q.get('SELECT * FROM plots WHERE id = ?', plot.id) });
}));

farmsRouter.delete('/:farmId/plots/:plotId', ah(async (req, res) => {
  const farm = ownFarm(req, req.params.farmId);
  q.run('DELETE FROM plots WHERE id = ? AND farm_id = ?', req.params.plotId, farm.id);
  res.json({ ok: true });
}));

// ---------- Crop cycles ----------
export const cyclesRouter = Router();

const CycleSchema = z.object({
  farm_id: z.string(),
  plot_id: z.string().optional().nullable(),
  crop_id: z.string(),
  variety: zOptText(100),
  season: z.enum(['kharif', 'rabi', 'zaid', 'annual']).optional().nullable(),
  sowing_date: zDate,
  area: z.number().positive().max(100000).optional().nullable(),
  area_unit: z.enum(UNITS).default('acre'),
  status: z.enum(['planned', 'active', 'harvested', 'abandoned']).default('active'),
  actual_harvest_date: zDate.optional().nullable(),
  notes: zOptText(1000),
});

const cycleQuery = `SELECT cc.*, c.name AS crop_name, c.category, f.name AS farm_name, p.name AS plot_name
  FROM crop_cycles cc JOIN crops c ON c.id = cc.crop_id JOIN farms f ON f.id = cc.farm_id LEFT JOIN plots p ON p.id = cc.plot_id`;

cyclesRouter.get('/', ah(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : null;
  const rows = q.all<Row>(`${cycleQuery} WHERE cc.user_id = ? ${status ? 'AND cc.status = ?' : ''} ORDER BY cc.sowing_date DESC`,
    ...(status ? [req.user!.id, status] : [req.user!.id]));
  res.json({ cycles: rows.map(cycleWithStage) });
}));

cyclesRouter.post('/', ah(async (req, res) => {
  const data = parse(CycleSchema, req.body);
  const farm = ownFarm(req, data.farm_id);
  if (data.plot_id && !q.get('SELECT 1 FROM plots WHERE id = ? AND farm_id = ?', data.plot_id, farm.id)) throw notFound('Plot');
  const crop = q.get<Row>('SELECT * FROM crops WHERE id = ? AND active = 1', data.crop_id);
  if (!crop) throw notFound('Crop');
  const cid = id();
  insert('crop_cycles', { id: cid, user_id: req.user!.id, ...data });
  const cycle = q.get<Row>('SELECT * FROM crop_cycles WHERE id = ?', cid)!;
  if (cycle.status === 'active' || cycle.status === 'planned') syncCycleTasks(cycle, crop.name);
  const regions: string[] = JSON.parse(crop.regions);
  const warning = farm.state && regions.length && !regions.includes(farm.state)
    ? `${crop.name} is not in the configured crop list for ${farm.state}. Advisory may be less relevant; check with your local KVK.`
    : null;
  res.status(201).json({ cycle: cycleWithStage(q.get<Row>(`${cycleQuery} WHERE cc.id = ?`, cid)!), warning });
}));

cyclesRouter.get('/:cycleId', ah(async (req, res) => {
  ownCycle(req, req.params.cycleId);
  res.json({ cycle: cycleWithStage(q.get<Row>(`${cycleQuery} WHERE cc.id = ?`, req.params.cycleId)!) });
}));

cyclesRouter.patch('/:cycleId', ah(async (req, res) => {
  const c = ownCycle(req, req.params.cycleId);
  checkVersion(c, req.body?.updated_at);
  const { updated_at: _v, ...rest } = req.body || {};
  const data = parse(CycleSchema.partial().omit({ farm_id: true, crop_id: true }), rest);
  const set = updateSet(data);
  if (!set.empty) q.run(`UPDATE crop_cycles SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, c.id);
  const updated = q.get<Row>('SELECT * FROM crop_cycles WHERE id = ?', c.id)!;
  if (data.sowing_date && data.sowing_date !== c.sowing_date && updated.status !== 'harvested') {
    const crop = q.get<Row>('SELECT name FROM crops WHERE id = ?', c.crop_id)!;
    syncCycleTasks(updated, crop.name); // reschedules in place; no duplicates
  }
  if (data.status === 'harvested' || data.status === 'abandoned') {
    q.run(`UPDATE tasks SET status = 'skipped', updated_at = datetime('now') WHERE crop_cycle_id = ? AND status = 'pending' AND due_date > date('now')`, c.id);
  }
  res.json({ cycle: cycleWithStage(q.get<Row>(`${cycleQuery} WHERE cc.id = ?`, c.id)!) });
}));

cyclesRouter.delete('/:cycleId', ah(async (req, res) => {
  const c = ownCycle(req, req.params.cycleId);
  q.run('DELETE FROM crop_cycles WHERE id = ?', c.id);
  res.json({ ok: true });
}));

// ---------- Tasks / calendar ----------
export const tasksRouter = Router();

tasksRouter.get('/', ah(async (req, res) => {
  const from = typeof req.query.from === 'string' ? req.query.from : '0000-01-01';
  const to = typeof req.query.to === 'string' ? req.query.to : '9999-12-31';
  const cycle = typeof req.query.cycle_id === 'string' ? req.query.cycle_id : null;
  const rows = q.all<Row>(
    `SELECT t.*, c.name AS crop_name, f.name AS farm_name,
       CASE WHEN t.status = 'pending' AND t.due_date < date('now') THEN 1 ELSE 0 END AS overdue
     FROM tasks t LEFT JOIN crop_cycles cc ON cc.id = t.crop_cycle_id LEFT JOIN crops c ON c.id = cc.crop_id
     LEFT JOIN farms f ON f.id = t.farm_id
     WHERE t.user_id = ? AND t.due_date BETWEEN ? AND ? ${cycle ? 'AND t.crop_cycle_id = ?' : ''}
     ORDER BY t.due_date, t.category LIMIT 1000`,
    ...[req.user!.id, from, to, ...(cycle ? [cycle] : [])]);
  res.json({ tasks: rows });
}));

const TaskSchema = z.object({
  title: zText(200), notes: zOptText(1000), due_date: zDate,
  category: z.enum(['irrigation', 'fertilizer', 'scouting', 'sowing', 'harvest', 'spraying', 'weeding', 'custom', 'stage']).default('custom'),
  crop_cycle_id: z.string().optional().nullable(), farm_id: z.string().optional().nullable(),
  repeat_days: z.number().int().min(1).max(365).optional().nullable(),
  weather_sensitive: z.boolean().optional(),
});

tasksRouter.post('/', ah(async (req, res) => {
  const data = parse(TaskSchema, req.body);
  if (data.crop_cycle_id) ownCycle(req, data.crop_cycle_id);
  if (data.farm_id) ownFarm(req, data.farm_id);
  const tid = id();
  insert('tasks', { id: tid, user_id: req.user!.id, ...data, user_modified: 1 });
  res.status(201).json({ task: q.get('SELECT * FROM tasks WHERE id = ?', tid) });
}));

tasksRouter.patch('/:taskId', ah(async (req, res) => {
  const t = q.get<Row>('SELECT * FROM tasks WHERE id = ? AND user_id = ?', req.params.taskId, req.user!.id);
  if (!t) throw notFound('Task');
  const data = parse(TaskSchema.partial().extend({ status: z.enum(['pending', 'done', 'skipped']).optional() }), req.body);
  const extra: Record<string, unknown> = {};
  if (data.status === 'done' && t.status !== 'done') extra.completed_at = new Date().toISOString();
  if (data.status === 'pending') extra.completed_at = null;
  if (data.due_date || data.title || data.notes !== undefined) extra.user_modified = 1;
  const set = updateSet({ ...data, ...extra });
  if (!set.empty) q.run(`UPDATE tasks SET ${set.sql}, updated_at = datetime('now') WHERE id = ?`, ...set.values, t.id);
  // Repeating custom task: schedule the next occurrence once, keyed to avoid duplicates.
  if (data.status === 'done' && t.repeat_days) {
    const next = new Date(`${t.due_date}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + t.repeat_days);
    const nextDue = next.toISOString().slice(0, 10);
    const exists = q.get('SELECT 1 FROM tasks WHERE user_id = ? AND title = ? AND due_date = ?', req.user!.id, t.title, nextDue);
    if (!exists) insert('tasks', {
      id: id(), user_id: t.user_id, crop_cycle_id: t.crop_cycle_id, farm_id: t.farm_id, category: t.category, title: t.title,
      notes: t.notes, due_date: nextDue, repeat_days: t.repeat_days, weather_sensitive: t.weather_sensitive, user_modified: 1,
    });
  }
  res.json({ task: q.get('SELECT * FROM tasks WHERE id = ?', t.id) });
}));

tasksRouter.delete('/:taskId', ah(async (req, res) => {
  q.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', req.params.taskId, req.user!.id);
  res.json({ ok: true });
}));

// ---------- Generic owner-scoped farm records ----------
type RecordDef = { table: string; schema: z.ZodObject<any>; order: string };

const RECORDS: Record<string, RecordDef> = {
  activities: {
    table: 'activity_logs', order: 'date DESC',
    schema: z.object({
      farm_id: z.string(), plot_id: z.string().optional().nullable(), crop_cycle_id: z.string().optional().nullable(),
      kind: z.enum(['input_application', 'scouting', 'labor', 'equipment', 'irrigation', 'sowing', 'harvest', 'other']),
      date: zDate, details: zText(2000), quantity: z.number().min(0).optional().nullable(), unit: zOptText(30),
    }),
  },
  'soil-tests': {
    table: 'soil_tests', order: 'sample_date DESC',
    schema: z.object({
      farm_id: z.string(), plot_id: z.string().optional().nullable(), sample_date: zDate, lab_name: zOptText(150),
      ph: z.number().min(0).max(14).optional().nullable(), ec: z.number().min(0).max(50).optional().nullable(),
      organic_carbon: z.number().min(0).max(20).optional().nullable(),
      nitrogen: z.number().min(0).max(2000).optional().nullable(), phosphorus: z.number().min(0).max(1000).optional().nullable(),
      potassium: z.number().min(0).max(3000).optional().nullable(), sulphur: z.number().min(0).max(500).optional().nullable(),
      zinc: z.number().min(0).max(100).optional().nullable(), iron: z.number().min(0).max(500).optional().nullable(),
      boron: z.number().min(0).max(50).optional().nullable(),
      texture: z.enum(['sandy', 'loamy', 'clay', 'clay_loam', 'sandy_loam', 'silt', 'black_cotton', 'red', 'laterite', 'alluvial']).optional().nullable(),
      notes: zOptText(1000),
    }),
  },
  irrigation: {
    table: 'irrigation_logs', order: 'date DESC',
    schema: z.object({
      farm_id: z.string(), plot_id: z.string().optional().nullable(), date: zDate, method: zOptText(40),
      duration_hours: z.number().min(0).max(48).optional().nullable(), water_mm: z.number().min(0).max(500).optional().nullable(),
      waterlogging_observed: z.boolean().default(false), notes: zOptText(1000),
    }),
  },
  expenses: {
    table: 'expenses', order: 'date DESC',
    schema: z.object({
      farm_id: z.string(), crop_cycle_id: z.string().optional().nullable(),
      category: z.enum(['seeds', 'fertilizer', 'crop_protection', 'labor', 'irrigation', 'electricity', 'equipment', 'transport', 'other']),
      amount_inr: z.number().min(0).max(1e8), is_estimate: z.boolean().default(false), date: zDate, notes: zOptText(1000),
    }),
  },
  harvests: {
    table: 'harvests', order: 'date DESC',
    schema: z.object({
      farm_id: z.string(), crop_cycle_id: z.string().optional().nullable(), date: zDate,
      quantity: z.number().min(0).max(1e7), unit: z.enum(['quintal', 'kg', 'tonne']).default('quintal'),
      sold_quantity: z.number().min(0).max(1e7).optional().nullable(), price_per_unit_inr: z.number().min(0).max(1e7).optional().nullable(),
      is_estimate: z.boolean().default(false), buyer: zOptText(150), notes: zOptText(1000),
    }),
  },
};

export const recordsRouter = Router();

recordsRouter.get('/:kind', ah(async (req, res) => {
  const def = RECORDS[req.params.kind];
  if (!def) throw notFound('Record type');
  const farm = typeof req.query.farm_id === 'string' ? req.query.farm_id : null;
  const rows = q.all(`SELECT * FROM ${def.table} WHERE user_id = ? ${farm ? 'AND farm_id = ?' : ''} ORDER BY ${def.order} LIMIT 500`,
    ...(farm ? [req.user!.id, farm] : [req.user!.id]));
  res.json({ items: rows });
}));

recordsRouter.post('/:kind', ah(async (req, res) => {
  const def = RECORDS[req.params.kind];
  if (!def) throw notFound('Record type');
  const data = parse(def.schema, req.body);
  ownFarm(req, data.farm_id);
  if (data.crop_cycle_id) ownCycle(req, data.crop_cycle_id);
  if (data.plot_id && !q.get('SELECT 1 FROM plots WHERE id = ? AND farm_id = ?', data.plot_id, data.farm_id)) throw notFound('Plot');
  const rid = id();
  insert(def.table, { id: rid, user_id: req.user!.id, ...data });
  res.status(201).json({ item: q.get(`SELECT * FROM ${def.table} WHERE id = ?`, rid) });
}));

recordsRouter.patch('/:kind/:id', ah(async (req, res) => {
  const def = RECORDS[req.params.kind];
  if (!def) throw notFound('Record type');
  const row = q.get(`SELECT * FROM ${def.table} WHERE id = ? AND user_id = ?`, req.params.id, req.user!.id);
  if (!row) throw notFound('Record');
  const set = updateSet(parse(def.schema.partial().omit({ farm_id: true }), req.body));
  if (!set.empty) q.run(`UPDATE ${def.table} SET ${set.sql} WHERE id = ?`, ...set.values, req.params.id);
  res.json({ item: q.get(`SELECT * FROM ${def.table} WHERE id = ?`, req.params.id) });
}));

recordsRouter.delete('/:kind/:id', ah(async (req, res) => {
  const def = RECORDS[req.params.kind];
  if (!def) throw notFound('Record type');
  q.run(`DELETE FROM ${def.table} WHERE id = ? AND user_id = ?`, req.params.id, req.user!.id);
  res.json({ ok: true });
}));

/** Profitability summary, keeping estimates separate from confirmed figures. */
export const financeRouter = Router();
financeRouter.get('/summary', ah(async (req, res) => {
  const uid = req.user!.id;
  const byCycle = q.all<Row>(
    `SELECT cc.id AS cycle_id, c.name AS crop_name, cc.season, cc.sowing_date, f.name AS farm_name, p.name AS plot_name,
       COALESCE((SELECT SUM(amount_inr) FROM expenses e WHERE e.crop_cycle_id = cc.id AND e.is_estimate = 0), 0) AS cost_actual,
       COALESCE((SELECT SUM(amount_inr) FROM expenses e WHERE e.crop_cycle_id = cc.id AND e.is_estimate = 1), 0) AS cost_estimated,
       COALESCE((SELECT SUM(COALESCE(sold_quantity, 0) * COALESCE(price_per_unit_inr, 0)) FROM harvests h WHERE h.crop_cycle_id = cc.id AND h.is_estimate = 0), 0) AS revenue_actual,
       COALESCE((SELECT SUM(quantity * COALESCE(price_per_unit_inr, 0)) FROM harvests h WHERE h.crop_cycle_id = cc.id AND h.is_estimate = 1), 0) AS revenue_estimated,
       COALESCE((SELECT SUM(quantity) FROM harvests h WHERE h.crop_cycle_id = cc.id AND h.is_estimate = 0), 0) AS harvested_qty
     FROM crop_cycles cc JOIN crops c ON c.id = cc.crop_id JOIN farms f ON f.id = cc.farm_id LEFT JOIN plots p ON p.id = cc.plot_id
     WHERE cc.user_id = ? ORDER BY cc.sowing_date DESC`, uid);
  const byCategory = q.all(
    `SELECT category, is_estimate, SUM(amount_inr) AS total FROM expenses WHERE user_id = ? GROUP BY category, is_estimate`, uid);
  const unassigned = q.get<Row>(
    `SELECT COALESCE(SUM(amount_inr), 0) AS total FROM expenses WHERE user_id = ? AND crop_cycle_id IS NULL AND is_estimate = 0`, uid);
  res.json({
    byCycle: byCycle.map((r) => ({ ...r, profit_actual: r.revenue_actual - r.cost_actual })),
    byCategory,
    unassignedActualCost: unassigned?.total ?? 0,
  });
}));

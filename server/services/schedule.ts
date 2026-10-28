import { q, type Row } from '../db/index.ts';
import { id } from '../lib/http.ts';
import { addDays, stagesFor } from './cropStage.ts';

/**
 * Generates the suggested task schedule for a crop cycle. Each generated task
 * has a stable template_key, so regenerating (e.g. after the sowing date
 * changes) updates existing tasks in place instead of creating duplicates.
 * Tasks the farmer has completed or edited are left untouched.
 */

interface Template { key: string; category: string; title: string; offset: number; weather?: boolean; notes?: string }

export function buildTemplates(cropId: string, cropName: string): Template[] {
  const stages = stagesFor(cropId);
  if (!stages.length) return [];
  const t: Template[] = [];
  const end = stages[stages.length - 1].end_day;
  for (const s of stages) {
    t.push({ key: `stage:${s.key}`, category: 'stage', title: `${cropName}: ${s.name} begins – review guidance`, offset: s.start_day });
    if (s.water_need === 'high' || s.water_need === 'critical') {
      for (let d = s.start_day; d <= s.end_day; d += 7) {
        t.push({
          key: `irrigate:${s.key}:${d}`, category: 'irrigation', title: `Check soil moisture / irrigate (${s.name})`, offset: d, weather: true,
          notes: s.water_need === 'critical' ? 'Critical water stage – avoid moisture stress.' : undefined,
        });
      }
    }
    if (['vegetative', 'tillering', 'squaring', 'jointing', 'flowering', 'grand_growth', 'establishment'].includes(s.key)) {
      t.push({
        key: `nutrient:${s.key}`, category: 'fertilizer', title: `Nutrient application as per soil test (${s.name})`, offset: s.start_day + 3, weather: true,
        notes: 'Use your soil health card or local agronomist recommendation. Avoid applying before heavy rain.',
      });
    }
    if (['maturity', 'harvest'].includes(s.key)) {
      t.push({ key: `harvest:${s.key}`, category: 'harvest', title: `Plan harvest – check weather and mandi prices`, offset: s.start_day, weather: true });
    }
  }
  for (let d = 7; d < end; d += 7) {
    t.push({ key: `scout:${d}`, category: 'scouting', title: 'Weekly field scouting for pests and diseases', offset: d });
  }
  return t;
}

export function syncCycleTasks(cycle: Row, cropName: string) {
  const templates = buildTemplates(cycle.crop_id, cropName);
  const existing = new Map(
    q.all<Row>('SELECT id, template_key, status, user_modified FROM tasks WHERE crop_cycle_id = ? AND template_key IS NOT NULL', cycle.id)
      .map((r) => [r.template_key, r]),
  );
  const keep = new Set<string>();
  // Tasks that fall before the cycle was entered (e.g. a crop sown weeks ago) are recorded as skipped
  // rather than flooding the farmer with "overdue" items they cannot act on.
  const backfillCutoff = addDays(new Date().toISOString().slice(0, 10), -1);
  q.tx(() => {
    for (const tpl of templates) {
      keep.add(tpl.key);
      const due = addDays(cycle.sowing_date, tpl.offset);
      const ex = existing.get(tpl.key);
      if (!ex) {
        q.run(
          `INSERT INTO tasks (id, user_id, crop_cycle_id, farm_id, template_key, category, title, notes, due_date, weather_sensitive, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id(), cycle.user_id, cycle.id, cycle.farm_id, tpl.key, tpl.category, tpl.title, tpl.notes ?? null, due, tpl.weather ? 1 : 0,
          due < backfillCutoff ? 'skipped' : 'pending',
        );
      } else if (ex.status === 'pending' && !ex.user_modified) {
        q.run(`UPDATE tasks SET due_date = ?, title = ?, updated_at = datetime('now') WHERE id = ?`, due, tpl.title, ex.id);
      }
    }
    // Remove generated tasks that no longer apply (only untouched, pending ones).
    for (const [key, ex] of existing) {
      if (!keep.has(key) && ex.status === 'pending' && !ex.user_modified) q.run('DELETE FROM tasks WHERE id = ?', ex.id);
    }
  });
  return templates.length;
}

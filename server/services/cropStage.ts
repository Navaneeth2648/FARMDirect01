import { q, type Row } from '../db/index.ts';

export interface StageRow { key: string; name: string; seq: number; start_day: number; end_day: number; water_need: string }

export function stagesFor(cropId: string) {
  return q.all<StageRow>('SELECT key, name, seq, start_day, end_day, water_need FROM crop_stages WHERE crop_id = ? ORDER BY seq', cropId);
}

export const daysBetween = (fromIso: string, to: Date = new Date()) =>
  Math.floor((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.parse(fromIso.slice(0, 10))) / 86400_000);

export const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** Current stage for a cycle given its sowing date. Overlapping ranges resolve to the latest-starting stage. */
export function currentStage(cropId: string, sowingDate: string, now = new Date()) {
  const stages = stagesFor(cropId);
  const day = daysBetween(sowingDate, now);
  let current: StageRow | null = null;
  for (const s of stages) if (day >= s.start_day && day <= s.end_day) current = s;
  if (!current && stages.length) {
    if (day < stages[0].start_day) return { day, stage: null, status: 'not_started' as const, stages };
    if (day > stages[stages.length - 1].end_day) return { day, stage: stages[stages.length - 1], status: 'beyond_cycle' as const, stages };
    // gap between stages: take the last stage that has started
    current = [...stages].reverse().find((s) => day >= s.start_day) ?? null;
  }
  return { day, stage: current, status: 'in_progress' as const, stages };
}

export function cycleWithStage(c: Row) {
  const cs = currentStage(c.crop_id, c.sowing_date);
  const total = cs.stages.length ? cs.stages[cs.stages.length - 1].end_day : null;
  return {
    ...c,
    current_day: cs.day,
    stage: cs.stage,
    stage_status: cs.status,
    progress_pct: total ? Math.max(0, Math.min(100, Math.round((cs.day / total) * 100))) : null,
    expected_harvest_date: c.expected_harvest_date || (total ? addDays(c.sowing_date, total) : null),
  };
}

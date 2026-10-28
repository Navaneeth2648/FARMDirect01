import type { Forecast } from '../providers/weather.ts';

/**
 * Weather-based agricultural recommendations. A recommendation is produced
 * only when a weather condition AND a relevant crop/stage (or pending task)
 * coincide — never for weather alone. Thresholds follow IMD rainfall
 * categories (heavy ≥ 64.5 mm/day, very heavy ≥ 115.6 mm/day) and common
 * agronomic rules of thumb; they are configurable here.
 */

export const THRESHOLDS = {
  heavyRainMm: 64.5,
  veryHeavyRainMm: 115.6,
  significantRainMm: 20,
  sprayMaxWindKmh: 15,
  sprayMaxRainProb: 30,
  heatStressC: 40,
  heatStressSensitiveC: 37,
  coldStressC: 4,
  strongGustKmh: 50,
  waterlogging3DayMm: 100,
};

export interface CycleCtx {
  id: string; crop_id: string; crop_name: string; category?: string;
  stage_key: string | null; stage_name: string | null; water_need: string | null;
}
export interface TaskCtx { id: string; category: string; title: string; due_date: string }

export interface Recommendation {
  id: string;
  type: 'irrigation' | 'spraying' | 'fertilizer' | 'harvest' | 'heat' | 'cold' | 'rain' | 'waterlogging' | 'wind';
  severity: 'info' | 'advisory' | 'warning';
  title: string;
  detail: string;
  crops: string[];
  basis: string; // human-readable explanation of the data used
}

const SENSITIVE_STAGES = ['flowering', 'panicle_initiation', 'fruit_development', 'pod_filling', 'grain_filling', 'bulb_development', 'squaring', 'crown_root'];
const HARVEST_STAGES = ['maturity', 'harvest', 'post_harvest'];
const TALL_CROPS = ['banana', 'sugarcane', 'maize'];
const COLD_SENSITIVE = ['tomato', 'chilli', 'banana', 'chickpea', 'wheat', 'redgram'];

const sum = (a: (number | null)[]) => a.reduce<number>((s, v) => s + (v ?? 0), 0);
const max = (a: (number | null)[]) => a.reduce<number>((m, v) => Math.max(m, v ?? -Infinity), -Infinity);
const min = (a: (number | null)[]) => a.reduce<number>((m, v) => Math.min(m, v ?? Infinity), Infinity);

/** Hours suitable for spraying in the next 72h: daylight-ish, low wind, low rain chance, and no rain in following 4h. */
export function sprayWindows(f: Forecast, nowIso = f.current.time) {
  const h = f.hourly;
  const startIdx = Math.max(0, h.time.findIndex((t) => t >= nowIso.slice(0, 13)));
  const windows: { start: string; end: string }[] = [];
  let open: string | null = null;
  let last = '';
  for (let i = startIdx; i < Math.min(h.time.length, startIdx + 72); i++) {
    const hour = Number(h.time[i].slice(11, 13));
    const next4 = h.precipitation.slice(i, i + 4);
    const ok =
      ((hour >= 6 && hour <= 10) || (hour >= 16 && hour <= 18)) &&
      (h.wind_speed_10m[i] ?? 99) < THRESHOLDS.sprayMaxWindKmh &&
      (h.precipitation_probability[i] ?? 100) < THRESHOLDS.sprayMaxRainProb &&
      sum(next4) < 0.5;
    if (ok && !open) open = h.time[i];
    if (!ok && open) { windows.push({ start: open, end: last }); open = null; }
    last = h.time[i];
  }
  if (open) windows.push({ start: open, end: last });
  return windows;
}

export function evaluate(f: Forecast, cycles: CycleCtx[], tasks: TaskCtx[] = []): Recommendation[] {
  const recs: Recommendation[] = [];
  if (!cycles.length) return recs;
  const d = f.daily;
  const rain48 = sum(d.precipitation_sum.slice(0, 2));
  const rain3 = sum(d.precipitation_sum.slice(0, 3));
  const et3 = sum((d.et0_fao_evapotranspiration ?? []).slice(0, 3));
  const tmax3 = max(d.temperature_2m_max.slice(0, 3));
  const tmin3 = min(d.temperature_2m_min.slice(0, 3));
  const gust3 = max((d.wind_gusts_10m_max ?? d.wind_speed_10m_max).slice(0, 3));
  const heavyDay = d.time.slice(0, 3).find((_, i) => (d.precipitation_sum[i] ?? 0) >= THRESHOLDS.heavyRainMm);
  const names = (cs: CycleCtx[]) => [...new Set(cs.map((c) => c.crop_name))];

  // Irrigation
  const thirsty = cycles.filter((c) => c.stage_key && (c.water_need === 'high' || c.water_need === 'critical') && c.crop_id !== 'paddy');
  if (thirsty.length) {
    if (rain48 >= THRESHOLDS.significantRainMm) {
      recs.push({
        id: 'irrigation-defer', type: 'irrigation', severity: 'info', title: 'Consider postponing irrigation',
        detail: `About ${rain48.toFixed(0)} mm of rain is forecast in the next 48 hours. Check soil moisture before irrigating to avoid waste and waterlogging.`,
        crops: names(thirsty), basis: `Forecast rain next 48h: ${rain48.toFixed(1)} mm; crops at water-sensitive stages.`,
      });
    } else if (rain3 < 5 && et3 > 12) {
      const critical = thirsty.filter((c) => c.water_need === 'critical');
      recs.push({
        id: 'irrigation-plan', type: 'irrigation', severity: critical.length ? 'advisory' : 'info',
        title: critical.length ? 'Plan irrigation – crop at a critical water stage' : 'Plan irrigation in the next few days',
        detail: `Little rain is expected (${rain3.toFixed(1)} mm over 3 days) while crop water demand is high (reference ET ≈ ${et3.toFixed(1)} mm). Check soil moisture at root depth and irrigate if dry.`,
        crops: names(critical.length ? critical : thirsty),
        basis: `3-day rain ${rain3.toFixed(1)} mm, 3-day ET0 ${et3.toFixed(1)} mm; stages: ${thirsty.map((c) => `${c.crop_name} – ${c.stage_name}`).join(', ')}.`,
      });
    }
  }

  // Paddy standing water during heavy rain
  const paddy = cycles.filter((c) => c.crop_id === 'paddy' && c.stage_key && !HARVEST_STAGES.includes(c.stage_key));
  if (paddy.length && heavyDay) {
    recs.push({
      id: 'paddy-bunds', type: 'rain', severity: 'advisory', title: 'Check bunds and drainage outlets',
      detail: 'Heavy rain is forecast. Strengthen bunds and keep drainage outlets ready to prevent overflow and submergence of young plants.',
      crops: names(paddy), basis: `Heavy rain (≥ ${THRESHOLDS.heavyRainMm} mm) forecast on ${heavyDay}.`,
    });
  }

  // Waterlogging for non-paddy crops
  const dryland = cycles.filter((c) => c.stage_key && c.crop_id !== 'paddy');
  if (dryland.length && rain3 >= THRESHOLDS.waterlogging3DayMm) {
    recs.push({
      id: 'waterlogging', type: 'waterlogging', severity: 'warning', title: 'Risk of waterlogging – prepare drainage',
      detail: `Around ${rain3.toFixed(0)} mm of rain is forecast over 3 days. Open field drains and furrows so water does not stand around roots for more than a day.`,
      crops: names(dryland), basis: `3-day forecast rain ${rain3.toFixed(1)} mm.`,
    });
  }

  // Fertiliser timing against pending tasks
  const fertTasks = tasks.filter((t) => ['fertilizer', 'nutrient'].includes(t.category));
  if (fertTasks.length && rain48 >= THRESHOLDS.significantRainMm) {
    recs.push({
      id: 'fertilizer-defer', type: 'fertilizer', severity: 'advisory', title: 'Delay fertiliser application',
      detail: 'Significant rain is expected within 48 hours. Applying fertiliser now risks it washing away. Apply after the rain once the field is workable.',
      crops: names(cycles), basis: `Pending: ${fertTasks.map((t) => t.title).join('; ')}. Rain next 48h ${rain48.toFixed(1)} mm.`,
    });
  }

  // Spraying windows (only relevant while a crop is in the field and not at harvest)
  const inField = cycles.filter((c) => c.stage_key && !HARVEST_STAGES.includes(c.stage_key));
  if (inField.length) {
    const windows = sprayWindows(f);
    recs.push(windows.length
      ? {
          id: 'spray-window', type: 'spraying', severity: 'info', title: 'Suitable spraying windows',
          detail: `If a spray is needed, these periods have low wind and low rain chance: ${windows.slice(0, 3).map((w) => `${w.start.replace('T', ' ')}–${w.end.slice(11)}`).join(', ')}. Spray only when scouting shows it is necessary, with products registered for the crop.`,
          crops: names(inField), basis: `Hourly wind < ${THRESHOLDS.sprayMaxWindKmh} km/h, rain probability < ${THRESHOLDS.sprayMaxRainProb}%, no rain in following 4 hours.`,
        }
      : {
          id: 'spray-none', type: 'spraying', severity: 'advisory', title: 'No good spraying window in the next 3 days',
          detail: 'Wind or rain conditions are unfavourable. Sprays applied now may drift or wash off. Postpone non-urgent sprays.',
          crops: names(inField), basis: 'No hour in the next 72h met wind, rain-probability and rain-free criteria.',
        });
  }

  // Harvest & drying
  const harvesting = cycles.filter((c) => c.stage_key && HARVEST_STAGES.includes(c.stage_key));
  if (harvesting.length) {
    if (rain3 >= THRESHOLDS.significantRainMm) {
      recs.push({
        id: 'harvest-rain', type: 'harvest', severity: 'warning', title: 'Protect harvested produce from rain',
        detail: 'Rain is forecast. If possible, harvest before the rain or postpone; cover produce that is drying and move it to a dry place.',
        crops: names(harvesting), basis: `3-day rain ${rain3.toFixed(1)} mm; crops at maturity/harvest.`,
      });
    } else if (rain3 < 2) {
      recs.push({
        id: 'harvest-window', type: 'harvest', severity: 'info', title: 'Good dry window for harvest and drying',
        detail: 'Dry weather is expected for the next 3 days, which suits harvesting and sun-drying.',
        crops: names(harvesting), basis: `3-day rain ${rain3.toFixed(1)} mm.`,
      });
    }
  }

  // Heat stress
  const heatCrops = cycles.filter((c) => c.stage_key && (
    tmax3 >= THRESHOLDS.heatStressC || (tmax3 >= THRESHOLDS.heatStressSensitiveC && SENSITIVE_STAGES.includes(c.stage_key))));
  if (heatCrops.length) {
    recs.push({
      id: 'heat', type: 'heat', severity: tmax3 >= THRESHOLDS.heatStressC ? 'warning' : 'advisory', title: 'Heat stress risk',
      detail: `Maximum temperatures up to ${tmax3.toFixed(0)}°C are forecast. Irrigate in the evening or early morning, use mulch where possible, and avoid spraying in the heat of the day.`,
      crops: names(heatCrops), basis: `3-day max ${tmax3.toFixed(1)}°C; stages: ${heatCrops.map((c) => c.stage_name).join(', ')}.`,
    });
  }

  // Cold stress
  const coldCrops = cycles.filter((c) => c.stage_key && COLD_SENSITIVE.includes(c.crop_id));
  if (coldCrops.length && tmin3 <= THRESHOLDS.coldStressC) {
    recs.push({
      id: 'cold', type: 'cold', severity: 'warning', title: 'Cold / frost risk',
      detail: `Night temperatures may fall to ${tmin3.toFixed(0)}°C. Light irrigation in the evening and smoke/cover for nurseries can reduce frost injury.`,
      crops: names(coldCrops), basis: `3-day min ${tmin3.toFixed(1)}°C.`,
    });
  }

  // Strong wind for tall crops
  const tall = cycles.filter((c) => c.stage_key && TALL_CROPS.includes(c.crop_id));
  if (tall.length && gust3 >= THRESHOLDS.strongGustKmh) {
    recs.push({
      id: 'wind', type: 'wind', severity: 'warning', title: 'Strong winds – support tall crops',
      detail: `Gusts up to ${gust3.toFixed(0)} km/h are forecast. Prop or tie plants where practical and avoid spraying.`,
      crops: names(tall), basis: `3-day max gust ${gust3.toFixed(0)} km/h.`,
    });
  }

  return recs;
}

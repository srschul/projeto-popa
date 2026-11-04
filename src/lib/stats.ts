import { addDays, addMonths, daysBetween, fmtDayMonth, fmtMonthLabel, weekStart } from './dates';
import type { BodyEntry, MissionCode, Period, SleepLog, UserSettings, Workout } from './types';

export const PERIODS: { value: Period; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
  { value: '3m', label: '3 meses' },
  { value: '6m', label: '6 meses' },
  { value: 'all', label: 'Tudo' },
];

/** Primeiro dia (inclusive) do período, ou null para "todo o histórico". */
export function periodStart(period: Period, today: string): string | null {
  switch (period) {
    case '7d': return addDays(today, -6);
    case '30d': return addDays(today, -29);
    case '3m': return addDays(addMonths(today, -3), 1);
    case '6m': return addDays(addMonths(today, -6), 1);
    default: return null;
  }
}

export function inPeriod<T extends { date: string }>(rows: T[], period: Period, today: string): T[] {
  const start = periodStart(period, today);
  return start ? rows.filter((r) => r.date >= start && r.date <= today) : rows.filter((r) => r.date <= today);
}

/** Período imediatamente anterior, de mesmo tamanho (para comparação). Null em "tudo". */
export function previousPeriodRange(period: Period, today: string): { start: string; end: string } | null {
  const start = periodStart(period, today);
  if (!start) return null;
  const len = daysBetween(start, today) + 1;
  const end = addDays(start, -1);
  return { start: addDays(end, -(len - 1)), end };
}

export function inRange<T extends { date: string }>(rows: T[], start: string, end: string): T[] {
  return rows.filter((r) => r.date >= start && r.date <= end);
}

export const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);
export const avg = (xs: number[]): number | null => (xs.length ? sum(xs) / xs.length : null);

export const totalMinutes = (ws: Workout[]): number => sum(ws.map((w) => w.duration_min));

// ---------------------------------------------------------------------------
// Semana e missões
// ---------------------------------------------------------------------------
export const MISSIONS: { code: MissionCode; title: string; hint: string; unit: string }[] = [
  { code: 'activities', title: 'Atividades da semana', hint: 'Qualquer movimento conta', unit: '' },
  { code: 'strength', title: 'Treinos de musculação', hint: 'Força constrói base', unit: '' },
  { code: 'cardio', title: 'Sessões de cardio', hint: 'Coração em movimento', unit: '' },
  { code: 'minutes', title: 'Minutos de atividade', hint: 'Some o tempo de todas as sessões', unit: 'min' },
  { code: 'sleep_nights', title: 'Noites de sono registradas', hint: 'Descanso também é treino', unit: '' },
];

export interface MissionProgress {
  code: MissionCode;
  title: string;
  hint: string;
  unit: string;
  progress: number;
  target: number;
  done: boolean;
}

export function goalFor(code: MissionCode, s: UserSettings): number {
  switch (code) {
    case 'activities': return s.weekly_activities_goal;
    case 'strength': return s.weekly_strength_goal;
    case 'cardio': return s.weekly_cardio_goal;
    case 'minutes': return s.weekly_minutes_goal;
    case 'sleep_nights': return s.weekly_sleep_nights_goal;
  }
}

export function weekMissions(workouts: Workout[], sleep: SleepLog[], s: UserSettings, week: string): MissionProgress[] {
  const end = addDays(week, 6);
  const ws = inRange(workouts, week, end);
  const sl = inRange(sleep, week, end);
  const value: Record<MissionCode, number> = {
    activities: ws.length,
    strength: ws.filter((w) => w.type === 'strength').length,
    cardio: ws.filter((w) => w.type === 'cardio').length,
    minutes: totalMinutes(ws),
    sleep_nights: sl.length,
  };
  return MISSIONS.filter((m) => goalFor(m.code, s) > 0).map((m) => {
    const target = goalFor(m.code, s);
    return { ...m, progress: value[m.code], target, done: value[m.code] >= target };
  });
}

/** Dias ativos consecutivos até hoje. Se hoje ainda não teve atividade, a sequência de ontem continua valendo. */
export function activeStreak(workouts: Workout[], today: string): number {
  const days = new Set(workouts.map((w) => w.date));
  let cursor = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(cursor)) {
    n += 1;
    cursor = addDays(cursor, -1);
  }
  return n;
}

// ---------------------------------------------------------------------------
// Séries para gráficos
// ---------------------------------------------------------------------------
export interface WeekBucket {
  week: string; // segunda-feira
  label: string;
  strength: number;
  cardio: number;
  other: number;
  count: number;
  minutes: number;
  hours: number;
}

/** Semanas (segunda a domingo) cobrindo o intervalo, da mais antiga para a atual. */
export function weeksCovering(start: string, today: string): string[] {
  const out: string[] = [];
  for (let w = weekStart(start); w <= weekStart(today); w = addDays(w, 7)) out.push(w);
  return out;
}

export function weeklyBuckets(workouts: Workout[], weeks: string[]): WeekBucket[] {
  return weeks.map((week) => {
    const ws = inRange(workouts, week, addDays(week, 6));
    const minutes = totalMinutes(ws);
    return {
      week,
      label: fmtDayMonth(week),
      strength: ws.filter((w) => w.type === 'strength').length,
      cardio: ws.filter((w) => w.type === 'cardio').length,
      other: ws.filter((w) => w.type === 'other').length,
      count: ws.length,
      minutes,
      hours: Math.round((minutes / 60) * 10) / 10,
    };
  });
}

export interface MonthBucket {
  month: string; // YYYY-MM-01
  label: string;
  count: number;
  minutes: number;
  hours: number;
}

export function monthlyBuckets(workouts: Workout[], start: string, today: string): MonthBucket[] {
  const out: MonthBucket[] = [];
  const first = `${start.slice(0, 7)}-01`;
  const last = `${today.slice(0, 7)}-01`;
  for (let m = first; m <= last; m = addMonths(m, 1)) {
    const key = m.slice(0, 7);
    const ws = workouts.filter((w) => w.date.startsWith(key));
    const minutes = totalMinutes(ws);
    out.push({ month: m, label: fmtMonthLabel(m), count: ws.length, minutes, hours: Math.round((minutes / 60) * 10) / 10 });
  }
  return out;
}

/** Acumulado de horas ao longo do tempo, por semana. */
export function cumulativeHours(buckets: WeekBucket[]): { label: string; hours: number }[] {
  let acc = 0;
  return buckets.map((b) => {
    acc += b.minutes / 60;
    return { label: b.label, hours: Math.round(acc * 10) / 10 };
  });
}

/** % de semanas do período em que a meta de atividades foi cumprida. Null se não há semanas completas/dados. */
export function consistencyPct(buckets: WeekBucket[], goal: number): number | null {
  if (!buckets.length || goal <= 0) return null;
  const hit = buckets.filter((b) => b.count >= goal).length;
  return Math.round((hit / buckets.length) * 100);
}

export function sleepAverage(logs: SleepLog[]): number | null {
  return avg(logs.map((l) => Number(l.hours)));
}

export function weeklySleepAverages(logs: SleepLog[], weeks: string[]): { label: string; hours: number | null; nights: number }[] {
  return weeks.map((w) => {
    const sl = inRange(logs, w, addDays(w, 6));
    const a = sleepAverage(sl);
    return { label: fmtDayMonth(w), hours: a === null ? null : Math.round(a * 10) / 10, nights: sl.length };
  });
}

export function monthlySleepAverages(logs: SleepLog[], start: string, today: string): { label: string; hours: number | null; nights: number }[] {
  const out: { label: string; hours: number | null; nights: number }[] = [];
  const first = `${start.slice(0, 7)}-01`;
  const last = `${today.slice(0, 7)}-01`;
  for (let m = first; m <= last; m = addMonths(m, 1)) {
    const sl = logs.filter((l) => l.date.startsWith(m.slice(0, 7)));
    const a = sleepAverage(sl);
    out.push({ label: fmtMonthLabel(m), hours: a === null ? null : Math.round(a * 10) / 10, nights: sl.length });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Corpo
// ---------------------------------------------------------------------------
export type BodyMetric = 'weight_kg' | 'waist_cm' | 'chest_cm' | 'hip_cm' | 'arm_cm';
export const BODY_METRICS: { key: BodyMetric; label: string; unit: string }[] = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg' },
  { key: 'waist_cm', label: 'Cintura', unit: 'cm' },
  { key: 'chest_cm', label: 'Peito', unit: 'cm' },
  { key: 'hip_cm', label: 'Quadril', unit: 'cm' },
  { key: 'arm_cm', label: 'Braço', unit: 'cm' },
];

export function bodySeries(entries: BodyEntry[], metric: BodyMetric): { date: string; label: string; value: number }[] {
  return entries
    .filter((e) => e[metric] !== null && e[metric] !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at))
    .map((e) => ({ date: e.date, label: fmtDayMonth(e.date), value: Number(e[metric]) }));
}

// ---------------------------------------------------------------------------
// Cargas por exercício
// ---------------------------------------------------------------------------
const norm = (s: string) => s.trim().toLowerCase();

export function exerciseNames(workouts: Workout[]): string[] {
  const seen = new Map<string, string>();
  for (const w of workouts)
    for (const ex of w.workout_exercises ?? []) if (!seen.has(norm(ex.name))) seen.set(norm(ex.name), ex.name.trim());
  return [...seen.values()].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

/** Maior carga e volume (carga × repetições) do exercício em cada data. */
export function loadSeries(workouts: Workout[], name: string): { date: string; label: string; maxKg: number; volume: number }[] {
  const key = norm(name);
  const byDate = new Map<string, { maxKg: number; volume: number }>();
  for (const w of workouts) {
    for (const ex of w.workout_exercises ?? []) {
      if (norm(ex.name) !== key) continue;
      const cur = byDate.get(w.date) ?? { maxKg: 0, volume: 0 };
      for (const s of ex.exercise_sets ?? []) {
        cur.maxKg = Math.max(cur.maxKg, Number(s.weight_kg));
        cur.volume += Number(s.weight_kg) * s.reps;
      }
      byDate.set(w.date, cur);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, label: fmtDayMonth(date), maxKg: v.maxKg, volume: Math.round(v.volume) }));
}

/** Última carga registrada por exercício (para sugerir no formulário). */
export function lastSetsFor(workouts: Workout[], name: string): { reps: number; weight_kg: number }[] | null {
  const key = norm(name);
  const sorted = [...workouts].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  for (const w of sorted) {
    const ex = (w.workout_exercises ?? []).find((e) => norm(e.name) === key);
    if (ex && ex.exercise_sets?.length)
      return [...ex.exercise_sets].sort((a, b) => a.set_number - b.set_number).map((s) => ({ reps: s.reps, weight_kg: Number(s.weight_kg) }));
  }
  return null;
}

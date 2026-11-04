import { describe, expect, it } from 'vitest';
import { addDays, addMonths, daysBetween, toISO, weekStart } from './dates';
import {
  activeStreak, consistencyPct, exerciseNames, inPeriod, loadSeries, monthlyBuckets,
  periodStart, previousPeriodRange, weekMissions, weeklyBuckets, weeksCovering, cumulativeHours, lastSetsFor,
} from './stats';
import type { SleepLog, UserSettings, Workout, WorkoutType } from './types';
import { parseDecimal, fmtMinutes } from './format';

let n = 0;
function w(date: string, type: WorkoutType = 'strength', duration = 45, extra: Partial<Workout> = {}): Workout {
  n += 1;
  return {
    id: `w${n}`, date, type, name: '', duration_min: duration, intensity: 'moderate', notes: '', legacy_id: null,
    created_at: `2026-01-01T00:00:${String(n % 60).padStart(2, '0')}Z`, workout_exercises: [], cardio_details: null, ...extra,
  };
}
const sleepLog = (date: string, hours = 7): SleepLog => ({ id: date, date, hours, quality: 'good', notes: '', legacy_id: null });
const settings: UserSettings = {
  user_id: 'u', weekly_activities_goal: 3, weekly_strength_goal: 2, weekly_cardio_goal: 1, weekly_minutes_goal: 90, weekly_sleep_nights_goal: 5,
};

describe('datas', () => {
  it('semana começa na segunda-feira', () => {
    expect(weekStart('2026-11-03')).toBe('2026-11-02'); // terça
    expect(weekStart('2026-11-02')).toBe('2026-11-02'); // segunda
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // domingo
    expect(weekStart('2026-11-09')).toBe('2026-11-09');
  });
  it('soma dias e meses sem sair do calendário local', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addMonths('2026-11-03', -3)).toBe('2026-08-03');
    expect(daysBetween('2026-10-28', '2026-11-03')).toBe(6);
    expect(toISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('períodos', () => {
  const today = '2026-11-03';
  it('7 dias inclui hoje e os 6 anteriores', () => {
    expect(periodStart('7d', today)).toBe('2026-10-28');
    expect(periodStart('30d', today)).toBe('2026-10-05');
    expect(periodStart('all', today)).toBeNull();
  });
  it('filtra registros pelo período', () => {
    const ws = [w('2026-10-27'), w('2026-10-28'), w('2026-11-03'), w('2026-11-04')];
    expect(inPeriod(ws, '7d', today).map((x) => x.date)).toEqual(['2026-10-28', '2026-11-03']);
    expect(inPeriod(ws, 'all', today)).toHaveLength(3); // ignora datas futuras
  });
  it('período anterior tem o mesmo tamanho', () => {
    expect(previousPeriodRange('7d', today)).toEqual({ start: '2026-10-21', end: '2026-10-27' });
    expect(previousPeriodRange('all', today)).toBeNull();
  });
});

describe('sequência de dias ativos', () => {
  it('conta dias consecutivos até hoje', () => {
    const ws = [w('2026-11-01'), w('2026-11-02'), w('2026-11-03')];
    expect(activeStreak(ws, '2026-11-03')).toBe(3);
  });
  it('não zera se hoje ainda não teve atividade', () => {
    const ws = [w('2026-11-01'), w('2026-11-02')];
    expect(activeStreak(ws, '2026-11-03')).toBe(2);
  });
  it('zera depois de um dia inteiro sem atividade', () => {
    expect(activeStreak([w('2026-11-01')], '2026-11-03')).toBe(0);
    expect(activeStreak([], '2026-11-03')).toBe(0);
  });
  it('vários treinos no mesmo dia contam como um dia', () => {
    expect(activeStreak([w('2026-11-03'), w('2026-11-03', 'cardio')], '2026-11-03')).toBe(1);
  });
});

describe('missões da semana', () => {
  const week = '2026-11-02';
  it('calcula progresso e conclusão por missão', () => {
    const ws = [w('2026-11-02', 'strength', 50), w('2026-11-04', 'cardio', 30), w('2026-11-08', 'other', 20), w('2026-11-09', 'strength', 60)];
    const sl = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'].map((d) => sleepLog(d));
    const m = Object.fromEntries(weekMissions(ws, sl, settings, week).map((x) => [x.code, x]));
    expect(m.activities).toMatchObject({ progress: 3, target: 3, done: true });
    expect(m.strength).toMatchObject({ progress: 1, target: 2, done: false });
    expect(m.cardio).toMatchObject({ progress: 1, done: true });
    expect(m.minutes).toMatchObject({ progress: 100, done: true }); // 50+30+20, domingo incluído, segunda seguinte fora
    expect(m.sleep_nights).toMatchObject({ progress: 5, done: true });
  });
  it('meta 0 desativa a missão', () => {
    const codes = weekMissions([], [], { ...settings, weekly_cardio_goal: 0 }, week).map((x) => x.code);
    expect(codes).not.toContain('cardio');
  });
});

describe('séries e consistência', () => {
  it('agrupa por semana (segunda a domingo)', () => {
    const ws = [w('2026-10-26'), w('2026-11-01', 'cardio', 30), w('2026-11-02'), w('2026-11-03', 'cardio', 20)];
    const weeks = weeksCovering('2026-10-26', '2026-11-03');
    expect(weeks).toEqual(['2026-10-26', '2026-11-02']);
    const b = weeklyBuckets(ws, weeks);
    expect(b[0]).toMatchObject({ count: 2, strength: 1, cardio: 1, minutes: 75 });
    expect(b[1]).toMatchObject({ count: 2, strength: 1, cardio: 1, minutes: 65 });
    expect(cumulativeHours(b).at(-1)?.hours).toBe(2.3);
  });
  it('agrupa por mês incluindo meses vazios', () => {
    const b = monthlyBuckets([w('2026-09-10'), w('2026-11-02')], '2026-09-01', '2026-11-03');
    expect(b.map((x) => x.count)).toEqual([1, 0, 1]);
  });
  it('consistência = % de semanas que bateram a meta', () => {
    const ws = [w('2026-10-26'), w('2026-10-27'), w('2026-10-28'), w('2026-11-02')];
    const b = weeklyBuckets(ws, weeksCovering('2026-10-26', '2026-11-03'));
    expect(consistencyPct(b, 3)).toBe(50);
    expect(consistencyPct([], 3)).toBeNull();
  });
});

describe('cargas por exercício', () => {
  const sets = (exercise_id: string, data: [number, number][]) =>
    data.map(([reps, kg], i) => ({ id: `${exercise_id}-${i}`, exercise_id, set_number: i + 1, reps, weight_kg: kg }));
  const ex = (name: string, data: [number, number][], id = name) => ({
    id, workout_id: 'x', name, muscle_group: '', position: 0, notes: '', exercise_sets: sets(id, data),
  });
  const ws = [
    w('2026-10-01', 'strength', 50, { workout_exercises: [ex('Supino reto', [[10, 40], [8, 45]])] }),
    w('2026-10-08', 'strength', 50, { workout_exercises: [ex('supino reto ', [[10, 45], [8, 50]]), ex('Agachamento', [[10, 60]])] }),
  ];
  it('lista nomes sem duplicar variações de caixa/espaço', () => {
    expect(exerciseNames(ws)).toEqual(['Agachamento', 'Supino reto']);
  });
  it('maior carga e volume por data', () => {
    expect(loadSeries(ws, 'Supino reto')).toMatchObject([
      { date: '2026-10-01', maxKg: 45, volume: 10 * 40 + 8 * 45 },
      { date: '2026-10-08', maxKg: 50, volume: 10 * 45 + 8 * 50 },
    ]);
  });
  it('sugere as séries da última vez', () => {
    expect(lastSetsFor(ws, 'supino reto')).toEqual([{ reps: 10, weight_kg: 45 }, { reps: 8, weight_kg: 50 }]);
    expect(lastSetsFor(ws, 'Remada')).toBeNull();
  });
});

describe('formatação', () => {
  it('aceita vírgula e ponto decimal', () => {
    expect(parseDecimal('7,5')).toBe(7.5);
    expect(parseDecimal('7.25')).toBe(7.25);
    expect(parseDecimal('  ')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
  });
  it('formata minutos', () => {
    expect(fmtMinutes(45)).toBe('45 min');
    expect(fmtMinutes(60)).toBe('1 h');
    expect(fmtMinutes(135)).toBe('2 h 15 min');
  });
});

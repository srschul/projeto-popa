import { useMemo, useState } from 'react';
import { Card, CardTitle, ChartEmpty, ErrorBlock, LoadingBlock, PageHeader, Segmented, Stat } from '../components/ui';
import { AreaChartSimple, BarsChart, C, LinesChart } from '../components/charts';
import { useAuth } from '../features/auth/AuthProvider';
import { useBody, useSettings, useSleep, useWorkouts } from '../lib/data';
import { addDays, fmtMonthLabel, todayISO, weekStart } from '../lib/dates';
import { fmtMinutes, fmtNumber } from '../lib/format';
import {
  BODY_METRICS, PERIODS, bodySeries, consistencyPct, cumulativeHours, exerciseNames, inPeriod, loadSeries, monthlyBuckets,
  monthlySleepAverages, periodStart, previousPeriodRange, inRange, sleepAverage, totalMinutes, weeklyBuckets, weeklySleepAverages,
  weeksCovering, type BodyMetric,
} from '../lib/stats';
import type { Period } from '../lib/types';

export function StatsPage() {
  const { user } = useAuth();
  const w = useWorkouts();
  const b = useBody();
  const s = useSleep();
  const set = useSettings(user?.id);
  const [period, setPeriod] = useState<Period>('30d');
  const [metric, setMetric] = useState<BodyMetric>('weight_kg');
  const [exercise, setExercise] = useState('');

  const today = todayISO();
  const workoutsAll = w.data;
  const names = useMemo(() => exerciseNames(workoutsAll ?? []), [workoutsAll]);

  if (w.error || b.error || s.error || set.error) return <ErrorBlock error={w.error || b.error || s.error || set.error} onRetry={() => { w.refetch(); b.refetch(); s.refetch(); set.refetch(); }} />;
  if (!w.data || !b.data || !s.data || !set.data) return <LoadingBlock />;

  const goal = set.data.weekly_activities_goal;
  const earliest = [...w.data, ...b.data, ...s.data].map((x) => x.date).sort()[0] ?? today;
  const start = periodStart(period, today) ?? earliest;

  const ws = inPeriod(w.data, period, today);
  const sl = inPeriod(s.data, period, today);
  const bodies = inPeriod(b.data, period, today);

  // Semanas do período (limitadas às últimas 26 para o gráfico continuar legível)
  const weekFloor = addDays(today, -7 * 25);
  const weeks = weeksCovering(start > weekFloor ? start : weekFloor, today);
  const wb = weeklyBuckets(w.data, weeks);
  const mb = monthlyBuckets(w.data, start, today).slice(-12);
  const cum = cumulativeHours(weeklyBuckets(w.data, weeksCovering(start, today)).slice(-60));
  const currentWeek = weekStart(today);
  const considered = weeklyBuckets(w.data, weeksCovering(start, today)).filter((x) => x.week < currentWeek || x.count >= goal);
  const pct = consistencyPct(considered, goal);

  const strengthN = ws.filter((x) => x.type === 'strength').length;
  const cardioN = ws.filter((x) => x.type === 'cardio').length;
  const otherN = ws.filter((x) => x.type === 'other').length;
  const mm = (t: string) => totalMinutes(ws.filter((x) => x.type === t));
  const typeData = [
    { label: 'Musculação', sessoes: strengthN, minutos: mm('strength') },
    { label: 'Cardio', sessoes: cardioN, minutos: mm('cardio') },
    { label: 'Outro', sessoes: otherN, minutos: mm('other') },
  ];

  const prev = previousPeriodRange(period, today);
  const prevWs = prev ? inRange(w.data, prev.start, prev.end) : null;

  const m = BODY_METRICS.find((x) => x.key === metric)!;
  const bodyLine = bodySeries(bodies, metric);
  const weightLine = bodySeries(bodies, 'weight_kg');
  const selectedEx = exercise && names.includes(exercise) ? exercise : names[0] ?? '';
  const loads = selectedEx ? loadSeries(ws, selectedEx) : [];

  const sleepWeekly = weeklySleepAverages(s.data, weeks);
  const sleepMonthly = monthlySleepAverages(s.data, start, today).slice(-12);
  const sleepAvg = sleepAverage(sl);
  const sleepAvgPrev = prev ? sleepAverage(inRange(s.data, prev.start, prev.end)) : null;

  // Dias ativos por mês (consistência mensal)
  const activeDaysByMonth = mb.map((x) => ({ label: x.label, dias: new Set(w.data.filter((y) => y.date.startsWith(x.month.slice(0, 7))).map((y) => y.date)).size }));

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Dados e tendências" title="Estatísticas" subtitle="Tudo calculado a partir dos seus registros reais." />

      <div className="sticky top-0 z-30 -mx-4 bg-ink/85 px-4 py-2 backdrop-blur-lg">
        <Segmented value={period} onChange={setPeriod} options={PERIODS} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Atividades" value={ws.length} sub={prevWs ? `${prevWs.length} no período anterior` : 'todo o histórico'} />
        <Stat label="Tempo ativo" value={fmtMinutes(totalMinutes(ws))} sub={prevWs ? `${fmtMinutes(totalMinutes(prevWs))} antes` : 'todo o histórico'} />
        <Stat label="Metas semanais cumpridas" value={pct === null ? '—' : `${pct}%`} sub={`meta: ${goal} atividades/semana`} />
        <Stat label="Média de sono" value={sleepAvg !== null ? `${fmtNumber(sleepAvg)} h` : '—'} sub={sleepAvgPrev !== null ? `${fmtNumber(sleepAvgPrev)} h antes` : `${sl.length} noite(s)`} />
      </div>

      <Card>
        <CardTitle>Treinos por semana</CardTitle>
        {ws.length ? <BarsChart data={wb as never} integer goal={goal} series={[
          { key: 'strength', name: 'Musculação', color: C.green }, { key: 'cardio', name: 'Cardio', color: C.blue }, { key: 'other', name: 'Outro', color: C.amber }]} />
          : <ChartEmpty />}
      </Card>

      <Card>
        <CardTitle>Treinos por mês</CardTitle>
        {ws.length ? <BarsChart data={mb as never} integer series={[{ key: 'count', name: 'Atividades', color: C.green }]} height={170} /> : <ChartEmpty />}
      </Card>

      <Card>
        <CardTitle>Horas de atividade acumuladas</CardTitle>
        {w.data.length >= 2 ? <AreaChartSimple data={cum as never} dataKey="hours" name="Horas acumuladas" unit="h" height={170} /> : <ChartEmpty />}
      </Card>

      <Card>
        <CardTitle>Musculação x cardio</CardTitle>
        {ws.length ? (
          <>
            <BarsChart data={typeData as never} stacked={false} integer series={[{ key: 'sessoes', name: 'Sessões', color: C.green }]} height={150} xKey="label" />
            <p className="mt-2 text-xs text-mute">Tempo: musculação {fmtMinutes(mm('strength'))} · cardio {fmtMinutes(mm('cardio'))} · outros {fmtMinutes(mm('other'))}</p>
          </>
        ) : <ChartEmpty />}
      </Card>

      <Card>
        <CardTitle>Consistência</CardTitle>
        {ws.length ? (
          <>
            <p className="mb-2 text-xs text-mute">Dias com pelo menos uma atividade, por mês.</p>
            <BarsChart data={activeDaysByMonth as never} integer series={[{ key: 'dias', name: 'Dias ativos', color: C.green }]} height={150} />
          </>
        ) : <ChartEmpty />}
      </Card>

      <Card>
        <CardTitle>Evolução do peso</CardTitle>
        {weightLine.length >= 2 ? <AreaChartSimple data={weightLine as never} dataKey="value" name="Peso" unit="kg" height={180} tight /> : <ChartEmpty text="Registre o peso em pelo menos duas datas neste período." />}
      </Card>

      <Card>
        <CardTitle>Medidas corporais</CardTitle>
        <div className="-mx-1 mb-3 overflow-x-auto px-1">
          <Segmented value={metric} onChange={setMetric} className="min-w-[420px]" options={BODY_METRICS.map((x) => ({ value: x.key, label: x.label }))} />
        </div>
        {bodyLine.length >= 2 ? <LinesChart data={bodyLine as never} unit={m.unit} series={[{ key: 'value', name: m.label, color: C.green }]} /> : <ChartEmpty text={`Registre ${m.label.toLowerCase()} em pelo menos duas datas neste período.`} />}
      </Card>

      <Card>
        <CardTitle right={names.length > 0 ? (
          <select aria-label="Exercício" className="input !w-auto !py-1.5 !text-sm" value={selectedEx} onChange={(e) => setExercise(e.target.value)}>
            {names.map((n) => <option key={n}>{n}</option>)}
          </select>) : undefined}>Evolução das cargas</CardTitle>
        {loads.length >= 2 ? <LinesChart data={loads as never} unit="kg" series={[{ key: 'maxKg', name: 'Maior carga', color: C.green }]} />
          : <ChartEmpty text={names.length ? 'Este exercício precisa de ao menos duas datas neste período.' : 'Registre exercícios com séries e cargas para acompanhar a evolução.'} />}
      </Card>

      <Card>
        <CardTitle>Média de sono</CardTitle>
        {sl.length ? (
          <>
            <BarsChart data={sleepWeekly as never} series={[{ key: 'hours', name: 'Média semanal', color: C.blue }]} unit="h" height={150} />
            {sleepMonthly.length > 1 && <p className="mt-2 text-xs text-mute">Por mês: {sleepMonthly.filter((x) => x.hours !== null).map((x) => `${x.label} ${fmtNumber(x.hours!)} h`).join(' · ')}</p>}
          </>
        ) : <ChartEmpty />}
      </Card>

      <p className="pb-2 text-center text-[11px] text-zinc-600">Período: {fmtMonthLabel(start)} até hoje · semanas começam na segunda-feira</p>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { Activity, Clock, Dumbbell, Flame, Moon, Scale, Target, Trophy } from 'lucide-react';
import { Button, Card, CardTitle, ChartEmpty, EmptyState, ErrorBlock, LoadingBlock, ProgressBar, Ring, Stat } from '../components/ui';
import { BarsChart, C } from '../components/charts';
import { WorkoutRow } from '../components/WorkoutRow';
import { useEditors } from '../features/editors/EditorsProvider';
import { useAuth } from '../features/auth/AuthProvider';
import { useBody, useSettings, useSleep, useWorkouts, useXp } from '../lib/data';
import { addDays, fmtLongToday, todayISO, weekStart, weekdayShort } from '../lib/dates';
import { fmtMinutes, fmtNumber } from '../lib/format';
import { activeStreak, inRange, totalMinutes, weekMissions, weeklyBuckets, weeksCovering } from '../lib/stats';

export function DashboardPage() {
  const { user } = useAuth();
  const { openWorkout, openBody, openSleep } = useEditors();
  const w = useWorkouts();
  const b = useBody();
  const s = useSleep();
  const set = useSettings(user?.id);
  const xp = useXp();

  const err = w.error || b.error || s.error || set.error || xp.error;
  if (err) return <ErrorBlock error={err} onRetry={() => { w.refetch(); b.refetch(); s.refetch(); set.refetch(); xp.refetch(); }} />;
  if (!w.data || !b.data || !s.data || !set.data) return <LoadingBlock />;

  const workouts = w.data;
  const today = todayISO();
  const week = weekStart(today);
  const settings = set.data;
  const weekWorkouts = inRange(workouts, week, addDays(week, 6));
  const missions = weekMissions(workouts, s.data, settings, week);
  const goal = settings.weekly_activities_goal;
  const streak = activeStreak(workouts, today);
  const latestWeight = b.data.find((e) => e.weight_kg !== null);
  const trainedToday = workouts.some((x) => x.date === today);
  const buckets = weeklyBuckets(workouts, weeksCovering(addDays(today, -7 * 7), today));
  const hasAny = workouts.length > 0;

  const total = xp.data?.total_xp ?? 0;
  const curMin = xp.data?.level_min_xp ?? 0;
  const nextMin = xp.data?.next_level_min_xp ?? null;
  const toNext = nextMin !== null ? nextMin - total : 0;

  return (
    <div className="space-y-4">
      <header>
        <p className="eyebrow">Painel principal</p>
        <h1 className="mt-1 font-display text-[26px] font-bold leading-tight">
          {hasAny ? (trainedToday ? 'Hoje já contou.' : 'Vamos evoluir.') : 'Bem-vindo ao seu projeto.'}
        </h1>
        <p className="mt-1 text-sm text-mute">{fmtLongToday()}</p>
        {hasAny && !trainedToday && <p className="mt-2 text-sm text-zinc-400">Um dia de descanso não é fracasso. Quando der, qualquer atividade conta.</p>}
      </header>

      {/* Nível e XP */}
      <Card className="relative overflow-hidden">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-popa/10 blur-3xl" />
        <div className="relative flex items-center gap-4">
          <Ring value={total - curMin} max={nextMin !== null ? nextMin - curMin : 1} size={88}>
            <div className="text-center leading-none"><div className="num text-xl font-bold">{xp.data?.level ?? 1}</div><div className="mt-0.5 text-[9px] uppercase tracking-widest text-mute">nível</div></div>
          </Ring>
          <div className="min-w-0 flex-1">
            <p className="font-display text-lg font-bold">{xp.data?.level_name ?? 'Iniciante'}</p>
            <p className="num text-sm text-popa-soft">{fmtNumber(total, 0)} XP</p>
            {nextMin !== null ? (
              <>
                <ProgressBar className="mt-2" value={total - curMin} max={nextMin - curMin} />
                <p className="mt-1.5 text-xs text-mute">Faltam <b className="text-zinc-200">{fmtNumber(toNext, 0)} XP</b> para {xp.data?.next_level_name}</p>
              </>
            ) : <p className="mt-1 text-xs text-mute">Nível máximo alcançado. Lenda.</p>}
          </div>
        </div>
      </Card>

      {!hasAny ? (
        <EmptyState icon={<Dumbbell size={22} />} title="Seu primeiro registro começa aqui"
          text="Registre qualquer atividade, mesmo uma caminhada curta. O XP e as conquistas nascem dos seus registros reais."
          action={<Button variant="primary" onClick={() => openWorkout()}>Registrar primeira atividade</Button>} />
      ) : null}

      {/* Números */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Treinos realizados" value={workouts.length} sub="desde o início" icon={<Activity size={15} />} />
        <Stat label="Tempo de atividade" value={fmtMinutes(totalMinutes(workouts))} sub="total acumulado" icon={<Clock size={15} />} />
        <Stat label="Peso mais recente" value={latestWeight?.weight_kg != null ? `${fmtNumber(Number(latestWeight.weight_kg))} kg` : '—'}
          sub={latestWeight ? new Date(latestWeight.date + 'T12:00').toLocaleDateString('pt-BR') : 'sem registro ainda'} icon={<Scale size={15} />} />
        <Stat label="Dias ativos seguidos" value={streak} sub={streak > 0 ? 'sequência atual' : 'recomece quando quiser'} icon={<Flame size={15} />} />
      </div>

      {/* Semana */}
      <Card>
        <CardTitle right={<span className="text-xs text-mute">meta: {goal} atividades</span>}>Consistência desta semana</CardTitle>
        <div className="flex items-end justify-between">
          <div className="num text-3xl font-bold">{weekWorkouts.length}<span className="text-lg text-mute">/{goal}</span></div>
          <span className="text-xs text-mute">{weekWorkouts.length >= goal ? 'Meta da semana cumprida' : `faltam ${goal - weekWorkouts.length}`}</span>
        </div>
        <ProgressBar className="mt-2" value={weekWorkouts.length} max={goal} />
        <div className="mt-4 grid grid-cols-7 gap-1.5">
          {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d) => {
            const done = weekWorkouts.some((x) => x.date === d);
            const isToday = d === today;
            return (
              <div key={d} className="flex flex-col items-center gap-1.5">
                <span className="text-[10px] uppercase text-mute">{weekdayShort(d)}</span>
                <span className={`grid h-9 w-9 place-items-center rounded-xl border text-xs font-semibold ${done ? 'border-popa/50 bg-popa/20 text-popa-soft' : isToday ? 'border-popa/40 text-zinc-300' : 'border-white/[0.07] text-zinc-600'}`}>
                  {done ? '✓' : d.slice(8)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Missões */}
      <Card>
        <CardTitle right={<Target size={16} className="text-popa" />}>Missões da semana</CardTitle>
        {missions.length === 0 ? <p className="text-sm text-mute">Todas as metas estão em zero. Ajuste em Configurações.</p> : (
          <div className="space-y-3.5">
            {missions.map((m) => (
              <div key={m.code}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className={m.done ? 'text-popa-soft' : 'text-zinc-200'}>{m.done ? '✓ ' : ''}{m.title}</span>
                  <span className="num text-xs text-mute">{Math.min(m.progress, 9999)}/{m.target}{m.unit ? ` ${m.unit}` : ''}</span>
                </div>
                <ProgressBar value={m.progress} max={m.target} />
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-zinc-500">Metas flexíveis. Descansar faz parte e nunca tira pontos.</p>
      </Card>

      {/* Gráfico */}
      <Card>
        <CardTitle>Consistência, últimas 8 semanas</CardTitle>
        {hasAny ? <BarsChart data={buckets as never} series={[{ key: 'count', name: 'Atividades', color: C.green }]} goal={goal} integer height={170} />
          : <ChartEmpty />}
      </Card>

      {/* Recentes */}
      <Card>
        <CardTitle right={<Link to="/treinos" className="text-xs text-popa">Ver tudo</Link>}>Atividades recentes</CardTitle>
        {workouts.length ? <div className="space-y-2">{workouts.slice(0, 5).map((x) => <WorkoutRow key={x.id} w={x} />)}</div>
          : <p className="text-sm text-mute">Nada por aqui ainda.</p>}
      </Card>

      {/* Atalhos */}
      <div className="grid grid-cols-3 gap-2.5">
        <Button variant="soft" className="flex-col !gap-1 !py-3 text-xs" onClick={() => openWorkout()}><Dumbbell size={18} className="text-popa" />Treino</Button>
        <Button variant="soft" className="flex-col !gap-1 !py-3 text-xs" onClick={() => openBody()}><Scale size={18} className="text-popa" />Peso</Button>
        <Button variant="soft" className="flex-col !gap-1 !py-3 text-xs" onClick={() => openSleep()}><Moon size={18} className="text-popa" />Sono</Button>
      </div>
      <Link to="/conquistas" className="card flex items-center gap-3 text-sm"><Trophy size={18} className="text-popa" /> Ver conquistas e medalhas</Link>
    </div>
  );
}

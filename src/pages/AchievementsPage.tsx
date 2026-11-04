import {
  Award, Calendar, CalendarCheck, CalendarRange, Camera, Flame, Hourglass, Lock, Medal, Moon, Rocket, Ruler, Scale, Sprout, Timer, Trophy, Zap, type LucideIcon,
} from 'lucide-react';
import { Card, CardTitle, ErrorBlock, LoadingBlock, PageHeader, ProgressBar } from '../components/ui';
import { useAchievementDefs, useAchievements, useLevels, useMissionResults, useXp } from '../lib/data';
import { fmtDateBR } from '../lib/dates';
import { fmtNumber } from '../lib/format';
import { MISSIONS } from '../lib/stats';

const ICONS: Record<string, LucideIcon> = {
  sprout: Sprout, flame: Flame, medal: Medal, award: Award, trophy: Trophy, timer: Timer, hourglass: Hourglass,
  'calendar-check': CalendarCheck, 'calendar-range': CalendarRange, ruler: Ruler, scale: Scale, moon: Moon, rocket: Rocket, zap: Zap, camera: Camera,
};

export function AchievementsPage() {
  const defs = useAchievementDefs();
  const mine = useAchievements();
  const levels = useLevels();
  const xp = useXp();
  const missions = useMissionResults();

  const err = defs.error || mine.error || levels.error || xp.error || missions.error;
  if (err) return <ErrorBlock error={err} onRetry={() => { defs.refetch(); mine.refetch(); levels.refetch(); xp.refetch(); missions.refetch(); }} />;
  if (!defs.data || !mine.data || !levels.data) return <LoadingBlock />;

  const unlocked = new Map(mine.data.map((a) => [a.code, a.unlocked_at]));
  const total = xp.data?.total_xp ?? 0;
  const done = defs.data.filter((d) => unlocked.has(d.code)).length;
  const weeksDone = new Set((missions.data ?? []).filter((m) => m.mission_code === 'activities').map((m) => m.week_key)).size;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Progressão" title="Conquistas" subtitle="Cada etapa conta. Não existe evolução pequena demais." />

      <Card>
        <CardTitle right={<span className="text-xs text-mute">{fmtNumber(total, 0)} XP</span>}>Níveis</CardTitle>
        <ol className="space-y-2.5">
          {levels.data.map((l) => {
            const reached = total >= l.min_xp;
            const current = xp.data?.level === l.level;
            return (
              <li key={l.level} className={`flex items-center gap-3 rounded-xl border p-2.5 ${current ? 'border-popa/50 bg-popa/10' : 'border-white/[0.06]'}`}>
                <span className={`num grid h-8 w-8 place-items-center rounded-lg text-sm font-bold ${reached ? 'bg-popa text-ink' : 'bg-ink-600 text-zinc-500'}`}>{l.level}</span>
                <span className="flex-1">
                  <span className={`block text-sm font-semibold ${reached ? '' : 'text-zinc-500'}`}>{l.name}{current && <span className="ml-2 text-[10px] uppercase tracking-widest text-popa">você está aqui</span>}</span>
                  <span className="block text-xs text-mute">{fmtNumber(l.min_xp, 0)} XP</span>
                </span>
                {reached && <span className="text-popa">✓</span>}
              </li>
            );
          })}
        </ol>
        {xp.data?.next_level_min_xp != null && (
          <div className="mt-3">
            <ProgressBar value={total - (xp.data.level_min_xp ?? 0)} max={xp.data.next_level_min_xp - (xp.data.level_min_xp ?? 0)} />
            <p className="mt-1.5 text-xs text-mute">Faltam {fmtNumber(xp.data.next_level_min_xp - total, 0)} XP para {xp.data.next_level_name}.</p>
          </div>
        )}
      </Card>

      <Card>
        <CardTitle right={<span className="text-xs text-mute">{done}/{defs.data.length}</span>}>Medalhas</CardTitle>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {defs.data.map((d) => {
            const at = unlocked.get(d.code);
            const Icon = ICONS[d.icon] ?? Calendar;
            return (
              <div key={d.code} className={`rounded-2xl border p-3.5 transition ${at ? 'border-popa/40 bg-gradient-to-br from-popa/15 to-transparent' : 'border-white/[0.06] opacity-60'}`}>
                <span className={`grid h-11 w-11 place-items-center rounded-xl ${at ? 'bg-popa text-ink shadow-[0_8px_24px_-8px_rgba(34,197,94,0.9)]' : 'bg-ink-600 text-zinc-500'}`}>
                  {at ? <Icon size={21} /> : <Lock size={17} />}
                </span>
                <p className="mt-2.5 text-sm font-semibold leading-tight">{d.title}</p>
                <p className="mt-0.5 text-[11px] leading-snug text-mute">{d.description}</p>
                {at && <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-popa">{fmtDateBR(at.slice(0, 10))}</p>}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Como funciona o XP</CardTitle>
        <ul className="space-y-1.5 text-sm text-zinc-300">
          <li>Musculação <b>30 XP</b> · Cardio <b>25 XP</b> · Outro exercício <b>20 XP</b></li>
          <li>Só <b>1 treino por dia</b> rende XP (o de maior valor). Os demais contam como atividade.</li>
          <li><b>+20 XP</b> uma vez por semana ao cumprir a meta de atividades. Semanas cumpridas: <b>{weeksDone}</b>.</li>
          <li>Descansar nunca tira XP. A regularidade vale mais que a intensidade.</li>
        </ul>
        <p className="mt-3 text-xs text-zinc-500">Missões acompanhadas: {MISSIONS.map((m) => m.title.toLowerCase()).join(', ')}.</p>
      </Card>
    </div>
  );
}

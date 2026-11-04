import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Dumbbell, Home, LayoutGrid, Moon, Plus, Ruler, Scale, Activity } from 'lucide-react';
import { Logo } from './Logo';
import { SyncIndicator } from './SyncIndicator';
import { Sheet } from './ui';
import { useEditors } from '../features/editors/EditorsProvider';
import { useAchievementDefs, useLevels, useXp } from '../lib/data';

const TABS = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/treinos', label: 'Treinos', icon: Dumbbell },
  { to: '/corpo', label: 'Corpo', icon: Ruler },
  { to: '/sono', label: 'Sono', icon: Moon },
  { to: '/mais', label: 'Mais', icon: LayoutGrid },
];

export function Layout() {
  const { openWorkout, openBody, openSleep } = useEditors();
  const [quick, setQuick] = useState(false);
  const { data: xp } = useXp();
  useLevels();
  useAchievementDefs(); // pré-carrega catálogos para os avisos de conquista
  const { pathname } = useLocation();

  const pick = (fn: () => void) => { setQuick(false); fn(); };

  return (
    <div className="mx-auto min-h-[100dvh] w-full max-w-3xl px-4 pb-[calc(6.5rem+var(--safe-bottom))] pt-[calc(0.9rem+var(--safe-top))]">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={34} />
          <div className="leading-tight">
            <div className="font-display text-[13px] font-bold tracking-[0.2em]">PROJETO POPA</div>
            {xp?.level_name && <div className="text-[11px] text-popa-soft/80">Nível {xp.level} · {xp.level_name}</div>}
          </div>
        </div>
        <SyncIndicator />
      </div>

      <main key={pathname} className="animate-rise"><Outlet /></main>

      <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(0.6rem+var(--safe-bottom))]">
        <div className="mx-auto grid max-w-md grid-cols-6 items-center rounded-3xl border border-white/10 bg-ink-800/90 px-1.5 py-1.5 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.9)] backdrop-blur-xl">
          {TABS.slice(0, 2).map((t) => <Tab key={t.to} {...t} />)}
          <button type="button" onClick={() => setQuick(true)} aria-label="Registrar"
            className="mx-auto -mt-6 grid h-14 w-14 place-items-center rounded-full bg-popa text-ink shadow-[0_10px_30px_-6px_rgba(34,197,94,0.8)] ring-4 ring-ink transition active:scale-95">
            <Plus size={26} strokeWidth={2.6} />
          </button>
          {TABS.slice(2).map((t) => <Tab key={t.to} {...t} />)}
        </div>
      </nav>

      <Sheet open={quick} onClose={() => setQuick(false)} title="O que você quer registrar?">
        <div className="grid gap-2.5 pb-3 pt-1">
          <QuickItem icon={<Activity size={20} />} title="Treino ou atividade" text="Musculação, cardio ou outro exercício" onClick={() => pick(() => openWorkout())} />
          <QuickItem icon={<Scale size={20} />} title="Peso e medidas" text="Peso, cintura, peito, quadril, braço" onClick={() => pick(() => openBody())} />
          <QuickItem icon={<Moon size={20} />} title="Sono" text="Horas dormidas e qualidade" onClick={() => pick(() => openSleep())} />
        </div>
      </Sheet>
    </div>
  );
}

function Tab({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Home; end?: boolean }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => `flex min-h-[48px] flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-medium transition ${isActive ? 'text-popa' : 'text-zinc-500 hover:text-zinc-300'}`}>
      <Icon size={20} />
      {label}
    </NavLink>
  );
}

function QuickItem({ icon, title, text, onClick }: { icon: React.ReactNode; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-ink-700 p-4 text-left transition hover:border-popa/40 active:scale-[0.99]">
      <span className="grid h-11 w-11 place-items-center rounded-xl bg-popa/10 text-popa">{icon}</span>
      <span><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-mute">{text}</span></span>
    </button>
  );
}

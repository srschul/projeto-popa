import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { WorkoutSheet } from './WorkoutSheet';
import { BodySheet } from './BodySheet';
import { SleepSheet } from './SleepSheet';
import type { BodyEntry, SleepLog, Workout } from '../../lib/types';

interface EditorsApi {
  openWorkout: (w?: Workout) => void;
  openBody: (e?: BodyEntry) => void;
  openSleep: (l?: SleepLog) => void;
}
const Ctx = createContext<EditorsApi | null>(null);

type Open = { kind: 'workout'; item: Workout | null } | { kind: 'body'; item: BodyEntry | null } | { kind: 'sleep'; item: SleepLog | null } | null;

export function EditorsProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open>(null);
  const close = useCallback(() => setOpen(null), []);
  const api = useMemo<EditorsApi>(() => ({
    openWorkout: (w) => setOpen({ kind: 'workout', item: w ?? null }),
    openBody: (e) => setOpen({ kind: 'body', item: e ?? null }),
    openSleep: (l) => setOpen({ kind: 'sleep', item: l ?? null }),
  }), []);

  return (
    <Ctx.Provider value={api}>
      {children}
      <WorkoutSheet open={open?.kind === 'workout'} onClose={close} workout={open?.kind === 'workout' ? open.item : null} />
      <BodySheet open={open?.kind === 'body'} onClose={close} entry={open?.kind === 'body' ? open.item : null} />
      <SleepSheet open={open?.kind === 'sleep'} onClose={close} log={open?.kind === 'sleep' ? open.item : null} />
    </Ctx.Provider>
  );
}

export function useEditors(): EditorsApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useEditors fora do EditorsProvider');
  return v;
}

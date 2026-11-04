import { useState } from 'react';
import { ChevronDown, Dumbbell, HeartPulse, Pencil, Trash2, Zap } from 'lucide-react';
import { fmtDateBR } from '../lib/dates';
import { INTENSITY_LABEL, TYPE_LABEL, fmtNumber, fmtPace } from '../lib/format';
import { deleteWorkout } from '../lib/data';
import { useAfterSave, useErrorToast } from '../lib/useSave';
import { useConfirm } from './Confirm';
import { useEditors } from '../features/editors/EditorsProvider';
import type { Workout } from '../lib/types';

export const TYPE_ICON = { strength: Dumbbell, cardio: HeartPulse, other: Zap } as const;

export function WorkoutRow({ w, detailed }: { w: Workout; detailed?: boolean }) {
  const [open, setOpen] = useState(false);
  const { openWorkout } = useEditors();
  const confirm = useConfirm();
  const afterSave = useAfterSave();
  const onError = useErrorToast();
  const Icon = TYPE_ICON[w.type];
  const expandable = detailed && (w.workout_exercises.length > 0 || w.cardio_details || w.notes);

  async function remove() {
    const ok = await confirm({ title: 'Excluir atividade?', text: `"${w.name || TYPE_LABEL[w.type]}" de ${fmtDateBR(w.date)} será removida, junto com o XP dela.` });
    if (!ok) return;
    try {
      await deleteWorkout(w.id);
      await afterSave('Atividade excluída');
    } catch (e) {
      onError(e);
    }
  }

  return (
    <div className="card-flat !p-0">
      <div className="flex items-center gap-3 p-3">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => expandable && setOpen(!open)} aria-expanded={expandable ? open : undefined}>
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-popa/10 text-popa"><Icon size={18} /></span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{w.name || TYPE_LABEL[w.type]}</span>
            <span className="block truncate text-xs text-mute">{fmtDateBR(w.date)} · {TYPE_LABEL[w.type]} · {INTENSITY_LABEL[w.intensity]}</span>
          </span>
        </button>
        <span className="num shrink-0 text-sm font-semibold text-popa-soft">{w.duration_min} min</span>
        {detailed && (
          <div className="flex shrink-0 items-center">
            <button type="button" aria-label="Editar" onClick={() => openWorkout(w)} className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-200"><Pencil size={15} /></button>
            <button type="button" aria-label="Excluir" onClick={remove} className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={15} /></button>
            {expandable && <ChevronDown size={16} className={`mx-1 text-zinc-600 transition ${open ? 'rotate-180' : ''}`} />}
          </div>
        )}
      </div>

      {open && (
        <div className="space-y-2 border-t border-white/[0.06] px-3 pb-3 pt-2.5 text-xs">
          {w.cardio_details && (
            <p className="text-zinc-300">
              {w.cardio_details.modality || 'Cardio'}
              {w.cardio_details.distance_km != null && <> · {fmtNumber(Number(w.cardio_details.distance_km), 2)} km</>}
              {w.cardio_details.pace_sec_per_km != null && <> · {fmtPace(w.cardio_details.pace_sec_per_km)}</>}
              {w.cardio_details.avg_speed_kmh != null && <> · {fmtNumber(Number(w.cardio_details.avg_speed_kmh), 1)} km/h</>}
            </p>
          )}
          {w.workout_exercises.map((e) => (
            <div key={e.id}>
              <p className="font-semibold text-zinc-200">{e.name}{e.muscle_group && <span className="font-normal text-mute"> · {e.muscle_group}</span>}</p>
              {e.exercise_sets.length > 0 && (
                <p className="text-zinc-400">{e.exercise_sets.map((s) => `${s.reps}×${fmtNumber(Number(s.weight_kg), 2)}kg`).join('  ·  ')}</p>
              )}
              {e.notes && <p className="italic text-zinc-500">{e.notes}</p>}
            </div>
          ))}
          {w.notes && <p className="italic text-zinc-400">“{w.notes}”</p>}
        </div>
      )}
    </div>
  );
}

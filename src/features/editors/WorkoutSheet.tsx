import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Field, Segmented, Sheet } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { saveWorkout, useWorkouts, type ExerciseInput } from '../../lib/data';
import { INTENSITY_LABEL, MUSCLE_GROUPS, TYPE_LABEL, TYPE_XP, parseDecimal } from '../../lib/format';
import { exerciseNames, lastSetsFor } from '../../lib/stats';
import { todayISO } from '../../lib/dates';
import { useAfterSave, useErrorToast } from '../../lib/useSave';
import type { Intensity, Workout, WorkoutType } from '../../lib/types';

interface SetDraft { reps: string; weight: string }
interface ExerciseDraft { key: number; name: string; muscle_group: string; notes: string; sets: SetDraft[] }

let keySeq = 0;
const blankExercise = (): ExerciseDraft => ({ key: ++keySeq, name: '', muscle_group: '', notes: '', sets: [{ reps: '', weight: '' }] });

function fromWorkout(w: Workout): ExerciseDraft[] {
  return w.workout_exercises.map((e) => ({
    key: ++keySeq, name: e.name, muscle_group: e.muscle_group, notes: e.notes,
    sets: e.exercise_sets.length ? e.exercise_sets.map((s) => ({ reps: String(s.reps), weight: String(Number(s.weight_kg)).replace('.', ',') })) : [{ reps: '', weight: '' }],
  }));
}

export function WorkoutSheet({ open, onClose, workout }: { open: boolean; onClose: () => void; workout?: Workout | null }) {
  const { user } = useAuth();
  const { data: all = [] } = useWorkouts();
  const afterSave = useAfterSave();
  const onError = useErrorToast();

  const [type, setType] = useState<WorkoutType>('strength');
  const [date, setDate] = useState(todayISO());
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [intensity, setIntensity] = useState<Intensity>('moderate');
  const [notes, setNotes] = useState('');
  const [exercises, setExercises] = useState<ExerciseDraft[]>([]);
  const [modality, setModality] = useState('');
  const [distance, setDistance] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null); setBusy(false);
    if (workout) {
      setType(workout.type); setDate(workout.date); setName(workout.name); setDuration(String(workout.duration_min));
      setIntensity(workout.intensity); setNotes(workout.notes); setExercises(fromWorkout(workout));
      setModality(workout.cardio_details?.modality ?? '');
      setDistance(workout.cardio_details?.distance_km != null ? String(Number(workout.cardio_details.distance_km)).replace('.', ',') : '');
    } else {
      setType('strength'); setDate(todayISO()); setName(''); setDuration(''); setIntensity('moderate'); setNotes('');
      setExercises([]); setModality(''); setDistance('');
    }
  }, [open, workout]);

  const names = useMemo(() => exerciseNames(all), [all]);

  function patchExercise(key: number, patch: Partial<ExerciseDraft>) {
    setExercises((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }
  function patchSet(key: number, i: number, patch: Partial<SetDraft>) {
    setExercises((xs) => xs.map((x) => (x.key === key ? { ...x, sets: x.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : x)));
  }
  /** Ao escolher um exercício já conhecido, sugere as cargas da última vez (só se as séries ainda estão vazias). */
  function onExerciseNameBlur(ex: ExerciseDraft) {
    const untouched = ex.sets.every((s) => !s.reps && !s.weight);
    const last = ex.name.trim() ? lastSetsFor(all.filter((w) => w.id !== workout?.id), ex.name) : null;
    if (untouched && last) {
      patchExercise(ex.key, { sets: last.map((s) => ({ reps: String(s.reps), weight: String(s.weight_kg).replace('.', ',') })) });
    }
  }

  async function submit() {
    setError(null);
    const dur = parseDecimal(duration);
    if (!dur || dur < 1 || dur > 600 || !Number.isInteger(dur)) return setError('Informe a duração em minutos (1 a 600).');
    if (!date) return setError('Informe a data.');

    let exs: ExerciseInput[] = [];
    if (type === 'strength') {
      for (const ex of exercises) {
        if (!ex.name.trim()) continue;
        const sets = [];
        for (const s of ex.sets) {
          if (!s.reps && !s.weight) continue;
          const reps = parseDecimal(s.reps);
          const w = s.weight ? parseDecimal(s.weight) : 0;
          if (reps === null || !Number.isInteger(reps) || reps < 0 || w === null || w < 0)
            return setError(`Confira as séries de "${ex.name}": repetições inteiras e carga em kg.`);
          sets.push({ reps, weight_kg: w });
        }
        exs.push({ name: ex.name, muscle_group: ex.muscle_group, notes: ex.notes, sets });
      }
    }
    let cardio = null;
    if (type === 'cardio') {
      const km = distance.trim() ? parseDecimal(distance) : null;
      if (distance.trim() && (km === null || km < 0)) return setError('Distância inválida.');
      cardio = { modality: modality.trim(), distance_km: km };
    }
    if (type !== 'strength') exs = [];

    setBusy(true);
    try {
      await saveWorkout(
        { id: workout?.id, date, type, name, duration_min: dur, intensity, notes, exercises: exs, cardio },
        user!.id, workout ?? undefined,
      );
      onClose();
      await afterSave(workout ? 'Atividade atualizada' : 'Atividade salva');
    } catch (e) {
      onError(e);
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={workout ? 'Editar atividade' : 'Registrar atividade'}
      footer={
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
          <Button variant="primary" className="flex-1" onClick={submit} disabled={busy}>
            {busy ? 'Salvando…' : workout ? 'Salvar alterações' : `Salvar · +${TYPE_XP[type]} XP`}
          </Button>
        </div>
      }>
      <div className="space-y-4 pt-1">
        <Segmented value={type} onChange={setType} options={(['strength', 'cardio', 'other'] as WorkoutType[]).map((t) => ({ value: t, label: t === 'other' ? 'Outro' : TYPE_LABEL[t] }))} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Data"><input className="input" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Duração (min)"><input className="input" inputMode="numeric" placeholder="50" value={duration} onChange={(e) => setDuration(e.target.value.replace(/\D/g, ''))} /></Field>
        </div>

        <Field label="Nome (opcional)">
          <input className="input" placeholder={type === 'strength' ? 'Ex.: Peito e tríceps' : type === 'cardio' ? 'Ex.: Corrida leve' : 'Ex.: Futebol'} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>

        <div>
          <span className="label">Intensidade</span>
          <Segmented value={intensity} onChange={setIntensity} options={(['light', 'moderate', 'intense'] as Intensity[]).map((i) => ({ value: i, label: INTENSITY_LABEL[i] }))} />
        </div>

        {type === 'cardio' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Modalidade"><input className="input" placeholder="Corrida, bike…" value={modality} onChange={(e) => setModality(e.target.value)} /></Field>
            <Field label="Distância (km)" hint="Opcional. Ritmo é calculado sozinho."><input className="input" inputMode="decimal" placeholder="5,0" value={distance} onChange={(e) => setDistance(e.target.value)} /></Field>
          </div>
        )}

        {type === 'strength' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="label !mb-0">Exercícios <span className="text-zinc-600">(opcional)</span></span>
            </div>
            <datalist id="exercise-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
            {exercises.map((ex) => (
              <div key={ex.key} className="card-flat space-y-3">
                <div className="flex gap-2">
                  <input className="input" list="exercise-names" placeholder="Nome do exercício" value={ex.name}
                    onChange={(e) => patchExercise(ex.key, { name: e.target.value })} onBlur={() => onExerciseNameBlur(ex)} aria-label="Nome do exercício" />
                  <button type="button" aria-label="Remover exercício" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-zinc-500 hover:bg-white/5 hover:text-red-300"
                    onClick={() => setExercises((xs) => xs.filter((x) => x.key !== ex.key))}><Trash2 size={16} /></button>
                </div>
                <select className="input" value={ex.muscle_group} onChange={(e) => patchExercise(ex.key, { muscle_group: e.target.value })} aria-label="Grupo muscular">
                  <option value="">Grupo muscular</option>
                  {MUSCLE_GROUPS.map((g) => <option key={g}>{g}</option>)}
                </select>
                <div className="space-y-2">
                  {ex.sets.map((s, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-12 shrink-0 text-xs text-mute">Série {i + 1}</span>
                      <input className="input !px-2 text-center" inputMode="numeric" placeholder="reps" aria-label={`Repetições da série ${i + 1}`} value={s.reps} onChange={(e) => patchSet(ex.key, i, { reps: e.target.value.replace(/\D/g, '') })} />
                      <span className="text-zinc-600">×</span>
                      <input className="input !px-2 text-center" inputMode="decimal" placeholder="kg" aria-label={`Carga da série ${i + 1}`} value={s.weight} onChange={(e) => patchSet(ex.key, i, { weight: e.target.value })} />
                      <button type="button" aria-label="Remover série" disabled={ex.sets.length === 1} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-600 hover:text-red-300 disabled:opacity-30"
                        onClick={() => patchExercise(ex.key, { sets: ex.sets.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <Button small variant="ghost" onClick={() => patchExercise(ex.key, { sets: [...ex.sets, { ...ex.sets[ex.sets.length - 1], }] })}>
                    <Plus size={14} /> Série
                  </Button>
                </div>
                <input className="input" placeholder="Observação do exercício (opcional)" value={ex.notes} onChange={(e) => patchExercise(ex.key, { notes: e.target.value })} />
              </div>
            ))}
            <Button variant="soft" className="w-full" onClick={() => setExercises((xs) => [...xs, blankExercise()])}><Plus size={16} /> Adicionar exercício</Button>
          </div>
        )}

        <Field label="Observações (opcional)">
          <textarea className="input min-h-[72px] resize-none" placeholder="Como você se sentiu?" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      </div>
    </Sheet>
  );
}

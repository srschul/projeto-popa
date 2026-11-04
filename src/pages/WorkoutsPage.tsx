import { useMemo, useState } from 'react';
import { Dumbbell, Plus } from 'lucide-react';
import { Button, Card, CardTitle, ChartEmpty, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Segmented } from '../components/ui';
import { LinesChart, C } from '../components/charts';
import { WorkoutRow } from '../components/WorkoutRow';
import { useEditors } from '../features/editors/EditorsProvider';
import { useWorkouts } from '../lib/data';
import { TYPE_LABEL } from '../lib/format';
import { exerciseNames, loadSeries } from '../lib/stats';
import type { WorkoutType } from '../lib/types';

type Filter = 'all' | WorkoutType;

export function WorkoutsPage() {
  const { openWorkout } = useEditors();
  const q = useWorkouts();
  const [filter, setFilter] = useState<Filter>('all');
  const [exercise, setExercise] = useState('');

  const workouts = q.data ?? [];
  const names = useMemo(() => exerciseNames(workouts), [workouts]);
  const selected = exercise && names.includes(exercise) ? exercise : names[0] ?? '';
  const series = useMemo(() => (selected ? loadSeries(workouts, selected) : []), [workouts, selected]);

  if (q.error) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingBlock />;

  const list = filter === 'all' ? workouts : workouts.filter((w) => w.type === filter);

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Atividade" title="Treinos" subtitle="Todo movimento conta."
        action={<Button variant="primary" small onClick={() => openWorkout()}><Plus size={15} /> Registrar</Button>} />

      {workouts.length === 0 ? (
        <EmptyState icon={<Dumbbell size={22} />} title="Nenhuma atividade ainda"
          text="Não precisa ser um treino perfeito. Registre o que você conseguiu fazer hoje."
          action={<Button variant="primary" onClick={() => openWorkout()}>Registrar atividade</Button>} />
      ) : (
        <>
          {names.length > 0 && (
            <Card>
              <CardTitle right={
                <select aria-label="Exercício" className="input !w-auto !py-1.5 !text-sm" value={selected} onChange={(e) => setExercise(e.target.value)}>
                  {names.map((n) => <option key={n}>{n}</option>)}
                </select>}>Evolução da carga</CardTitle>
              {series.length >= 2 ? (
                <LinesChart data={series as never} unit="kg" series={[{ key: 'maxKg', name: 'Maior carga', color: C.green }]} height={170} />
              ) : <ChartEmpty text="Registre este exercício em pelo menos duas datas para ver a evolução." />}
            </Card>
          )}

          <Segmented value={filter} onChange={setFilter}
            options={[{ value: 'all', label: 'Todos' }, ...(['strength', 'cardio', 'other'] as WorkoutType[]).map((t) => ({ value: t, label: TYPE_LABEL[t].replace(' exercício', '') }))]} />

          <div className="space-y-2">
            {list.length ? list.map((w) => <WorkoutRow key={w.id} w={w} detailed />) : <p className="py-8 text-center text-sm text-mute">Nenhuma atividade deste tipo.</p>}
          </div>
        </>
      )}
    </div>
  );
}

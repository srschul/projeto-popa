import { useState } from 'react';
import { Moon, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, CardTitle, ChartEmpty, EmptyState, ErrorBlock, LoadingBlock, PageHeader, Segmented, Stat } from '../components/ui';
import { BarsChart, C } from '../components/charts';
import { useConfirm } from '../components/Confirm';
import { useEditors } from '../features/editors/EditorsProvider';
import { deleteSleep, useSleep } from '../lib/data';
import { addDays, fmtDateBR, todayISO } from '../lib/dates';
import { QUALITY_LABEL, fmtNumber } from '../lib/format';
import { inRange, monthlySleepAverages, sleepAverage, weeklySleepAverages, weeksCovering } from '../lib/stats';
import { useAfterSave, useErrorToast } from '../lib/useSave';

export function SleepPage() {
  const { openSleep } = useEditors();
  const q = useSleep();
  const [view, setView] = useState<'week' | 'month'>('week');
  const confirm = useConfirm();
  const afterSave = useAfterSave();
  const onError = useErrorToast();

  if (q.error) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return <LoadingBlock />;

  const logs = q.data;
  const today = todayISO();
  const last7 = inRange(logs, addDays(today, -6), today);
  const prev7 = inRange(logs, addDays(today, -13), addDays(today, -7));
  const avg7 = sleepAverage(last7);
  const avgPrev = sleepAverage(prev7);
  const avgAll = sleepAverage(logs);
  const delta = avg7 !== null && avgPrev !== null ? Math.round((avg7 - avgPrev) * 10) / 10 : null;

  const data = view === 'week'
    ? weeklySleepAverages(logs, weeksCovering(addDays(today, -7 * 7), today))
    : monthlySleepAverages(logs, addDays(today, -30 * 5), today);

  async function remove(id: string, date: string) {
    if (!(await confirm({ title: 'Excluir registro?', text: `O sono de ${fmtDateBR(date)} será removido.` }))) return;
    try { await deleteSleep(id); await afterSave('Registro excluído'); } catch (e) { onError(e); }
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Recuperação" title="Sono" subtitle="Descansar também é treinar."
        action={<Button variant="primary" small onClick={() => openSleep()}><Plus size={15} /> Registrar</Button>} />

      {logs.length === 0 ? (
        <EmptyState icon={<Moon size={22} />} title="Nenhuma noite registrada"
          text="Anote quantas horas você dormiu. Com algumas noites registradas, o app mostra sua média e a comparação entre períodos."
          action={<Button variant="primary" onClick={() => openSleep()}>Registrar sono</Button>} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Média, últimos 7 dias" value={avg7 !== null ? `${fmtNumber(avg7)} h` : '—'} sub={`${last7.length} noite(s) registrada(s)`} />
            <Stat label="Média de todo o histórico" value={avgAll !== null ? `${fmtNumber(avgAll)} h` : '—'} sub={`${logs.length} noite(s)`} />
          </div>

          <Card>
            <CardTitle>Comparação com a semana anterior</CardTitle>
            {delta === null ? <p className="text-sm text-mute">Precisa de registros nos dois períodos de 7 dias para comparar.</p> : (
              <p className="text-sm text-zinc-300">
                Últimos 7 dias: <b>{fmtNumber(avg7!)} h</b> · 7 dias anteriores: <b>{fmtNumber(avgPrev!)} h</b>{' '}
                <span className={delta >= 0 ? 'text-popa' : 'text-amber-300'}>({delta > 0 ? '+' : ''}{fmtNumber(delta)} h)</span>
              </p>
            )}
          </Card>

          <Card>
            <CardTitle>Média de horas</CardTitle>
            <Segmented value={view} onChange={setView} className="mb-3" options={[{ value: 'week', label: 'Por semana' }, { value: 'month', label: 'Por mês' }]} />
            {data.some((d) => d.hours !== null) ? <BarsChart data={data as never} series={[{ key: 'hours', name: 'Média', color: C.blue }]} unit="h" height={180} /> : <ChartEmpty />}
          </Card>

          <Card>
            <CardTitle>Histórico</CardTitle>
            <div className="space-y-2">
              {logs.map((l) => (
                <div key={l.id} className="card-flat flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-400/10 text-sky-300"><Moon size={17} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{fmtDateBR(l.date)} <span className="font-normal text-mute">· {QUALITY_LABEL[l.quality]}</span></div>
                    {l.notes && <div className="truncate text-xs text-mute">{l.notes}</div>}
                  </div>
                  <span className="num text-sm font-semibold">{fmtNumber(Number(l.hours))} h</span>
                  <button type="button" aria-label="Editar" onClick={() => openSleep(l)} className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-zinc-200"><Pencil size={15} /></button>
                  <button type="button" aria-label="Excluir" onClick={() => remove(l.id, l.date)} className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

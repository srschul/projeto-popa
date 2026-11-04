import { useEffect, useState } from 'react';
import { Download, LogOut, Minus, Plus } from 'lucide-react';
import { Button, Card, CardTitle, ErrorBlock, LoadingBlock, PageHeader } from '../components/ui';
import { useAuth } from '../features/auth/AuthProvider';
import { buildBackup, saveSettings, useSettings } from '../lib/data';
import { todayISO } from '../lib/dates';
import { useAfterSave, useErrorToast } from '../lib/useSave';
import { useToast } from '../components/Toast';
import type { UserSettings } from '../lib/types';

type Goals = Omit<UserSettings, 'user_id'>;

const GOALS: { key: keyof Goals; label: string; hint: string; min: number; max: number; step: number; unit: string }[] = [
  { key: 'weekly_activities_goal', label: 'Atividades por semana', hint: 'Meta principal. Cumpri-la rende o bônus semanal de XP.', min: 0, max: 14, step: 1, unit: '' },
  { key: 'weekly_strength_goal', label: 'Treinos de musculação por semana', hint: '', min: 0, max: 14, step: 1, unit: '' },
  { key: 'weekly_cardio_goal', label: 'Sessões de cardio por semana', hint: '', min: 0, max: 14, step: 1, unit: '' },
  { key: 'weekly_minutes_goal', label: 'Minutos de atividade por semana', hint: '', min: 0, max: 2000, step: 15, unit: 'min' },
  { key: 'weekly_sleep_nights_goal', label: 'Noites de sono registradas por semana', hint: '', min: 0, max: 7, step: 1, unit: '' },
];

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const q = useSettings(user?.id);
  const afterSave = useAfterSave();
  const onError = useErrorToast();
  const toast = useToast();
  const [goals, setGoals] = useState<Goals | null>(null);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (q.data) {
      const { user_id: _u, ...rest } = q.data;
      setGoals(rest);
    }
  }, [q.data]);

  if (q.error) return <ErrorBlock error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data || !goals) return <LoadingBlock />;

  const dirty = GOALS.some((g) => goals[g.key] !== q.data![g.key]);
  const bump = (k: keyof Goals, delta: number, min: number, max: number) =>
    setGoals((g) => (g ? { ...g, [k]: Math.min(max, Math.max(min, g[k] + delta)) } : g));

  async function save() {
    setBusy(true);
    try { await saveSettings(user!.id, goals!); await afterSave('Metas salvas'); } catch (e) { onError(e); } finally { setBusy(false); }
  }

  async function exportBackup() {
    setExporting(true);
    try {
      const data = await buildBackup(user!.id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `projeto-popa-backup-${todayISO()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast.show('Backup baixado');
    } catch (e) { onError(e); } finally { setExporting(false); }
  }

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Ajustes" title="Configurações" subtitle="Metas flexíveis: ajuste ao seu momento." />

      <Card>
        <CardTitle>Metas semanais</CardTitle>
        <div className="space-y-4">
          {GOALS.map((g) => (
            <div key={g.key} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{g.label}</p>
                <p className="text-[11px] text-mute">{g.hint || (goals[g.key] === 0 ? 'Desativada' : ' ')}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" aria-label={`Diminuir ${g.label}`} onClick={() => bump(g.key, -g.step, g.min, g.max)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-ink-600 active:scale-95"><Minus size={16} /></button>
                <span className="num w-14 text-center text-lg font-bold">{goals[g.key]}{g.unit && <span className="text-[10px] font-normal text-mute"> {g.unit}</span>}</span>
                <button type="button" aria-label={`Aumentar ${g.label}`} onClick={() => bump(g.key, g.step, g.min, g.max)} className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-ink-600 active:scale-95"><Plus size={16} /></button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-zinc-500">Meta em zero desativa a missão. Alterar a meta não apaga nem refaz XP já ganho.</p>
        <Button variant="primary" className="mt-4 w-full" disabled={!dirty || busy} onClick={save}>{busy ? 'Salvando…' : 'Salvar metas'}</Button>
      </Card>

      <Card>
        <CardTitle>Backup dos dados</CardTitle>
        <p className="mb-3 text-sm text-zinc-300">Baixe uma cópia de todos os seus registros (treinos, exercícios, séries, medidas, sono, XP e conquistas) em um arquivo JSON.</p>
        <Button variant="soft" className="w-full" onClick={exportBackup} disabled={exporting}><Download size={16} />{exporting ? 'Preparando…' : 'Baixar backup (JSON)'}</Button>
        <p className="mt-2 text-xs text-zinc-500">As fotos ficam guardadas em espaço privado e não entram no arquivo.</p>
      </Card>

      <Card>
        <CardTitle>Conta</CardTitle>
        <p className="mb-3 text-sm text-mute">{user?.email}</p>
        <Button variant="danger" className="w-full" onClick={() => signOut()}><LogOut size={16} /> Sair</Button>
      </Card>
    </div>
  );
}

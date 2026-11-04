import { useEffect, useState } from 'react';
import { Button, Field, Sheet } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { saveBody } from '../../lib/data';
import { parseDecimal } from '../../lib/format';
import { todayISO } from '../../lib/dates';
import { useAfterSave, useErrorToast } from '../../lib/useSave';
import type { BodyEntry } from '../../lib/types';

const FIELDS = [
  { key: 'weight_kg', label: 'Peso (kg)', min: 20, max: 400, ph: '78,5' },
  { key: 'waist_cm', label: 'Cintura (cm)', min: 20, max: 250, ph: '' },
  { key: 'chest_cm', label: 'Peito (cm)', min: 20, max: 250, ph: '' },
  { key: 'hip_cm', label: 'Quadril (cm)', min: 20, max: 250, ph: '' },
  { key: 'arm_cm', label: 'Braço (cm)', min: 10, max: 100, ph: '' },
] as const;
type Key = (typeof FIELDS)[number]['key'];

const show = (v: number | null) => (v === null || v === undefined ? '' : String(Number(v)).replace('.', ','));

export function BodySheet({ open, onClose, entry }: { open: boolean; onClose: () => void; entry?: BodyEntry | null }) {
  const { user } = useAuth();
  const afterSave = useAfterSave();
  const onError = useErrorToast();
  const [date, setDate] = useState(todayISO());
  const [v, setV] = useState<Record<Key, string>>({ weight_kg: '', waist_cm: '', chest_cm: '', hip_cm: '', arm_cm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null); setBusy(false);
    setDate(entry?.date ?? todayISO());
    setV({
      weight_kg: show(entry?.weight_kg ?? null), waist_cm: show(entry?.waist_cm ?? null), chest_cm: show(entry?.chest_cm ?? null),
      hip_cm: show(entry?.hip_cm ?? null), arm_cm: show(entry?.arm_cm ?? null),
    });
  }, [open, entry]);

  async function submit() {
    setError(null);
    const parsed = {} as Record<Key, number | null>;
    for (const f of FIELDS) {
      const raw = v[f.key];
      const n = parseDecimal(raw);
      if (raw.trim() && (n === null || n < f.min || n > f.max)) return setError(`${f.label}: informe um valor entre ${f.min} e ${f.max}.`);
      parsed[f.key] = n === null ? null : Math.round(n * 10) / 10;
    }
    if (Object.values(parsed).every((x) => x === null)) return setError('Preencha pelo menos um campo.');
    if (!date) return setError('Informe a data.');
    setBusy(true);
    try {
      await saveBody({ id: entry?.id, date, ...parsed }, user!.id);
      onClose();
      await afterSave(entry ? 'Registro atualizado' : 'Medidas salvas');
    } catch (e) {
      onError(e);
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={entry ? 'Editar medidas' : 'Peso e medidas'}
      footer={<div className="flex gap-2"><Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="primary" className="flex-1" onClick={submit} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</Button></div>}>
      <div className="space-y-4 pt-1">
        <Field label="Data"><input className="input" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} className={f.key === 'weight_kg' ? 'col-span-2' : ''}>
              <input className="input" inputMode="decimal" placeholder={f.ph || 'Opcional'} value={v[f.key]} onChange={(e) => setV({ ...v, [f.key]: e.target.value })} />
            </Field>
          ))}
        </div>
        <p className="text-xs text-zinc-500">Dica: meça em condições parecidas (mesmo horário, de preferência em jejum). Olhe a tendência, não um número isolado.</p>
        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      </div>
    </Sheet>
  );
}

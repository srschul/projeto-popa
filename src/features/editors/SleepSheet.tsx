import { useEffect, useState } from 'react';
import { Button, Field, Segmented, Sheet } from '../../components/ui';
import { useAuth } from '../auth/AuthProvider';
import { saveSleep, useSleep } from '../../lib/data';
import { QUALITY_LABEL, parseDecimal } from '../../lib/format';
import { fmtDateBR, todayISO } from '../../lib/dates';
import { useAfterSave, useErrorToast } from '../../lib/useSave';
import type { SleepLog, SleepQuality } from '../../lib/types';

export function SleepSheet({ open, onClose, log }: { open: boolean; onClose: () => void; log?: SleepLog | null }) {
  const { user } = useAuth();
  const { data: all = [] } = useSleep();
  const afterSave = useAfterSave();
  const onError = useErrorToast();
  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState('');
  const [quality, setQuality] = useState<SleepQuality>('good');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null); setBusy(false);
    setDate(log?.date ?? todayISO());
    setHours(log ? String(Number(log.hours)).replace('.', ',') : '');
    setQuality(log?.quality ?? 'good');
    setNotes(log?.notes ?? '');
  }, [open, log]);

  const existing = all.find((l) => l.date === date && l.id !== log?.id);

  async function submit() {
    setError(null);
    const h = parseDecimal(hours);
    if (h === null || h < 0 || h > 24) return setError('Informe as horas dormidas (0 a 24).');
    if (!date) return setError('Informe a data.');
    setBusy(true);
    try {
      if (log && existing) throw new Error('Já existe um registro de sono nessa data.');
      await saveSleep({ id: log?.id, date, hours: Math.round(h * 100) / 100, quality, notes: notes.trim() }, user!.id);
      onClose();
      await afterSave(log ? 'Sono atualizado' : existing ? 'Sono da noite atualizado' : 'Sono registrado');
    } catch (e) {
      onError(e);
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={log ? 'Editar sono' : 'Registrar sono'}
      footer={<div className="flex gap-2"><Button variant="ghost" onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="primary" className="flex-1" onClick={submit} disabled={busy}>{busy ? 'Salvando…' : 'Salvar'}</Button></div>}>
      <div className="space-y-4 pt-1">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data da noite"><input className="input" type="date" max={todayISO()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Horas dormidas"><input className="input" inputMode="decimal" placeholder="7,5" value={hours} onChange={(e) => setHours(e.target.value)} /></Field>
        </div>
        {existing && !log && (
          <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            Já existe um registro em {fmtDateBR(date)} ({String(Number(existing.hours)).replace('.', ',')} h). Salvar vai substituí-lo.
          </p>
        )}
        <div>
          <span className="label">Qualidade</span>
          <Segmented value={quality} onChange={setQuality} options={(['poor', 'fair', 'good', 'great'] as SleepQuality[]).map((q) => ({ value: q, label: QUALITY_LABEL[q] }))} />
        </div>
        <Field label="Observações (opcional)">
          <textarea className="input min-h-[72px] resize-none" placeholder="Ex.: acordei durante a noite" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
      </div>
    </Sheet>
  );
}

import { useEffect, useState } from 'react';
import { useIsFetching, useIsMutating, useQueryClient } from '@tanstack/react-query';
import { CloudOff, RefreshCw, Check, AlertTriangle } from 'lucide-react';

/** Indicador de sincronização: sincronizando, sincronizado, erro de conexão ou offline. */
export function SyncIndicator() {
  const qc = useQueryClient();
  const fetching = useIsFetching();
  const mutating = useIsMutating();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const on = () => { setOnline(true); qc.invalidateQueries(); };
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [qc]);

  useEffect(() => {
    const unsub = qc.getQueryCache().subscribe(() => {
      setFailed(qc.getQueryCache().getAll().some((q) => q.state.status === 'error' && q.state.fetchStatus === 'idle'));
    });
    return unsub;
  }, [qc]);

  let icon = <Check size={13} />;
  let text = 'Sincronizado';
  let tone = 'text-popa';
  if (!online) { icon = <CloudOff size={13} />; text = 'Offline: não dá para salvar'; tone = 'text-amber-300'; }
  else if (failed) { icon = <AlertTriangle size={13} />; text = 'Falha ao sincronizar'; tone = 'text-red-300'; }
  else if (fetching + mutating > 0) { icon = <RefreshCw size={13} className="animate-spin" />; text = 'Sincronizando…'; tone = 'text-zinc-400'; }

  return (
    <button type="button" onClick={() => qc.invalidateQueries()} title="Toque para atualizar"
      className={`inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-ink-800/80 px-2.5 py-1 text-[11px] font-medium ${tone}`}>
      {icon}<span className={!online || failed ? '' : 'hidden sm:inline'}>{text}</span>
    </button>
  );
}

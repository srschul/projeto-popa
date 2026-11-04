import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

type Kind = 'ok' | 'error' | 'xp';
interface Toast { id: number; kind: Kind; text: string }
interface ToastApi { show: (text: string, kind?: Kind) => void }

const Ctx = createContext<ToastApi>({ show: () => {} });
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const show = useCallback((text: string, kind: Kind = 'ok') => {
    const id = ++seq;
    setItems((xs) => [...xs.slice(-2), { id, kind, text }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3500);
  }, []);
  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-[calc(0.75rem+var(--safe-top))] z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {items.map((t) => (
          <div key={t.id}
            className={`pointer-events-auto flex max-w-sm animate-pop items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-medium shadow-2xl backdrop-blur
              ${t.kind === 'error' ? 'border-red-500/30 bg-red-950/90 text-red-100'
                : t.kind === 'xp' ? 'border-popa/40 bg-emerald-950/90 text-popa-soft'
                : 'border-white/10 bg-ink-700/95 text-zinc-100'}`}>
            {t.kind === 'error' ? <AlertCircle size={16} /> : t.kind === 'xp' ? <Sparkles size={16} /> : <CheckCircle2 size={16} className="text-popa" />}
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = (): ToastApi => useContext(Ctx);

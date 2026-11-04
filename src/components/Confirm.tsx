import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button, Sheet } from './ui';

interface Options { title: string; text: string; confirmLabel?: string }
type ConfirmFn = (o: Options) => Promise<boolean>;

const Ctx = createContext<ConfirmFn>(async () => false);

/** Confirmação antes de excluir (nada é apagado sem o "sim" do usuário). */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<Options | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((o) => new Promise<boolean>((resolve) => {
    resolver.current = resolve;
    setOpts(o);
  }), []);

  const close = (v: boolean) => {
    resolver.current?.(v);
    resolver.current = null;
    setOpts(null);
  };
  const api = useMemo(() => confirm, [confirm]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <Sheet open={opts !== null} onClose={() => close(false)} title={opts?.title ?? ''}
        footer={<div className="flex gap-2"><Button variant="ghost" className="flex-1" onClick={() => close(false)}>Cancelar</Button>
          <Button variant="danger" className="flex-1" onClick={() => close(true)}>{opts?.confirmLabel ?? 'Excluir'}</Button></div>}>
        <p className="pb-2 text-sm text-zinc-300">{opts?.text}</p>
      </Sheet>
    </Ctx.Provider>
  );
}

export const useConfirm = (): ConfirmFn => useContext(Ctx);

import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle, Loader2, X } from 'lucide-react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={cx('card', className)}>{children}</section>;
}

export function CardTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-zinc-100">{children}</h3>
      {right}
    </div>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'soft' | 'ghost' | 'danger'; small?: boolean };
export function Button({ variant = 'soft', small, className, type = 'button', ...rest }: BtnProps) {
  return <button type={type} className={cx('btn', `btn-${variant}`, small && 'btn-sm', className)} {...rest} />;
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, className,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string }) {
  return (
    <div role="radiogroup" className={cx('grid gap-1 rounded-xl border border-white/[0.06] bg-ink-900 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={o.value === value} onClick={() => onChange(o.value)}
          className={cx('min-h-[38px] whitespace-nowrap rounded-lg px-1 text-[12.5px] font-medium transition',
            o.value === value ? 'bg-popa/15 text-popa-soft ring-1 ring-popa/40' : 'text-zinc-400 hover:text-zinc-200')}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 animate-fadein bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full animate-rise flex-col rounded-t-3xl border border-white/10 bg-ink-800 md:max-w-xl md:rounded-3xl">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid h-9 w-9 place-items-center rounded-full text-zinc-400 hover:bg-white/5">
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-4">{children}</div>
        {footer && <div className="border-t border-white/[0.06] px-5 pb-[calc(1rem+var(--safe-bottom))] pt-3">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/10 px-6 py-9 text-center">
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-popa/10 text-popa">{icon}</div>
      <p className="font-display text-base font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-sm text-mute">{text}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ChartEmpty({ text = 'Ainda não existem dados suficientes para este gráfico.' }: { text?: string }) {
  return (
    <div className="grid h-40 place-items-center rounded-xl border border-dashed border-white/10 px-6 text-center text-sm text-mute">{text}</div>
  );
}

export function ProgressBar({ value, max, className }: { value: number; max: number; className?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-ink-500', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-popa-deep via-popa to-popa-soft transition-[width] duration-700" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Ring({ value, max, size = 92, children }: { value: number; max: number; size?: number; children?: ReactNode }) {
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2a312c" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#22c55e" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cx('animate-spin text-popa', className)} size={20} />;
}

export function LoadingBlock({ label = 'Carregando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-mute">
      <Spinner /> {label}
    </div>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String((error as { message: unknown }).message) : 'Erro desconhecido';
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/5 px-6 py-8 text-center">
      <AlertTriangle className="text-red-300" size={22} />
      <p className="text-sm text-red-200">Não foi possível carregar os dados.</p>
      <p className="max-w-sm break-words text-xs text-red-300/70">{msg}</p>
      {onRetry && <Button small onClick={onRetry}>Tentar de novo</Button>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end justify-between gap-3">
      <div className="min-w-0">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 font-display text-[26px] font-bold leading-tight tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-mute">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Stat({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: string; icon?: ReactNode }) {
  return (
    <div className="card !p-3.5">
      <div className="flex items-center justify-between text-mute">
        <span className="text-xs">{label}</span>
        {icon && <span className="text-popa/80">{icon}</span>}
      </div>
      <div className="num mt-1.5 text-2xl font-bold">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-mute">{sub}</div>}
    </div>
  );
}

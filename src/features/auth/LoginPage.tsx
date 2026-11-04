import { useState, type FormEvent } from 'react';
import { Button, Field, Spinner } from '../../components/ui';
import { Logo } from '../../components/Logo';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { signIn, sendReset } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      await signIn(email, password);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setError(/invalid login/i.test(msg) ? 'E-mail ou senha incorretos.' : /failed to fetch|network/i.test(msg) ? 'Sem conexão com o servidor.' : msg || 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  async function forgot() {
    if (!email.trim()) return setError('Digite seu e-mail acima e toque em "Esqueci a senha" de novo.');
    setBusy(true); setError(null); setInfo(null);
    try {
      await sendReset(email);
      setInfo('Se esse e-mail estiver cadastrado, você vai receber um link para criar uma nova senha.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o e-mail.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col justify-center px-6 pb-10 pt-[calc(2rem+var(--safe-top))]">
      <div className="mb-10 flex flex-col items-center text-center">
        <Logo size={64} />
        <h1 className="mt-5 font-display text-3xl font-bold tracking-[0.18em]">PROJETO POPA</h1>
        <p className="mt-2 text-sm text-mute">Consistência acima da perfeição.</p>
      </div>

      <form onSubmit={submit} className="card space-y-4">
        <Field label="E-mail">
          <input className="input" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Senha">
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        {info && <p className="rounded-lg bg-popa/10 px-3 py-2 text-sm text-popa-soft">{info}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>
          {busy ? <Spinner className="!text-ink" /> : 'Entrar'}
        </Button>
        <button type="button" onClick={forgot} disabled={busy} className="w-full text-center text-sm text-mute underline-offset-4 hover:text-zinc-200 hover:underline">
          Esqueci a senha
        </button>
      </form>
    </main>
  );
}

export function RecoveryPage() {
  const { setNewPassword } = useAuth();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return setError('Use pelo menos 8 caracteres.');
    if (pw !== pw2) return setError('As senhas não conferem.');
    setBusy(true); setError(null);
    try {
      await setNewPassword(pw);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar a senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-center font-display text-2xl font-bold">Criar nova senha</h1>
      <form onSubmit={submit} className="card space-y-4">
        <Field label="Nova senha" hint="Mínimo de 8 caracteres">
          <input className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        </Field>
        <Field label="Repita a nova senha">
          <input className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
        </Field>
        {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={busy}>Salvar senha</Button>
      </form>
    </main>
  );
}

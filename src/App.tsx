import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './features/auth/AuthProvider';
import { LoginPage, RecoveryPage } from './features/auth/LoginPage';
import { ConfirmProvider } from './components/Confirm';
import { EditorsProvider } from './features/editors/EditorsProvider';
import { Layout } from './components/Layout';
import { LoadingBlock } from './components/ui';
import { isConfigured } from './lib/supabase';
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const WorkoutsPage = lazy(() => import('./pages/WorkoutsPage').then((m) => ({ default: m.WorkoutsPage })));
const BodyPage = lazy(() => import('./pages/BodyPage').then((m) => ({ default: m.BodyPage })));
const SleepPage = lazy(() => import('./pages/SleepPage').then((m) => ({ default: m.SleepPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })));
const AchievementsPage = lazy(() => import('./pages/AchievementsPage').then((m) => ({ default: m.AchievementsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const MorePage = lazy(() => import('./pages/MorePage').then((m) => ({ default: m.MorePage })));

function NotConfigured() {
  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 text-center">
      <h1 className="font-display text-2xl font-bold">Falta configurar o Supabase</h1>
      <p className="mt-3 text-sm text-mute">
        Crie o arquivo <code className="rounded bg-ink-600 px-1.5 py-0.5">.env.local</code> a partir do <code className="rounded bg-ink-600 px-1.5 py-0.5">.env.example</code> com a
        Project URL e a chave pública, e reinicie. Na Vercel, cadastre as duas variáveis em Settings → Environment Variables.
      </p>
    </main>
  );
}

export function App() {
  const { user, loading, recovery } = useAuth();

  if (!isConfigured) return <NotConfigured />;
  if (loading) return <div className="grid min-h-[100dvh] place-items-center"><LoadingBlock /></div>;
  if (recovery) return <RecoveryPage />;
  if (!user) return <LoginPage />;

  return (
    <ConfirmProvider>
      <EditorsProvider>
        <Suspense fallback={<LoadingBlock />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardPage />} />
            <Route path="treinos" element={<WorkoutsPage />} />
            <Route path="corpo" element={<BodyPage />} />
            <Route path="sono" element={<SleepPage />} />
            <Route path="mais" element={<MorePage />} />
            <Route path="estatisticas" element={<StatsPage />} />
            <Route path="conquistas" element={<AchievementsPage />} />
            <Route path="configuracoes" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
        </Suspense>
      </EditorsProvider>
    </ConfirmProvider>
  );
}

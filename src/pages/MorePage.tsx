import { Link } from 'react-router-dom';
import { BarChart3, ChevronRight, Settings, Trophy } from 'lucide-react';
import { PageHeader } from '../components/ui';

const ITEMS = [
  { to: '/estatisticas', icon: BarChart3, title: 'Estatísticas', text: 'Gráficos de treinos, peso, medidas, cargas e sono' },
  { to: '/conquistas', icon: Trophy, title: 'Conquistas', text: 'Níveis, medalhas e como o XP funciona' },
  { to: '/configuracoes', icon: Settings, title: 'Configurações', text: 'Metas semanais, backup e conta' },
];

export function MorePage() {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Menu" title="Mais" />
      <div className="space-y-2.5">
        {ITEMS.map(({ to, icon: Icon, title, text }) => (
          <Link key={to} to={to} className="card flex items-center gap-3.5 transition hover:border-popa/30 active:scale-[0.99]">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-popa/10 text-popa"><Icon size={20} /></span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{title}</span><span className="block text-xs text-mute">{text}</span></span>
            <ChevronRight size={18} className="text-zinc-600" />
          </Link>
        ))}
      </div>
    </div>
  );
}

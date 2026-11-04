# PROJETO POPA

Acompanhamento pessoal de evolução física: treinos, corpo, sono, XP, níveis e conquistas. Consistência acima da perfeição.

**Stack:** React + TypeScript + Vite, Tailwind, Recharts, TanStack Query, Supabase (Postgres, Auth, Storage), PWA, Vercel.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # preencha a Project URL e a chave PÚBLICA do Supabase
npm run dev                  # http://localhost:5173
```

Outros comandos: `npm test` (lógica de datas/estatísticas), `npm run build` (typecheck + produção).

## Banco de dados

Siga `docs/SETUP_SUPABASE.md`. O SQL está em `supabase/migrations/` (ou tudo junto em `supabase/setup_all.sql`).
Regras de XP, missões e conquistas rodam no banco; o app só lê o resultado.

## Segurança

- O app usa só a chave pública. **Nunca** coloque a `service_role`/secret key no projeto.
- Todas as tabelas têm RLS (cada usuário só acessa as próprias linhas) e o bucket de fotos é privado.

## Estrutura

```
src/lib/        datas, estatísticas (testadas), acesso ao Supabase, formatação
src/features/   login, formulários de registro
src/pages/      Início, Treinos, Corpo, Sono, Estatísticas, Conquistas, Configurações
supabase/       migrations, testes de RLS/XP (Postgres local)
scripts/        ícones do PWA, verificação visual
```

## Pendente (próximas etapas)

Restaurar backup pelo app (a importação da v1 foi dispensada: não há dados antigos) e os testes no Supabase real. Veja docs/PUBLICAR_E_INSTALAR.md.

# Configurando o Supabase para o PROJETO POPA

Tempo estimado: 10 a 15 minutos. Você só precisa de uma conta gratuita em supabase.com.

## 1. Criar o projeto

1. Em **supabase.com → New project**.
2. Nome: `projeto-popa`. Região: **South America (São Paulo)**.
3. Defina uma senha forte para o banco e **guarde no seu gerenciador de senhas**. Ela não é usada pelo app e **não deve ser enviada a ninguém**.
4. Aguarde o projeto ficar pronto (1 a 2 minutos).

## 2. Instalar o banco (tabelas, segurança, XP, conquistas, fotos)

1. No menu lateral: **SQL Editor → New query**.
2. Abra o arquivo `supabase/setup_all.sql` deste projeto, copie **todo** o conteúdo e cole.
3. Clique em **Run**. Deve terminar com `Success`. Pode rodar de novo sem problema: é reexecutável.

Isso cria: tabelas, políticas RLS, o bucket privado `progress-photos`, as regras de XP/missões/conquistas e os catálogos de níveis e conquistas.

> Alternativa para quem usa a CLI: `supabase link` e `supabase db push` aplicam os mesmos arquivos de `supabase/migrations/`.

## 3. Criar a sua conta e travar o cadastro

O app é pessoal, então a conta é criada pelo painel e o cadastro público fica **desligado**.

1. **Authentication → Users → Add user → Create new user**.
2. Informe seu e-mail e uma senha, e marque **Auto Confirm User**.
3. **Authentication → Sign In / Providers → Email**: desative **Allow new users to sign up** (e mantenha *Email* habilitado).
4. Seu perfil e suas metas padrão são criados automaticamente.

## 4. Pegar as duas informações que o app precisa

Em **Project Settings → API** (ou **API Keys**):

| O que | Onde | Pode me enviar? |
|---|---|---|
| **Project URL** (`https://xxxx.supabase.co`) | Project Settings → API | Sim |
| **Publishable key** (`sb_publishable_...`) ou **anon public key** | Project Settings → API Keys | Sim (é pública por design) |
| `service_role` / **Secret key** (`sb_secret_...`) | mesma página | **NUNCA** |
| Senha do banco, JWT secret | | **NUNCA** |

A chave pública fica visível no navegador de qualquer jeito. Quem protege seus dados são as políticas RLS que você acabou de instalar.

## 5. URLs de redirecionamento (para recuperação de senha)

**Authentication → URL Configuration**:
- **Site URL**: o endereço do app na Vercel (ou `http://localhost:5173` enquanto estiver testando).
- **Redirect URLs**: adicione o mesmo endereço e `http://localhost:5173`.

Você pode deixar para depois do deploy; só afeta o e-mail de recuperação de senha.

## 6. Conferência rápida (opcional, 2 minutos)

Em **Table Editor** você deve ver 15 tabelas e, ao lado de cada uma, a indicação de RLS ativado. Em **Storage**, o bucket `progress-photos` deve aparecer como **Private**. Em **Authentication → Policies**, cada tabela lista suas políticas.

## O que o banco faz por você

- **XP**: musculação 30, cardio 25, outro 20. No máximo **1 treino com XP por dia** (o de maior valor); os demais contam como atividade, sem XP. Bônus de 20 XP, uma vez por semana, ao cumprir a meta de atividades.
- **Semana** começa na segunda-feira. Dias de descanso nunca tiram XP.
- **Níveis**: Iniciante 0 · Em construção 100 · Consistente 300 · Determinado 600 · Imparável 1.000 · Lenda 1.600 XP.
- **Conquistas** são desbloqueadas automaticamente pelos registros reais e nunca são revogadas.
- O app **só lê** XP, conquistas e missões. Não há como forjar pontuação pelo navegador.
- Mudar a meta semanal reavalia a semana atual na hora.

Para ajustar níveis ou conquistas, edite `supabase/migrations/20261103000500_seed_catalogs.sql` e rode novamente.

## Testes automatizados do banco

`supabase/tests/run.sh` aplica as migrações em um Postgres local descartável (com um pequeno simulador do Supabase) e executa 110 verificações de isolamento entre usuários, regras de XP, missões e conquistas. **Nunca aponte para o seu projeto real**: o script recusa endereços do Supabase.

```bash
PGHOST=/caminho/do/socket PGUSER=postgres ./supabase/tests/run.sh
```

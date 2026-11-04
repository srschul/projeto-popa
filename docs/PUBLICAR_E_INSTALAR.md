# Publicar o Projeto Popa e instalar no iPhone

Tempo estimado: 20 a 30 minutos. Tudo gratuito (GitHub, Vercel e Supabase têm plano grátis).

## Parte 1: colocar o código no GitHub

1. Crie uma conta em **github.com** (se ainda não tiver).
2. Clique em **New repository**. Nome: `projeto-popa`. Marque **Private** (privado). Crie.
3. Descompacte o `projeto-popa-etapa3.zip` no seu computador.
4. Na página do repositório novo, clique em **uploading an existing file** e arraste **o conteúdo** da pasta `projeto-popa` (não a pasta em si). Clique em **Commit changes**.
   - Não envie o arquivo `.env.local` (ele nem vem no zip). As chaves vão direto na Vercel, no passo seguinte.

## Parte 2: publicar na Vercel

1. Entre em **vercel.com** com o botão **Continue with GitHub**.
2. **Add New → Project** e escolha o repositório `projeto-popa` → **Import**.
3. Em **Environment Variables**, cadastre as duas variáveis (nome exatamente assim):

   | Nome | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://ancjujiwgywzzaocvlin.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | sua chave `sb_publishable_...` |

4. Clique em **Deploy**. Em 1 a 2 minutos a Vercel mostra o endereço do app (algo como `projeto-popa.vercel.app`).

> Se você alterar uma variável depois, precisa refazer o deploy (**Deployments → ⋯ → Redeploy**).

## Parte 3: avisar o Supabase do endereço

No Supabase: **Authentication → URL Configuration**
- **Site URL**: o endereço da Vercel (ex.: `https://projeto-popa.vercel.app`).
- **Redirect URLs**: adicione o mesmo endereço.

Isso faz o e-mail de "Esqueci a senha" voltar para o app certo.

## Parte 4: instalar no iPhone

1. Abra o endereço da Vercel no **Safari** (precisa ser o Safari).
2. Toque no botão de **compartilhar** (quadrado com seta para cima).
3. Role e toque em **Adicionar à Tela de Início** → **Adicionar**.
4. Abra pelo ícone verde "Popa". Ele abre em tela cheia, como um app.
5. Entre com o e-mail e a senha que você criou no Supabase.

## Parte 5: conferência no seu ambiente real (marque cada item)

Estes testes só podem ser feitos por você, no app publicado:

- [ ] **Login** com o seu e-mail e senha funciona. Sair e entrar de novo funciona.
- [ ] **Registrar uma atividade** (musculação, 45 min): aparece em Treinos e no Início, com **+30 XP**.
- [ ] **Registrar outra atividade no mesmo dia**: aparece, mas **sem XP extra** (regra de 1 treino com XP por dia).
- [ ] **Editar** a atividade (mudar a duração) e **excluir** uma (o app pede confirmação, e o XP dela some).
- [ ] **Registrar peso e medidas**: aparece no Corpo e no Início. A conquista "Primeiro registro corporal" aparece.
- [ ] **Registrar sono**: aparece em Sono. Registrar a mesma data de novo substitui a noite (uma por dia).
- [ ] **Subir uma foto** em Corpo: aparece depois de atualizar a página. Suba uma segunda e teste **Comparar**.
- [ ] **Metas**: em Configurações, mude "Atividades por semana" para 1, salve, e veja o Início atualizar.
- [ ] **Sincronização**: registre algo no iPhone e abra o app no computador (mesmo endereço, mesmo login). Os dados devem aparecer nos dois.
- [ ] **Backup**: Configurações → Baixar backup. O arquivo `.json` baixa.
- [ ] **Offline**: ative o modo avião e abra o app. Ele abre, mostra "Offline" e não deixa você perder um registro sem avisar.
- [ ] **Segurança**: em janela anônima do navegador, abra o endereço do app. Deve pedir login e não mostrar dados.

Se algum item falhar, me diga qual e o texto do erro (ou tire um print). Eu corrijo.

## Domínio próprio (opcional)

Na Vercel: **Settings → Domains** e siga as instruções. Se usar domínio próprio, atualize também o **Site URL** e as **Redirect URLs** no Supabase.

## Atualizar o app depois

Mudou o código? Suba os arquivos novos no GitHub. A Vercel publica sozinha a nova versão.

## Backup dos dados

- **Pelo app:** Configurações → Baixar backup (registros, sem as fotos).
- **Pelo Supabase:** o plano grátis guarda o banco, mas não faz cópias de segurança automáticas que você possa baixar. Baixe o backup do app de vez em quando (por exemplo, uma vez por mês).
- **Importante:** projetos do plano grátis do Supabase são pausados após cerca de uma semana sem uso. Se isso acontecer, entre no painel do Supabase e clique em **Restore project**. Seus dados continuam lá.

-- =============================================================================
-- PROJETO POPA — 002: Row Level Security
-- Regra geral: cada usuário só enxerga e altera linhas com user_id = auth.uid().
-- =============================================================================

-- Nada de acesso anônimo a nenhuma tabela do app.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- ---------------------------------------------------------------------------
-- Tabelas do usuário: CRUD completo, apenas nas próprias linhas
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'workouts', 'workout_exercises', 'exercise_sets', 'cardio_details',
    'body_entries', 'progress_photos', 'sleep_logs', 'import_batches'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_select_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_insert_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_update_own" on public.%1$I', t);
    execute format('drop policy if exists "%1$s_delete_own" on public.%1$I', t);
    execute format('create policy "%1$s_select_own" on public.%1$I for select to authenticated
                      using (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_insert_own" on public.%1$I for insert to authenticated
                      with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_update_own" on public.%1$I for update to authenticated
                      using (user_id = (select auth.uid()))
                      with check (user_id = (select auth.uid()))', t);
    execute format('create policy "%1$s_delete_own" on public.%1$I for delete to authenticated
                      using (user_id = (select auth.uid()))', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Perfil: ler e editar o próprio (criação feita por trigger no cadastro)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, delete on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- Configurações: ler, criar (caso falte) e editar as próprias metas
-- ---------------------------------------------------------------------------
alter table public.user_settings enable row level security;
drop policy if exists "user_settings_select_own" on public.user_settings;
drop policy if exists "user_settings_insert_own" on public.user_settings;
drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings for select to authenticated
  using (user_id = (select auth.uid()));
create policy "user_settings_insert_own" on public.user_settings for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "user_settings_update_own" on public.user_settings for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke delete on public.user_settings from authenticated;

-- ---------------------------------------------------------------------------
-- Gamificação: o app só LÊ. XP, conquistas e missões são gravados por funções
-- internas (SECURITY DEFINER), então o cliente não consegue forjar pontuação.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['xp_events', 'user_achievements', 'weekly_mission_results'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_select_own" on public.%1$I', t);
    execute format('create policy "%1$s_select_own" on public.%1$I for select to authenticated
                      using (user_id = (select auth.uid()))', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;

-- Catálogos (níveis e conquistas): leitura para usuários logados, sem escrita.
do $$
declare t text;
begin
  foreach t in array array['level_definitions', 'achievement_definitions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "%1$s_select_all" on public.%1$I', t);
    execute format('create policy "%1$s_select_all" on public.%1$I for select to authenticated using (true)', t);
    execute format('revoke insert, update, delete, truncate on public.%I from authenticated', t);
  end loop;
end $$;

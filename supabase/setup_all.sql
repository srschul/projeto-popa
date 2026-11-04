-- PROJETO POPA — instalação completa (gerado por scripts/build-setup-sql.sh; não edite à mão)

-- >>>>>>>> 20261103000100_schema.sql
-- =============================================================================
-- PROJETO POPA — 001: esquema base
-- Rode no SQL Editor do Supabase (como postgres) ou via `supabase db push`.
-- Idempotente onde possível (create ... if not exists).
-- =============================================================================

-- Schema privado: funções internas (gamificação) que NÃO ficam expostas pela API.
create schema if not exists popa_private;
revoke all on schema popa_private from public;

create or replace function popa_private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perfil e configurações (metas semanais configuráveis)
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  started_on   date not null default current_date,
  timezone     text not null default 'America/Sao_Paulo',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id                  uuid primary key references auth.users (id) on delete cascade default auth.uid(),
  weekly_activities_goal   smallint not null default 3  check (weekly_activities_goal between 0 and 14),
  weekly_strength_goal     smallint not null default 2  check (weekly_strength_goal   between 0 and 14),
  weekly_cardio_goal       smallint not null default 1  check (weekly_cardio_goal     between 0 and 14),
  weekly_minutes_goal      smallint not null default 90 check (weekly_minutes_goal    between 0 and 2000),
  weekly_sleep_nights_goal smallint not null default 5  check (weekly_sleep_nights_goal between 0 and 7),
  updated_at               timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Treinos
-- -----------------------------------------------------------------------------
create table if not exists public.workouts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date         date not null,
  type         text not null check (type in ('strength', 'cardio', 'other')),
  name         text not null default '',
  duration_min integer not null check (duration_min between 1 and 600),
  intensity    text not null default 'moderate' check (intensity in ('light', 'moderate', 'intense')),
  notes        text not null default '',
  legacy_id    text,                                   -- id do registro na v1 (migração sem duplicar)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint workouts_id_user_key     unique (id, user_id),
  constraint workouts_legacy_key      unique (user_id, legacy_id)
);
create index if not exists workouts_user_date_idx on public.workouts (user_id, date desc);

create table if not exists public.workout_exercises (
  id           uuid primary key default gen_random_uuid(),
  workout_id   uuid not null,
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  name         text not null check (length(trim(name)) > 0),
  muscle_group text not null default '',
  position     integer not null default 0,
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  constraint workout_exercises_id_user_key unique (id, user_id),
  -- FK composta: garante que o exercício pertence ao MESMO usuário dono do treino
  constraint workout_exercises_workout_fk foreign key (workout_id, user_id)
    references public.workouts (id, user_id) on delete cascade
);
create index if not exists workout_exercises_workout_idx on public.workout_exercises (workout_id);
create index if not exists workout_exercises_name_idx on public.workout_exercises (user_id, lower(name));

create table if not exists public.exercise_sets (
  id           uuid primary key default gen_random_uuid(),
  exercise_id  uuid not null,
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  set_number   integer not null check (set_number > 0),
  reps         integer not null check (reps between 0 and 1000),
  weight_kg    numeric(6, 2) not null default 0 check (weight_kg >= 0),
  created_at   timestamptz not null default now(),
  constraint exercise_sets_exercise_set_key unique (exercise_id, set_number),
  constraint exercise_sets_exercise_fk foreign key (exercise_id, user_id)
    references public.workout_exercises (id, user_id) on delete cascade
);

create table if not exists public.cardio_details (
  workout_id      uuid primary key,
  user_id         uuid not null references auth.users (id) on delete cascade default auth.uid(),
  modality        text not null default '',
  distance_km     numeric(6, 2) check (distance_km is null or distance_km >= 0),
  avg_speed_kmh   numeric(5, 2) check (avg_speed_kmh is null or avg_speed_kmh >= 0),
  pace_sec_per_km integer check (pace_sec_per_km is null or pace_sec_per_km > 0),
  constraint cardio_details_workout_fk foreign key (workout_id, user_id)
    references public.workouts (id, user_id) on delete cascade
);

-- -----------------------------------------------------------------------------
-- Corpo: peso e medidas, fotos
-- -----------------------------------------------------------------------------
create table if not exists public.body_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date       date not null,
  weight_kg  numeric(5, 2) check (weight_kg between 20 and 400),
  waist_cm   numeric(5, 1) check (waist_cm  between 20 and 250),
  chest_cm   numeric(5, 1) check (chest_cm  between 20 and 250),
  hip_cm     numeric(5, 1) check (hip_cm    between 20 and 250),
  arm_cm     numeric(5, 1) check (arm_cm    between 10 and 100),
  extra      jsonb not null default '{}'::jsonb check (jsonb_typeof(extra) = 'object'),  -- medidas futuras
  legacy_id  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_entries_legacy_key unique (user_id, legacy_id),
  constraint body_entries_not_empty check (
    weight_kg is not null or waist_cm is not null or chest_cm is not null
    or hip_cm is not null or arm_cm is not null or extra <> '{}'::jsonb
  )
);
create index if not exists body_entries_user_date_idx on public.body_entries (user_id, date desc);

create table if not exists public.progress_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date         date not null,
  storage_path text not null unique,
  label        text not null default '',
  notes        text not null default '',
  created_at   timestamptz not null default now(),
  -- o arquivo precisa estar na pasta do próprio usuário: {user_id}/...
  constraint progress_photos_path_in_own_folder check (storage_path like user_id::text || '/%')
);
create index if not exists progress_photos_user_date_idx on public.progress_photos (user_id, date desc);

-- -----------------------------------------------------------------------------
-- Sono
-- -----------------------------------------------------------------------------
create table if not exists public.sleep_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  date       date not null,
  hours      numeric(4, 2) not null check (hours between 0 and 24),
  quality    text not null default 'good' check (quality in ('poor', 'fair', 'good', 'great')),
  notes      text not null default '',
  legacy_id  text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sleep_logs_user_date_key unique (user_id, date),
  constraint sleep_logs_legacy_key    unique (user_id, legacy_id)
);

-- -----------------------------------------------------------------------------
-- Gamificação (leitura pelo app; escrita apenas por funções internas)
-- -----------------------------------------------------------------------------
create table if not exists public.level_definitions (
  level  smallint primary key,
  name   text not null,
  min_xp integer not null unique check (min_xp >= 0)
);

create table if not exists public.achievement_definitions (
  code        text primary key,
  title       text not null,
  description text not null,
  icon        text not null,                -- nome de ícone Lucide
  rule        jsonb not null,              -- {"metric": "...", "gte": N}
  xp_bonus    integer not null default 0 check (xp_bonus >= 0),
  sort_order  integer not null default 0
);

-- Livro-razão de XP: XP total = soma desta tabela. Um evento por origem (sem duplicar).
create table if not exists public.xp_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  reason      text not null check (reason in ('workout', 'weekly_mission', 'achievement')),
  source_key  text not null,               -- id do treino / semana (data) / código da conquista
  workout_id  uuid references public.workouts (id) on delete cascade,
  points      integer not null check (points >= 0),
  occurred_on date not null,
  note        text not null default '',
  created_at  timestamptz not null default now(),
  constraint xp_events_once_per_source unique (user_id, reason, source_key)
);
create index if not exists xp_events_user_idx on public.xp_events (user_id, occurred_on desc);

create table if not exists public.user_achievements (
  user_id     uuid not null references auth.users (id) on delete cascade,
  code        text not null references public.achievement_definitions (code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);

create table if not exists public.weekly_mission_results (
  user_id      uuid not null references auth.users (id) on delete cascade,
  week_key     date not null,              -- segunda-feira da semana
  mission_code text not null check (mission_code in ('activities', 'strength', 'cardio', 'minutes', 'sleep_nights')),
  target       integer not null,           -- meta vigente no momento da conclusão
  progress     integer not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, week_key, mission_code)
);

-- -----------------------------------------------------------------------------
-- Controle de importações (migração da v1 e restauração de backup)
-- -----------------------------------------------------------------------------
create table if not exists public.import_batches (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade default auth.uid(),
  source     text not null default 'v1-json',
  summary    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['profiles', 'user_settings', 'workouts', 'body_entries', 'sleep_logs'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function popa_private.set_updated_at()', t);
  end loop;
end $$;

-- >>>>>>>> 20261103000200_rls.sql
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

-- >>>>>>>> 20261103000300_storage.sql
-- =============================================================================
-- PROJETO POPA — 003: armazenamento privado de fotos
-- Bucket privado; cada usuário só acessa a pasta {auth.uid()}/...
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos', 'progress-photos', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "popa_photos_select_own" on storage.objects;
drop policy if exists "popa_photos_insert_own" on storage.objects;
drop policy if exists "popa_photos_update_own" on storage.objects;
drop policy if exists "popa_photos_delete_own" on storage.objects;

create policy "popa_photos_select_own" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "popa_photos_insert_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "popa_photos_update_own" on storage.objects for update to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "popa_photos_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- >>>>>>>> 20261103000400_gamification.sql
-- =============================================================================
-- PROJETO POPA — 004: gamificação no banco (XP, missões semanais, conquistas)
-- Tudo roda em funções SECURITY DEFINER dentro do schema privado `popa_private`,
-- que não é exposto pela API. O cliente só consegue LER os resultados.
--
-- Regras de XP:
--   * Musculação 30 · Cardio 25 · Outro 20.
--   * No máximo 1 treino com XP por dia (o de maior valor; empate: o mais antigo).
--     Os demais treinos do dia contam como atividade, mas sem XP.
--   * Bônus de 20 XP, uma única vez por semana, ao cumprir a meta de atividades.
--   * Semana começa na segunda-feira.
--   * Descansar nunca tira XP. Conquistas, uma vez desbloqueadas, não são revogadas.
-- =============================================================================

create or replace function popa_private.week_start(p_date date)
returns date
language sql
immutable
as $$ select date_trunc('week', p_date::timestamp)::date $$;   -- ISO: segunda-feira

create or replace function popa_private.xp_for_type(p_type text)
returns integer
language sql
immutable
as $$
  select case p_type when 'strength' then 30 when 'cardio' then 25 else 20 end
$$;

-- ---------------------------------------------------------------------------
-- Recalcula o XP de treino de UM dia (regra: 1 treino com XP por dia).
-- ---------------------------------------------------------------------------
create or replace function popa_private.sync_workout_xp(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_winner uuid;
  v_points integer;
begin
  select w.id, popa_private.xp_for_type(w.type)
    into v_winner, v_points
  from public.workouts w
  where w.user_id = p_user and w.date = p_date
  order by popa_private.xp_for_type(w.type) desc, w.created_at asc, w.id asc
  limit 1;

  -- remove eventos de treino desse dia que não pertencem mais ao "vencedor"
  delete from public.xp_events e
  where e.user_id = p_user
    and e.reason = 'workout'
    and e.occurred_on = p_date
    and (v_winner is null or e.workout_id is distinct from v_winner);

  if v_winner is not null then
    insert into public.xp_events (user_id, reason, source_key, workout_id, points, occurred_on, note)
    values (p_user, 'workout', v_winner::text, v_winner, v_points, p_date, 'Treino registrado')
    on conflict (user_id, reason, source_key) do update
      set points = excluded.points,
          occurred_on = excluded.occurred_on,
          workout_id = excluded.workout_id;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Missões da semana: registra conclusão (uma vez) e paga o bônus da meta de atividades.
-- ---------------------------------------------------------------------------
create or replace function popa_private.evaluate_week(p_user uuid, p_week date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s        public.user_settings%rowtype;
  v_act    integer;
  v_str    integer;
  v_car    integer;
  v_min    integer;
  v_sleep  integer;
  m        record;
begin
  select * into s from public.user_settings where user_id = p_user;

  select count(*),
         count(*) filter (where type = 'strength'),
         count(*) filter (where type = 'cardio'),
         coalesce(sum(duration_min), 0)
    into v_act, v_str, v_car, v_min
  from public.workouts
  where user_id = p_user and date >= p_week and date < p_week + 7;

  select count(*) into v_sleep
  from public.sleep_logs
  where user_id = p_user and date >= p_week and date < p_week + 7;

  for m in
    select * from (values
      ('activities',   coalesce(s.weekly_activities_goal,   3)::int, v_act),
      ('strength',     coalesce(s.weekly_strength_goal,     2)::int, v_str),
      ('cardio',       coalesce(s.weekly_cardio_goal,       1)::int, v_car),
      ('minutes',      coalesce(s.weekly_minutes_goal,     90)::int, v_min),
      ('sleep_nights', coalesce(s.weekly_sleep_nights_goal, 5)::int, v_sleep)
    ) as t(code, target, progress)
  loop
    if m.target > 0 and m.progress >= m.target then
      insert into public.weekly_mission_results (user_id, week_key, mission_code, target, progress)
      values (p_user, p_week, m.code, m.target, m.progress)
      on conflict do nothing;

      if found and m.code = 'activities' then
        insert into public.xp_events (user_id, reason, source_key, points, occurred_on, note)
        values (p_user, 'weekly_mission', p_week::text, 20, p_week, 'Meta semanal de atividades')
        on conflict do nothing;
      end if;
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conquistas: avalia todas as definições com base nos registros reais.
-- ---------------------------------------------------------------------------
create or replace function popa_private.evaluate_achievements(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_stats jsonb;
  d       record;
begin
  select jsonb_build_object(
    'workout_count',    (select count(*) from public.workouts where user_id = p_user),
    'total_minutes',    (select coalesce(sum(duration_min), 0) from public.workouts where user_id = p_user),
    'consistent_weeks', (select count(*) from public.weekly_mission_results
                          where user_id = p_user and mission_code = 'activities'),
    'body_entries',     (select count(*) from public.body_entries where user_id = p_user),
    'weight_entries',   (select count(*) from public.body_entries
                          where user_id = p_user and weight_kg is not null),
    'sleep_nights',     (select count(*) from public.sleep_logs where user_id = p_user),
    'total_xp',         (select coalesce(sum(points), 0) from public.xp_events where user_id = p_user),
    'photos',           (select count(*) from public.progress_photos where user_id = p_user)
  ) into v_stats;

  for d in select * from public.achievement_definitions order by sort_order loop
    if coalesce((v_stats ->> (d.rule ->> 'metric'))::numeric, 0) >= (d.rule ->> 'gte')::numeric then
      insert into public.user_achievements (user_id, code)
      values (p_user, d.code)
      on conflict do nothing;

      if found and d.xp_bonus > 0 then
        insert into public.xp_events (user_id, reason, source_key, points, occurred_on, note)
        values (p_user, 'achievement', d.code, d.xp_bonus, current_date, d.title)
        on conflict do nothing;
      end if;
    end if;
  end loop;
end;
$$;

-- Ponto de entrada: semana da data informada + conquistas.
create or replace function popa_private.evaluate(p_user uuid, p_date date)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform popa_private.evaluate_week(p_user, popa_private.week_start(p_date));
  perform popa_private.evaluate_achievements(p_user);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------
-- Treinos: XP + missões + conquistas
create or replace function popa_private.trg_workouts_gamification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  -- exclusão da conta em cascata: não há mais nada a calcular
  if not exists (select 1 from auth.users where id = v_user) then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform popa_private.sync_workout_xp(old.user_id, old.date);
    perform popa_private.evaluate(old.user_id, old.date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform popa_private.sync_workout_xp(new.user_id, new.date);
    perform popa_private.evaluate(new.user_id, new.date);
  end if;
  return null;
end;
$$;

drop trigger if exists gamification on public.workouts;
create trigger gamification
  after insert or update or delete on public.workouts
  for each row execute function popa_private.trg_workouts_gamification();

-- Sono, corpo e fotos: missões (sono) + conquistas
create or replace function popa_private.trg_records_gamification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := coalesce(new.user_id, old.user_id);
begin
  if not exists (select 1 from auth.users where id = v_user) then
    return null;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    perform popa_private.evaluate(old.user_id, old.date);
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    perform popa_private.evaluate(new.user_id, new.date);
  end if;
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['sleep_logs', 'body_entries', 'progress_photos'] loop
    execute format('drop trigger if exists gamification on public.%I', t);
    execute format(
      'create trigger gamification after insert or update or delete on public.%I
         for each row execute function popa_private.trg_records_gamification()', t);
  end loop;
end $$;

-- Mudou a meta? Reavalia a semana atual (no fuso do perfil).
create or replace function popa_private.trg_settings_gamification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz    text;
  v_today date;
begin
  if not exists (select 1 from auth.users where id = new.user_id) then
    return null;
  end if;

  select timezone into v_tz from public.profiles where id = new.user_id;
  begin
    v_today := (now() at time zone coalesce(v_tz, 'America/Sao_Paulo'))::date;
  exception when others then
    v_today := (now() at time zone 'America/Sao_Paulo')::date;
  end;

  perform popa_private.evaluate(new.user_id, v_today);
  return null;
end;
$$;

drop trigger if exists gamification on public.user_settings;
create trigger gamification
  after update on public.user_settings
  for each row execute function popa_private.trg_settings_gamification();

-- ---------------------------------------------------------------------------
-- Novo usuário: cria perfil e metas padrão
-- ---------------------------------------------------------------------------
create or replace function popa_private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''))
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function popa_private.handle_new_user();

-- Usuários que já existiam antes desta migração
insert into public.profiles (id)
  select id from auth.users on conflict (id) do nothing;
insert into public.user_settings (user_id)
  select id from auth.users on conflict (user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Resumo de XP e nível (view que respeita a RLS de quem consulta)
-- ---------------------------------------------------------------------------
create or replace view public.v_xp_summary
with (security_invoker = true) as
select
  p.id                       as user_id,
  x.total_xp,
  cur.level                  as level,
  cur.name                   as level_name,
  cur.min_xp                 as level_min_xp,
  nxt.level                  as next_level,
  nxt.name                   as next_level_name,
  nxt.min_xp                 as next_level_min_xp
from public.profiles p
cross join lateral (
  select coalesce(sum(e.points), 0)::int as total_xp
  from public.xp_events e where e.user_id = p.id
) x
left join lateral (
  select l.level, l.name, l.min_xp from public.level_definitions l
  where l.min_xp <= x.total_xp order by l.min_xp desc limit 1
) cur on true
left join lateral (
  select l.level, l.name, l.min_xp from public.level_definitions l
  where l.min_xp > x.total_xp order by l.min_xp asc limit 1
) nxt on true;

revoke all on public.v_xp_summary from anon;
grant select on public.v_xp_summary to authenticated;

-- ---------------------------------------------------------------------------
-- Funções internas: ninguém além do dono (e dos triggers) executa.
-- ---------------------------------------------------------------------------
revoke all on schema popa_private from public, anon, authenticated;
revoke execute on all functions in schema popa_private from public, anon, authenticated;

-- >>>>>>>> 20261103000500_seed_catalogs.sql
-- =============================================================================
-- PROJETO POPA — 005: catálogos (níveis e conquistas)
-- Reexecutável: atualiza os valores se você ajustar algo aqui.
-- =============================================================================

insert into public.level_definitions (level, name, min_xp) values
  (1, 'Iniciante',      0),
  (2, 'Em construção',  100),
  (3, 'Consistente',    300),
  (4, 'Determinado',    600),
  (5, 'Imparável',      1000),
  (6, 'Lenda',          1600)
on conflict (level) do update set name = excluded.name, min_xp = excluded.min_xp;

-- Métricas disponíveis nas regras: workout_count, total_minutes, consistent_weeks,
-- body_entries, weight_entries, sleep_nights, total_xp, photos.
-- xp_bonus fica em 0 (conquistas não dão XP extra); ajuste aqui se quiser.
insert into public.achievement_definitions (code, title, description, icon, rule, xp_bonus, sort_order) values
  ('first_workout',         'Primeiro passo',          'Registre sua primeira atividade',          'sprout',         '{"metric":"workout_count","gte":1}',      0, 10),
  ('three_activities',      'Pegou ritmo',             'Complete 3 atividades',                    'flame',          '{"metric":"workout_count","gte":3}',      0, 20),
  ('ten_activities',        'Dez sessões',             'Complete 10 atividades',                   'medal',          '{"metric":"workout_count","gte":10}',     0, 30),
  ('twenty_five_activities','Vinte e cinco',           'Complete 25 atividades',                   'award',          '{"metric":"workout_count","gte":25}',     0, 40),
  ('fifty_activities',      'Cinquentão',              'Complete 50 atividades',                   'trophy',         '{"metric":"workout_count","gte":50}',     0, 50),
  ('one_hour',              'Uma hora',                'Acumule 60 minutos de atividade',          'timer',          '{"metric":"total_minutes","gte":60}',     0, 60),
  ('ten_hours',             'Dez horas',               'Acumule 10 horas de atividade',            'hourglass',      '{"metric":"total_minutes","gte":600}',    0, 70),
  ('first_consistent_week', 'Constância',              'Cumpra a meta semanal de atividades',      'calendar-check', '{"metric":"consistent_weeks","gte":1}',   0, 80),
  ('four_consistent_weeks', 'Mês de constância',       'Cumpra a meta semanal em 4 semanas',       'calendar-range', '{"metric":"consistent_weeks","gte":4}',   0, 90),
  ('first_body_entry',      'Acompanhamento',          'Faça seu primeiro registro corporal',      'ruler',          '{"metric":"body_entries","gte":1}',       0, 100),
  ('three_weights',         'Olho na evolução',        'Registre seu peso 3 vezes',                'scale',          '{"metric":"weight_entries","gte":3}',     0, 110),
  ('five_nights',           'Prioridade ao descanso',  'Registre 5 noites de sono',                'moon',           '{"metric":"sleep_nights","gte":5}',       0, 120),
  ('hundred_xp',            'Cem XP',                  'Acumule 100 XP',                           'rocket',         '{"metric":"total_xp","gte":100}',         0, 130),
  ('five_hundred_xp',       'Quinhentos XP',           'Acumule 500 XP',                           'zap',            '{"metric":"total_xp","gte":500}',         0, 140),
  ('first_photo',           'Primeira foto',           'Guarde sua primeira foto de evolução',     'camera',         '{"metric":"photos","gte":1}',             0, 150)
on conflict (code) do update set
  title = excluded.title, description = excluded.description, icon = excluded.icon,
  rule = excluded.rule, xp_bonus = excluded.xp_bonus, sort_order = excluded.sort_order;

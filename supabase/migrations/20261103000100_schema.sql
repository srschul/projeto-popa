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

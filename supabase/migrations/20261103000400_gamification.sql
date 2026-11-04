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

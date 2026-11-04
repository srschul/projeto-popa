-- =============================================================================
-- Testes de gamificação: XP, regra de 1 treino com XP por dia, missões, conquistas,
-- níveis, mudança de meta, deduplicação por legacy_id e exclusão de conta.
-- Semanas de teste (segunda a domingo): W1 = 2020-01-06..12, W2 = 2020-01-13..19.
-- =============================================================================
\set ON_ERROR_STOP on
\set C 'cccccccc-0000-0000-0000-000000000003'
\set D 'dddddddd-0000-0000-0000-000000000004'

insert into auth.users (id, email) values (:'C', 'c@test.local');

select test.assert(popa_private.week_start('2020-01-06') = '2020-01-06'
               and popa_private.week_start('2020-01-12') = '2020-01-06'
               and popa_private.week_start('2020-01-13') = '2020-01-13',
               'semana começa na segunda-feira (domingo pertence à semana anterior)');

-- ---------------------------------------------------------------------------
-- 1) Primeiro treino
-- ---------------------------------------------------------------------------
begin;
select test.login(:'C');
insert into public.workouts (id, date, type, name, duration_min)
  values ('c1000000-0000-0000-0000-000000000001', '2020-01-06', 'strength', 'Costas', 60);

select test.assert((select total_xp from public.v_xp_summary) = 30, 'musculação rende 30 XP');
select test.assert((select level_name from public.v_xp_summary) = 'Iniciante'
                   and (select next_level_min_xp from public.v_xp_summary) = 100,
                   'nível 1 Iniciante, próximo nível em 100 XP');
select test.assert(exists (select 1 from public.user_achievements where code = 'first_workout'), 'conquista: primeiro treino');
select test.assert(exists (select 1 from public.user_achievements where code = 'one_hour'), 'conquista: uma hora (60 min)');
select test.assert(not exists (select 1 from public.user_achievements where code = 'three_activities'), 'ainda sem a conquista de 3 atividades');
commit;

-- ---------------------------------------------------------------------------
-- 2) Segundo treino no mesmo dia: conta como atividade, mas sem XP extra
-- ---------------------------------------------------------------------------
begin;
select test.login(:'C');
insert into public.workouts (id, date, type, name, duration_min)
  values ('c1000000-0000-0000-0000-000000000002', '2020-01-06', 'cardio', 'Esteira', 30);
select test.assert((select total_xp from public.v_xp_summary) = 30, 'segundo treino no mesmo dia não gera XP extra');
select test.assert((select count(*) from public.xp_events where reason = 'workout') = 1, 'um único evento de XP de treino no dia');
select test.assert((select workout_id from public.xp_events where reason = 'workout') = 'c1000000-0000-0000-0000-000000000001',
                   'o XP do dia fica com o treino de maior valor (musculação)');
commit;

-- ---------------------------------------------------------------------------
-- 3) Terceira atividade na semana: fecha a meta (3) e paga o bônus uma vez
-- ---------------------------------------------------------------------------
begin;
select test.login(:'C');
insert into public.workouts (id, date, type, name, duration_min)
  values ('c1000000-0000-0000-0000-000000000003', '2020-01-07', 'other', 'Caminhada', 20);

select test.assert((select total_xp from public.v_xp_summary) = 30 + 20 + 20, 'terceira atividade: +20 do treino e +20 de bônus semanal');
select test.assert((select count(*) from public.xp_events where reason = 'weekly_mission') = 1, 'bônus semanal pago uma vez');
select test.assert((select count(*) from public.weekly_mission_results where week_key = '2020-01-06' and mission_code = 'activities') = 1,
                   'missão de atividades registrada como concluída na semana');
select test.assert((select count(*) from public.weekly_mission_results where week_key = '2020-01-06' and mission_code = 'minutes') = 1,
                   'missão de 90 minutos concluída (110 min)');
select test.assert((select count(*) from public.weekly_mission_results where week_key = '2020-01-06' and mission_code = 'cardio') = 1,
                   'missão de 1 cardio concluída');
select test.assert((select count(*) from public.weekly_mission_results where week_key = '2020-01-06' and mission_code = 'strength') = 0,
                   'missão de 2 musculações NÃO concluída (só houve 1)');
select test.assert(exists (select 1 from public.user_achievements where code = 'three_activities'), 'conquista: 3 atividades');
select test.assert(exists (select 1 from public.user_achievements where code = 'first_consistent_week'), 'conquista: primeira semana consistente');
commit;

-- ---------------------------------------------------------------------------
-- 4) Consistência: editar observação não muda XP; apagar/recriar não repaga bônus
-- ---------------------------------------------------------------------------
begin;
select test.login(:'C');
update public.workouts set notes = 'me senti bem' where id = 'c1000000-0000-0000-0000-000000000001';
select test.assert((select total_xp from public.v_xp_summary) = 70, 'editar observação não altera o XP');

delete from public.workouts where id = 'c1000000-0000-0000-0000-000000000003';
select test.assert((select total_xp from public.v_xp_summary) = 50, 'apagar treino remove o XP dele (o bônus já pago permanece)');

insert into public.workouts (id, date, type, name, duration_min)
  values ('c1000000-0000-0000-0000-000000000003', '2020-01-07', 'other', 'Caminhada', 20);
select test.assert((select total_xp from public.v_xp_summary) = 70, 'recriar o treino devolve só o XP do treino (sem repagar o bônus)');
select test.assert((select count(*) from public.xp_events where reason = 'weekly_mission') = 1, 'continua um único bônus na semana');
commit;

-- ---------------------------------------------------------------------------
-- 5) Mudar o tipo recalcula; apagar o "vencedor" do dia passa o XP para o outro treino
-- ---------------------------------------------------------------------------
begin;
select test.login(:'C');
update public.workouts set type = 'other' where id = 'c1000000-0000-0000-0000-000000000001';
select test.assert((select total_xp from public.v_xp_summary) = 25 + 20 + 20,
                   'musculação virou "outro": o cardio do mesmo dia (25) passa a ser o treino com XP');
update public.workouts set type = 'strength' where id = 'c1000000-0000-0000-0000-000000000001';
select test.assert((select total_xp from public.v_xp_summary) = 70, 'voltar para musculação restaura 30 XP no dia');

delete from public.workouts where id = 'c1000000-0000-0000-0000-000000000001';
select test.assert((select total_xp from public.v_xp_summary) = 25 + 20 + 20,
                   'apagar o treino com XP: o outro treino do dia herda o XP (cardio 25)');
commit;

-- ---------------------------------------------------------------------------
-- 6) Mudar a data move o XP junto
-- ---------------------------------------------------------------------------
begin;
select test.login(:'C');
update public.workouts set date = '2020-01-13' where id = 'c1000000-0000-0000-0000-000000000003';
select test.assert((select count(*) from public.xp_events where occurred_on = '2020-01-07') = 0, 'nada de XP sobrando na data antiga');
select test.assert((select occurred_on from public.xp_events where workout_id = 'c1000000-0000-0000-0000-000000000003') = '2020-01-13',
                   'XP acompanha a nova data do treino');
select test.assert((select total_xp from public.v_xp_summary) = 65, 'total de XP inalterado pela mudança de data');
commit;

-- ---------------------------------------------------------------------------
-- 7) Mudar a meta reavalia a semana atual (fuso do perfil)
-- ---------------------------------------------------------------------------
begin;
select test.login(:'C');
insert into public.workouts (id, date, type, name, duration_min)
  values ('c1000000-0000-0000-0000-000000000004', (now() at time zone 'America/Sao_Paulo')::date, 'strength', 'Hoje', 40);
select test.assert((select total_xp from public.v_xp_summary) = 95, 'treino de hoje: +30 XP');
select test.assert(not exists (select 1 from public.user_achievements where code = 'hundred_xp'), 'ainda sem a conquista de 100 XP (95)');

update public.user_settings set weekly_activities_goal = 1;
select test.assert((select total_xp from public.v_xp_summary) = 115, 'baixar a meta para 1 conclui a semana atual: +20 de bônus');
select test.assert(exists (select 1 from public.user_achievements where code = 'hundred_xp'), 'conquista: 100 XP desbloqueada');
select test.assert((select level_name from public.v_xp_summary) = 'Em construção'
                   and (select next_level_name from public.v_xp_summary) = 'Consistente'
                   and (select next_level_min_xp from public.v_xp_summary) = 300,
                   '115 XP: nível Em construção, próximo Consistente em 300');
update public.user_settings set weekly_activities_goal = 3;
commit;

-- ---------------------------------------------------------------------------
-- 8) Sono, corpo e fotos
-- ---------------------------------------------------------------------------
begin;
select test.login(:'C');
insert into public.sleep_logs (date, hours, quality) values
  ('2020-01-20', 7, 'good'), ('2020-01-21', 6.5, 'fair'), ('2020-01-22', 8, 'great'), ('2020-01-23', 5.5, 'poor');
select test.assert(not exists (select 1 from public.user_achievements where code = 'five_nights'), '4 noites: ainda sem a conquista');
select test.assert((select count(*) from public.weekly_mission_results where mission_code = 'sleep_nights') = 0, '4 noites: missão de sono não concluída');
insert into public.sleep_logs (date, hours, quality) values ('2020-01-24', 7.5, 'good');
select test.assert(exists (select 1 from public.user_achievements where code = 'five_nights'), '5 noites: conquista desbloqueada');
select test.assert((select count(*) from public.weekly_mission_results where mission_code = 'sleep_nights' and week_key = '2020-01-20') = 1,
                   '5 noites na semana: missão de sono concluída');

select test.assert(not exists (select 1 from public.user_achievements where code = 'first_body_entry'), 'sem registro corporal ainda');
insert into public.body_entries (date, waist_cm) values ('2020-01-20', 90);
select test.assert(exists (select 1 from public.user_achievements where code = 'first_body_entry'), 'conquista: primeiro registro corporal (só medida, sem peso)');
select test.assert(not exists (select 1 from public.user_achievements where code = 'three_weights'), 'medida sem peso não conta para "3 pesos"');
insert into public.body_entries (date, weight_kg) values ('2020-01-21', 80), ('2020-01-28', 79.5), ('2020-02-04', 79);
select test.assert(exists (select 1 from public.user_achievements where code = 'three_weights'), 'conquista: 3 registros de peso');

insert into public.progress_photos (date, storage_path) values ('2020-01-20', :'C' || '/f1.jpg');
select test.assert(exists (select 1 from public.user_achievements where code = 'first_photo'), 'conquista: primeira foto');
commit;

-- Conquistas não são revogadas ao apagar registros
begin;
select test.login(:'C');
delete from public.sleep_logs;
select test.assert(exists (select 1 from public.user_achievements where code = 'five_nights'), 'apagar registros não revoga conquistas já desbloqueadas');
commit;

-- ---------------------------------------------------------------------------
-- 9) Migração: legacy_id evita duplicar
-- ---------------------------------------------------------------------------
begin;
select test.login(:'C');
insert into public.workouts (date, type, name, duration_min, legacy_id) values ('2020-03-02', 'cardio', 'Importado', 30, 'v1-1700000000000');
select test.throws($q$insert into public.workouts (date, type, name, duration_min, legacy_id)
                      values ('2020-03-02', 'cardio', 'Importado', 30, 'v1-1700000000000')$q$,
                   '23505', 'mesmo legacy_id não duplica');
with ins as (
  insert into public.workouts (date, type, name, duration_min, legacy_id)
  values ('2020-03-02', 'cardio', 'Importado', 30, 'v1-1700000000000')
  on conflict (user_id, legacy_id) do nothing returning 1)
  select test.assert((select count(*) from ins) = 0, 'upsert com onConflict(user_id, legacy_id) ignora duplicata');
select test.assert((select count(*) from public.workouts where legacy_id = 'v1-1700000000000') = 1, 'continua um único registro importado');
commit;

-- ---------------------------------------------------------------------------
-- 10) Excluir a conta apaga tudo em cascata, sem erro dos triggers
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values (:'D', 'd@test.local');
begin;
select test.login(:'D');
insert into public.workouts (date, type, duration_min) values ('2020-02-03', 'strength', 45), ('2020-02-03', 'cardio', 30), ('2020-02-04', 'other', 30), ('2020-02-05', 'cardio', 30);
insert into public.sleep_logs (date, hours) values ('2020-02-03', 7);
insert into public.body_entries (date, weight_kg) values ('2020-02-03', 70);
insert into public.progress_photos (date, storage_path) values ('2020-02-03', :'D' || '/f.jpg');
select test.assert((select total_xp from public.v_xp_summary) > 0, 'usuário D acumulou XP antes de ser excluído');
commit;

delete from auth.users where id = :'D';
select test.assert((select count(*) from public.workouts where user_id = :'D') = 0
               and (select count(*) from public.xp_events where user_id = :'D') = 0
               and (select count(*) from public.user_achievements where user_id = :'D') = 0
               and (select count(*) from public.weekly_mission_results where user_id = :'D') = 0
               and (select count(*) from public.sleep_logs where user_id = :'D') = 0
               and (select count(*) from public.body_entries where user_id = :'D') = 0
               and (select count(*) from public.progress_photos where user_id = :'D') = 0
               and (select count(*) from public.profiles where id = :'D') = 0
               and (select count(*) from public.user_settings where user_id = :'D') = 0,
               'excluir a conta remove todos os dados em cascata');

-- Isolamento entre usuários na gamificação: o XP de C não vaza para A/B
select test.assert((select coalesce(sum(points), 0) from public.xp_events where user_id <> :'C') = 0,
                   'XP de um usuário não afeta o de outros');

-- =============================================================================
-- Testes de RLS / isolamento entre usuários (rodam no Postgres local de teste)
-- =============================================================================
\set ON_ERROR_STOP on
\set A 'aaaaaaaa-0000-0000-0000-000000000001'
\set B 'bbbbbbbb-0000-0000-0000-000000000002'

-- Dois usuários
insert into auth.users (id, email) values (:'A', 'a@test.local'), (:'B', 'b@test.local');

select test.assert((select count(*) from public.profiles) = 2, 'cadastro cria perfil automaticamente (trigger)');
select test.assert((select count(*) from public.user_settings where weekly_activities_goal = 3
                      and weekly_strength_goal = 2 and weekly_cardio_goal = 1
                      and weekly_minutes_goal = 90 and weekly_sleep_nights_goal = 5) = 2,
                   'metas semanais padrão criadas (3 atividades, 2 musculação, 1 cardio, 90 min, 5 noites)');

-- ---------------------------------------------------------------------------
-- Usuário A cria dados
-- ---------------------------------------------------------------------------
begin;
select test.login(:'A');

insert into public.workouts (id, date, type, name, duration_min)
  values ('11111111-0000-0000-0000-000000000001', '2020-01-06', 'strength', 'Peito e tríceps', 50);
insert into public.workout_exercises (id, workout_id, name, muscle_group)
  values ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000001', 'Supino reto', 'Peito');
insert into public.exercise_sets (exercise_id, set_number, reps, weight_kg)
  values ('22222222-0000-0000-0000-000000000001', 1, 10, 40);
insert into public.workouts (id, date, type, name, duration_min)
  values ('11111111-0000-0000-0000-000000000002', '2020-01-07', 'cardio', 'Corrida', 30);
insert into public.cardio_details (workout_id, modality, distance_km)
  values ('11111111-0000-0000-0000-000000000002', 'Corrida', 4.5);
insert into public.body_entries (id, date, weight_kg) values ('33333333-0000-0000-0000-000000000001', '2020-01-06', 80.5);
insert into public.sleep_logs (id, date, hours) values ('44444444-0000-0000-0000-000000000001', '2020-01-06', 7.5);
insert into public.progress_photos (id, date, storage_path)
  values ('55555555-0000-0000-0000-000000000001', '2020-01-06', :'A' || '/foto-1.jpg');

select test.assert((select user_id from public.workouts where id = '11111111-0000-0000-0000-000000000001') = :'A'::uuid,
                   'user_id é preenchido automaticamente com auth.uid()');
select test.assert((select count(*) from public.workouts) = 2, 'A enxerga os próprios treinos');
commit;

-- ---------------------------------------------------------------------------
-- Usuário B não enxerga nem altera nada de A
-- ---------------------------------------------------------------------------
begin;
select test.login(:'B');

select test.assert((select count(*) from public.workouts)          = 0, 'B não vê treinos de A');
select test.assert((select count(*) from public.workout_exercises) = 0, 'B não vê exercícios de A');
select test.assert((select count(*) from public.exercise_sets)     = 0, 'B não vê séries de A');
select test.assert((select count(*) from public.cardio_details)    = 0, 'B não vê cardio de A');
select test.assert((select count(*) from public.body_entries)      = 0, 'B não vê medidas de A');
select test.assert((select count(*) from public.sleep_logs)        = 0, 'B não vê sono de A');
select test.assert((select count(*) from public.progress_photos)   = 0, 'B não vê fotos de A');
select test.assert((select count(*) from public.xp_events)         = 0, 'B não vê XP de A');
select test.assert((select count(*) from public.user_achievements) = 0, 'B não vê conquistas de A');
select test.assert((select count(*) from public.user_settings where user_id = :'A') = 0, 'B não vê metas de A');
select test.assert((select count(*) from public.profiles where id = :'A') = 0, 'B não vê perfil de A');

with u as (update public.workouts set name = 'invadido' returning 1)
  select test.assert((select count(*) from u) = 0, 'B não consegue alterar treino de A (0 linhas)');
with d as (delete from public.workouts returning 1)
  select test.assert((select count(*) from d) = 0, 'B não consegue apagar treino de A (0 linhas)');
with u as (update public.user_settings set weekly_activities_goal = 1 where user_id = :'A' returning 1)
  select test.assert((select count(*) from u) = 0, 'B não consegue alterar metas de A (0 linhas)');

select test.throws($q$insert into public.workouts (user_id, date, type, duration_min)
                      values ('aaaaaaaa-0000-0000-0000-000000000001', '2020-01-08', 'cardio', 10)$q$,
                   '42501', 'B não consegue inserir treino em nome de A');
select test.throws($q$insert into public.workout_exercises (workout_id, name)
                      values ('11111111-0000-0000-0000-000000000001', 'Exercício forjado')$q$,
                   '23503', 'B não consegue pendurar exercício no treino de A');
select test.throws($q$insert into public.progress_photos (date, storage_path)
                      values ('2020-01-08', 'aaaaaaaa-0000-0000-0000-000000000001/forjada.jpg')$q$,
                   '23514', 'B não consegue registrar foto apontando para a pasta de A');
commit;

-- ---------------------------------------------------------------------------
-- Gamificação é somente leitura para o cliente
-- ---------------------------------------------------------------------------
begin;
select test.login(:'A');

select test.assert((select count(*) from public.xp_events) >= 1, 'A vê o próprio XP (gerado pelo banco)');
select test.throws($q$insert into public.xp_events (user_id, reason, source_key, points, occurred_on)
                      values (auth.uid(), 'workout', 'forjado', 9999, current_date)$q$,
                   '42501', 'cliente não consegue inserir XP');
select test.throws($q$update public.xp_events set points = 9999$q$, '42501', 'cliente não consegue alterar XP');
select test.throws($q$delete from public.xp_events$q$, '42501', 'cliente não consegue apagar XP');
select test.throws($q$insert into public.user_achievements (user_id, code) values (auth.uid(), 'fifty_activities')$q$,
                   '42501', 'cliente não consegue forjar conquista');
select test.throws($q$insert into public.weekly_mission_results (user_id, week_key, mission_code, target, progress)
                      values (auth.uid(), '2020-01-06', 'strength', 1, 1)$q$,
                   '42501', 'cliente não consegue forjar missão concluída');

select test.assert((select count(*) from public.level_definitions) = 6, 'catálogo de níveis legível (6 níveis)');
select test.assert((select count(*) from public.achievement_definitions) >= 15, 'catálogo de conquistas legível');
select test.throws($q$update public.level_definitions set min_xp = 0$q$, '42501', 'cliente não altera catálogo de níveis');
select test.throws($q$delete from public.achievement_definitions$q$, '42501', 'cliente não altera catálogo de conquistas');

select test.throws($q$select popa_private.evaluate(auth.uid(), current_date)$q$,
                   '42501', 'funções internas de gamificação não são chamáveis pelo cliente');
select test.throws($q$delete from public.profiles$q$, '42501', 'cliente não apaga o próprio perfil');
commit;

-- View de XP respeita o isolamento
begin;
select test.login(:'B');
select test.assert((select count(*) from public.v_xp_summary) = 1 and (select user_id from public.v_xp_summary) = :'B'::uuid,
                   'v_xp_summary mostra só a linha do próprio usuário');
select test.assert((select total_xp from public.v_xp_summary) = 0 and (select level_name from public.v_xp_summary) = 'Iniciante',
                   'usuário novo: 0 XP, nível Iniciante');
commit;

-- ---------------------------------------------------------------------------
-- Anônimo (sem login) não acessa nada
-- ---------------------------------------------------------------------------
begin;
select test.anon();
select test.throws($q$select * from public.workouts$q$, '42501', 'anônimo não lê treinos');
select test.throws($q$select * from public.body_entries$q$, '42501', 'anônimo não lê medidas');
select test.throws($q$select * from public.level_definitions$q$, '42501', 'anônimo não lê catálogo');
select test.throws($q$select * from public.v_xp_summary$q$, '42501', 'anônimo não lê resumo de XP');
select test.throws($q$insert into public.workouts (user_id, date, type, duration_min)
                      values ('aaaaaaaa-0000-0000-0000-000000000001', '2020-01-08', 'cardio', 10)$q$,
                   '42501', 'anônimo não insere treino');
commit;

-- ---------------------------------------------------------------------------
-- Validações de dados (constraints)
-- ---------------------------------------------------------------------------
begin;
select test.login(:'A');
select test.throws($q$insert into public.workouts (date, type, duration_min) values ('2020-01-09', 'yoga', 30)$q$,
                   '23514', 'tipo de treino inválido é rejeitado');
select test.throws($q$insert into public.workouts (date, type, duration_min) values ('2020-01-09', 'cardio', 0)$q$,
                   '23514', 'duração 0 é rejeitada');
select test.throws($q$insert into public.workouts (date, type, duration_min, intensity) values ('2020-01-09', 'cardio', 20, 'extrema')$q$,
                   '23514', 'intensidade inválida é rejeitada');
select test.throws($q$insert into public.body_entries (date) values ('2020-01-09')$q$,
                   '23514', 'registro corporal vazio é rejeitado');
select test.throws($q$insert into public.body_entries (date, weight_kg) values ('2020-01-09', 5)$q$,
                   '23514', 'peso fora da faixa é rejeitado');
select test.throws($q$insert into public.sleep_logs (date, hours) values ('2020-01-06', 6)$q$,
                   '23505', 'uma noite por dia: duplicado é rejeitado');
select test.throws($q$insert into public.sleep_logs (date, hours) values ('2020-01-09', 25)$q$,
                   '23514', 'horas de sono acima de 24 são rejeitadas');
select test.throws($q$insert into public.sleep_logs (date, hours, quality) values ('2020-01-09', 7, 'otima')$q$,
                   '23514', 'qualidade de sono inválida é rejeitada');
select test.throws($q$update public.user_settings set weekly_activities_goal = 99$q$,
                   '23514', 'meta semanal absurda é rejeitada');
select test.throws($q$insert into public.exercise_sets (exercise_id, set_number, reps, weight_kg)
                      values ('22222222-0000-0000-0000-000000000001', 1, 8, 42)$q$,
                   '23505', 'número de série repetido no mesmo exercício é rejeitado');
commit;

-- Apagar o treino leva exercícios, séries e cardio junto (cascata)
begin;
select test.login(:'A');
delete from public.workouts where id = '11111111-0000-0000-0000-000000000001';
delete from public.workouts where id = '11111111-0000-0000-0000-000000000002';
select test.assert((select count(*) from public.workout_exercises) = 0
                   and (select count(*) from public.exercise_sets) = 0
                   and (select count(*) from public.cardio_details) = 0,
                   'excluir treino remove exercícios, séries e cardio associados');
select test.assert((select count(*) from public.xp_events) = 0, 'excluir treinos remove o XP correspondente');
commit;

-- ---------------------------------------------------------------------------
-- Storage privado
-- ---------------------------------------------------------------------------
select test.assert((select public from storage.buckets where id = 'progress-photos') = false,
                   'bucket progress-photos é privado');
select test.assert((select file_size_limit from storage.buckets where id = 'progress-photos') = 10485760,
                   'limite de 10 MB por foto');

begin;
select test.login(:'A');
insert into storage.objects (bucket_id, name, owner) values ('progress-photos', :'A' || '/foto-1.jpg', :'A');
select test.throws($q$insert into storage.objects (bucket_id, name) values ('progress-photos', 'bbbbbbbb-0000-0000-0000-000000000002/invasao.jpg')$q$,
                   '42501', 'A não envia arquivo para a pasta de B');
select test.throws($q$insert into storage.objects (bucket_id, name) values ('progress-photos', 'solta.jpg')$q$,
                   '42501', 'upload fora de uma pasta de usuário é rejeitado');
select test.throws($q$insert into storage.objects (bucket_id, name) values ('outro-bucket', 'aaaaaaaa-0000-0000-0000-000000000001/x.jpg')$q$,
                   '42501', 'upload em outro bucket é rejeitado (a política só vale para progress-photos)');
commit;

begin;
select test.login(:'B');
insert into storage.objects (bucket_id, name, owner) values ('progress-photos', :'B' || '/foto-b.jpg', :'B');
select test.assert((select count(*) from storage.objects) = 1 and (select name from storage.objects) like :'B' || '/%',
                   'B só enxerga os próprios arquivos');
with d as (delete from storage.objects where name like 'aaaaaaaa%' returning 1)
  select test.assert((select count(*) from d) = 0, 'B não apaga arquivo de A');
with u as (update storage.objects set name = :'B' || '/roubada.jpg' where name like 'aaaaaaaa%' returning 1)
  select test.assert((select count(*) from u) = 0, 'B não move arquivo de A para a própria pasta');
commit;

begin;
select test.anon();
select test.assert((select count(*) from storage.objects) = 0, 'anônimo não enxerga nenhum arquivo');
commit;

begin;
select test.login(:'A');
select test.assert((select count(*) from storage.objects) = 1 and (select name from storage.objects) like :'A' || '/%',
                   'A só enxerga os próprios arquivos');
commit;

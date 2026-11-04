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

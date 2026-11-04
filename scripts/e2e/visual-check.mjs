// Verificação visual com um Supabase SIMULADO (só para conferir telas e lógica de interface).
// NÃO prova a integração real com o seu projeto Supabase.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = (() => { try { return require('playwright'); } catch { return require(require('node:path').join(process.env.PW_ROOT ?? '', 'playwright')); } })();

const REF = 'ancjujiwgywzzaocvlin';
const BASE = process.env.BASE_URL ?? 'http://localhost:4173';
const OUT = process.env.OUT_DIR;
const today = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const ago = (n) => { const d = new Date(today); d.setDate(d.getDate() - n); return iso(d); };

const USER = 'aaaaaaaa-0000-0000-0000-00000000000a';
let wid = 0;
const mk = (n, type, name, dur, extra = {}) => ({
  id: `w${++wid}`, date: ago(n), type, name, duration_min: dur, intensity: 'moderate', notes: '', legacy_id: null,
  created_at: `2026-01-01T00:00:${String(wid).padStart(2, '0')}Z`, workout_exercises: [], cardio_details: null, ...extra,
});
const sets = (id, arr) => arr.map(([reps, kg], i) => ({ id: `${id}s${i}`, exercise_id: id, set_number: i + 1, reps, weight_kg: kg }));
const ex = (id, name, mg, arr) => ({ id, workout_id: 'x', name, muscle_group: mg, position: 0, notes: '', exercise_sets: sets(id, arr) });

const workouts = [
  mk(0, 'strength', 'Peito e tríceps', 55, { workout_exercises: [ex('e1', 'Supino reto', 'Peito', [[10, 50], [8, 55], [8, 55]])] }),
  mk(1, 'cardio', 'Corrida leve', 30, { cardio_details: { workout_id: 'x', modality: 'Corrida', distance_km: 4.5, avg_speed_kmh: 9, pace_sec_per_km: 400 } }),
  mk(3, 'strength', 'Costas', 50, { workout_exercises: [ex('e2', 'Remada curvada', 'Costas', [[10, 40]])] }),
  mk(8, 'strength', 'Pernas', 60, { workout_exercises: [ex('e3', 'Supino reto', 'Peito', [[10, 45], [8, 50]])] }),
  mk(9, 'other', 'Futebol', 70), mk(11, 'cardio', 'Bike', 40),
  mk(15, 'strength', 'Peito', 50, { workout_exercises: [ex('e4', 'Supino reto', 'Peito', [[10, 40], [10, 40]])] }),
  mk(18, 'cardio', 'Caminhada', 35), mk(23, 'strength', 'Full body', 45), mk(30, 'other', 'Natação', 40),
];
const body = [
  { id: 'b1', date: ago(1), weight_kg: 81.2, waist_cm: 90, chest_cm: 102, hip_cm: null, arm_cm: 35, extra: {}, legacy_id: null, created_at: '2026-01-01T00:00:01Z' },
  { id: 'b2', date: ago(15), weight_kg: 82.4, waist_cm: 92, chest_cm: 101, hip_cm: null, arm_cm: 34.5, extra: {}, legacy_id: null, created_at: '2026-01-01T00:00:02Z' },
  { id: 'b3', date: ago(30), weight_kg: 83.9, waist_cm: 94, chest_cm: null, hip_cm: null, arm_cm: null, extra: {}, legacy_id: null, created_at: '2026-01-01T00:00:03Z' },
];
const sleep = [0, 1, 2, 3, 4, 8, 9, 10].map((n, i) => ({ id: `s${i}`, date: ago(n), hours: [7.5, 6.5, 8, 5.5, 7, 6, 7.5, 8][i], quality: ['good', 'fair', 'great', 'poor', 'good', 'fair', 'good', 'great'][i], notes: '', legacy_id: null }));
const settings = { user_id: USER, weekly_activities_goal: 3, weekly_strength_goal: 2, weekly_cardio_goal: 1, weekly_minutes_goal: 90, weekly_sleep_nights_goal: 5 };
const levels = [[1, 'Iniciante', 0], [2, 'Em construção', 100], [3, 'Consistente', 300], [4, 'Determinado', 600], [5, 'Imparável', 1000], [6, 'Lenda', 1600]].map(([level, name, min_xp]) => ({ level, name, min_xp }));
const defs = [['first_workout', 'Primeiro passo', 'Registre sua primeira atividade', 'sprout'], ['three_activities', 'Pegou ritmo', 'Complete 3 atividades', 'flame'], ['ten_activities', 'Dez sessões', 'Complete 10 atividades', 'medal'], ['twenty_five_activities', 'Vinte e cinco', 'Complete 25 atividades', 'award'], ['one_hour', 'Uma hora', 'Acumule 60 minutos de atividade', 'timer'], ['five_nights', 'Prioridade ao descanso', 'Registre 5 noites de sono', 'moon']]
  .map(([code, title, description, icon], i) => ({ code, title, description, icon, sort_order: i }));
const ach = [{ code: 'first_workout', unlocked_at: new Date().toISOString() }, { code: 'three_activities', unlocked_at: new Date().toISOString() }, { code: 'one_hour', unlocked_at: new Date().toISOString() }, { code: 'five_nights', unlocked_at: new Date().toISOString() }];
const xp = { user_id: USER, total_xp: 215, level: 2, level_name: 'Em construção', level_min_xp: 100, next_level: 3, next_level_name: 'Consistente', next_level_min_xp: 300 };

const TABLES = { workouts, body_entries: body, sleep_logs: sleep, progress_photos: [], user_settings: [settings], level_definitions: levels, achievement_definitions: defs, user_achievements: ach, weekly_mission_results: [], v_xp_summary: [xp] };
const writes = [];

const browser = await chromium.launch();
const results = [];
const errors = [];

async function run(label, viewport, fn) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' });
  const session = { access_token: 'x.y.z', refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: USER, aud: 'authenticated', role: 'authenticated', email: 'teste@exemplo.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } };
  await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [`sb-${REF}-auth-token`, JSON.stringify(session)]);
  await ctx.route(`https://${REF}.supabase.co/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const hdr = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'content-type': 'application/json' };
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: hdr });
    const m = url.pathname.match(/^\/rest\/v1\/(\w+)/);
    if (url.pathname.startsWith('/auth/v1/user')) return route.fulfill({ status: 200, headers: hdr, body: JSON.stringify(session.user) });
    if (m) {
      if (req.method() !== 'GET') { writes.push(`${req.method()} ${m[1]}`); return route.fulfill({ status: 201, headers: hdr, body: '[]' }); }
      const rows = TABLES[m[1]] ?? [];
      const single = (req.headers()['accept'] ?? '').includes('pgrst.object');
      if (single) return rows[0] ? route.fulfill({ status: 200, headers: hdr, body: JSON.stringify(rows[0]) }) : route.fulfill({ status: 406, headers: hdr, body: JSON.stringify({ message: 'none' }) });
      return route.fulfill({ status: 200, headers: { ...hdr, 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` }, body: JSON.stringify(rows) });
    }
    return route.fulfill({ status: 200, headers: hdr, body: '{}' });
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`[${label}] pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(`[${label}] console: ${m.text()}`); });
  await fn(page);
  await ctx.close();
}

const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
const phone = { width: 390, height: 844 };

await run('mobile', phone, async (page) => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByText('Missões da semana').waitFor();
  results.push(['dashboard mostra XP do banco', await page.getByText('215 XP').count() > 0]);
  results.push(['dashboard mostra "faltam 85 XP"', await page.getByText('85 XP').count() > 0]);
  results.push(['dashboard mostra peso recente 81,2 kg', await page.getByText('81,2 kg').count() > 0]);
  results.push(['dashboard mostra 10 treinos', await page.getByText('Treinos realizados').locator('..').locator('..').innerText().then((t) => /\b10\b/.test(t))]);
  await shot(page, '01-dashboard');
  await page.getByRole('link', { name: 'Treinos' }).click(); await page.getByText('Evolução da carga').waitFor();
  await shot(page, '02-treinos');
  await page.getByRole('link', { name: 'Corpo' }).click(); await page.getByText('Último registro').first().waitFor();
  await shot(page, '03-corpo');
  await page.getByRole('link', { name: 'Sono' }).click(); await page.getByText('Média, últimos 7 dias').waitFor();
  await shot(page, '04-sono');
  await page.goto(BASE + '/estatisticas', { waitUntil: 'networkidle' }); await page.getByText('Treinos por semana').waitFor();
  await shot(page, '05-estatisticas');
  await page.getByRole('radio', { name: '7 dias' }).click(); await page.waitForTimeout(300);
  results.push(['filtro 7 dias altera o total de atividades', await page.getByText('Atividades').first().locator('..').locator('..').innerText().then((t) => /\b3\b/.test(t))]);
  await page.goto(BASE + '/conquistas', { waitUntil: 'networkidle' }); await page.getByText('Medalhas').waitFor();
  await shot(page, '06-conquistas');
  await page.goto(BASE + '/configuracoes', { waitUntil: 'networkidle' }); await page.getByText('Metas semanais').first().waitFor();
  await shot(page, '07-configuracoes');
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Registrar' }).click();
  await page.getByText('O que você quer registrar?').waitFor();
  await page.getByText('Treino ou atividade').click();
  await page.getByText('Registrar atividade').first().waitFor();
  await page.getByRole('button', { name: 'Adicionar exercício' }).click();
  await shot(page, '08-form-treino');
  // validação: salvar sem duração
  await page.getByRole('button', { name: /Salvar/ }).click();
  results.push(['formulário recusa treino sem duração', await page.getByText('Informe a duração').count() > 0]);
  await page.getByPlaceholder('50').fill('45');
  await page.getByRole('button', { name: /Salvar/ }).click();
  await page.waitForTimeout(600);
  results.push(['salvar treino envia gravações ao servidor', writes.some((w) => w === 'POST workouts')]);
});

await run('desktop', { width: 1280, height: 800 }, async (page) => {
  await page.goto(BASE + '/', { waitUntil: 'networkidle' }); await page.getByText('Missões da semana').waitFor();
  await shot(page, '09-desktop-dashboard');
});

await run('anon', phone, async (page) => {
  await page.addInitScript(() => localStorage.clear());
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
});
await browser.close();

for (const [n, ok] of results) console.log(`${ok ? 'OK  ' : 'FALHA'} ${n}`);
console.log('gravações simuladas:', writes.join(', ') || '(nenhuma)');
console.log(errors.length ? 'ERROS DE CONSOLE:\n' + errors.join('\n') : 'sem erros de console/página');

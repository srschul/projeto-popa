import { useQuery } from '@tanstack/react-query';
import { PHOTOS_BUCKET, supabase } from './supabase';
import type {
  AchievementDefinition, BodyEntry, Intensity, LevelDefinition, MissionResult, ProgressPhoto, SleepLog, SleepQuality,
  UserAchievement, UserSettings, Workout, WorkoutType, XpSummary,
} from './types';

export const DEFAULT_SETTINGS = {
  weekly_activities_goal: 3,
  weekly_strength_goal: 2,
  weekly_cardio_goal: 1,
  weekly_minutes_goal: 90,
  weekly_sleep_nights_goal: 5,
};

// ---------------------------------------------------------------------------
// Leitura (tudo vem do banco; o PostgREST limita 1000 linhas por chamada, então paginamos)
// ---------------------------------------------------------------------------
async function fetchAll<T>(table: string, select: string, order: { col: string; asc?: boolean }[]): Promise<T[]> {
  const page = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += page) {
    let q = supabase.from(table).select(select).range(from, from + page - 1);
    for (const o of order) q = q.order(o.col, { ascending: o.asc ?? true });
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as unknown as T[];
    out.push(...rows);
    if (rows.length < page) break;
  }
  return out;
}

const WORKOUT_SELECT =
  'id,date,type,name,duration_min,intensity,notes,legacy_id,created_at,' +
  'workout_exercises(id,workout_id,name,muscle_group,position,notes,exercise_sets(id,exercise_id,set_number,reps,weight_kg)),' +
  'cardio_details(workout_id,modality,distance_km,avg_speed_kmh,pace_sec_per_km)';

type RawWorkout = Omit<Workout, 'cardio_details'> & { cardio_details: Workout['cardio_details'] | Workout['cardio_details'][] };

export const keys = {
  workouts: ['workouts'] as const,
  body: ['body'] as const,
  sleep: ['sleep'] as const,
  photos: ['photos'] as const,
  settings: ['settings'] as const,
  xp: ['xp'] as const,
  levels: ['levels'] as const,
  achievementDefs: ['achievementDefs'] as const,
  achievements: ['achievements'] as const,
  missions: ['missions'] as const,
};

export function useWorkouts() {
  return useQuery({
    queryKey: keys.workouts,
    queryFn: async (): Promise<Workout[]> => {
      const rows = await fetchAll<RawWorkout>('workouts', WORKOUT_SELECT, [
        { col: 'date', asc: false }, { col: 'created_at', asc: false }, { col: 'id' },
      ]);
      return rows.map((r) => ({
        ...r,
        duration_min: Number(r.duration_min),
        workout_exercises: [...(r.workout_exercises ?? [])]
          .sort((a, b) => a.position - b.position)
          .map((e) => ({ ...e, exercise_sets: [...(e.exercise_sets ?? [])].sort((a, b) => a.set_number - b.set_number) })),
        cardio_details: Array.isArray(r.cardio_details) ? (r.cardio_details[0] ?? null) : (r.cardio_details ?? null),
      }));
    },
  });
}

export function useBody() {
  return useQuery({
    queryKey: keys.body,
    queryFn: () =>
      fetchAll<BodyEntry>('body_entries', 'id,date,weight_kg,waist_cm,chest_cm,hip_cm,arm_cm,extra,legacy_id,created_at', [
        { col: 'date', asc: false }, { col: 'created_at', asc: false }, { col: 'id' },
      ]),
  });
}

export function useSleep() {
  return useQuery({
    queryKey: keys.sleep,
    queryFn: () => fetchAll<SleepLog>('sleep_logs', 'id,date,hours,quality,notes,legacy_id', [{ col: 'date', asc: false }, { col: 'id' }]),
  });
}

export function usePhotos() {
  return useQuery({
    queryKey: keys.photos,
    queryFn: () => fetchAll<ProgressPhoto>('progress_photos', 'id,date,storage_path,label,notes', [{ col: 'date', asc: false }, { col: 'id' }]),
  });
}

/** URLs temporárias (1 h) para exibir as fotos privadas. */
export function usePhotoUrls(photos: ProgressPhoto[] | undefined) {
  const paths = (photos ?? []).map((p) => p.storage_path);
  return useQuery({
    queryKey: ['photoUrls', paths.join('|')],
    enabled: paths.length > 0,
    staleTime: 50 * 60 * 1000,
    queryFn: async (): Promise<Record<string, string>> => {
      const { data, error } = await supabase.storage.from(PHOTOS_BUCKET).createSignedUrls(paths, 3600);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const d of data ?? []) if (d.path && d.signedUrl) map[d.path] = d.signedUrl;
      return map;
    },
  });
}

export function useSettings(userId: string | undefined) {
  return useQuery({
    queryKey: keys.settings,
    enabled: Boolean(userId),
    queryFn: async (): Promise<UserSettings> => {
      const { data, error } = await supabase.from('user_settings').select('*').maybeSingle();
      if (error) throw error;
      if (data) return data as UserSettings;
      // linha ainda não existe (usuário criado antes do SQL): cria com as metas padrão
      const { data: created, error: e2 } = await supabase
        .from('user_settings').upsert({ user_id: userId, ...DEFAULT_SETTINGS }).select('*').single();
      if (e2) throw e2;
      return created as UserSettings;
    },
  });
}

export function useXp() {
  return useQuery({
    queryKey: keys.xp,
    queryFn: async (): Promise<XpSummary | null> => {
      const { data, error } = await supabase.from('v_xp_summary').select('*').maybeSingle();
      if (error) throw error;
      return (data as XpSummary | null) ?? null;
    },
  });
}

export function useLevels() {
  return useQuery({
    queryKey: keys.levels,
    staleTime: Infinity,
    queryFn: async (): Promise<LevelDefinition[]> => {
      const { data, error } = await supabase.from('level_definitions').select('*').order('level');
      if (error) throw error;
      return (data ?? []) as LevelDefinition[];
    },
  });
}

export function useAchievementDefs() {
  return useQuery({
    queryKey: keys.achievementDefs,
    staleTime: Infinity,
    queryFn: async (): Promise<AchievementDefinition[]> => {
      const { data, error } = await supabase.from('achievement_definitions').select('code,title,description,icon,sort_order').order('sort_order');
      if (error) throw error;
      return (data ?? []) as AchievementDefinition[];
    },
  });
}

export function useAchievements() {
  return useQuery({
    queryKey: keys.achievements,
    queryFn: async (): Promise<UserAchievement[]> => {
      const { data, error } = await supabase.from('user_achievements').select('code,unlocked_at');
      if (error) throw error;
      return (data ?? []) as UserAchievement[];
    },
  });
}

export function useMissionResults() {
  return useQuery({
    queryKey: keys.missions,
    queryFn: async (): Promise<MissionResult[]> => {
      const { data, error } = await supabase.from('weekly_mission_results').select('week_key,mission_code,target,progress,completed_at');
      if (error) throw error;
      return (data ?? []) as MissionResult[];
    },
  });
}

// ---------------------------------------------------------------------------
// Escrita
// ---------------------------------------------------------------------------
export interface SetInput { reps: number; weight_kg: number }
export interface ExerciseInput { name: string; muscle_group: string; notes: string; sets: SetInput[] }
export interface CardioInput { modality: string; distance_km: number | null }

export interface WorkoutInput {
  id?: string; // presente = edição
  date: string;
  type: WorkoutType;
  name: string;
  duration_min: number;
  intensity: Intensity;
  notes: string;
  exercises: ExerciseInput[]; // só musculação
  cardio: CardioInput | null; // só cardio
}

const newId = () => crypto.randomUUID();

function cardioRow(workoutId: string, userId: string, duration: number, c: CardioInput) {
  const dist = c.distance_km && c.distance_km > 0 ? c.distance_km : null;
  return {
    workout_id: workoutId,
    user_id: userId,
    modality: c.modality,
    distance_km: dist,
    avg_speed_kmh: dist ? Math.round((dist / (duration / 60)) * 100) / 100 : null,
    pace_sec_per_km: dist ? Math.round((duration * 60) / dist) : null,
  };
}

async function insertExercises(workoutId: string, userId: string, exercises: ExerciseInput[]) {
  const exs = exercises.filter((e) => e.name.trim());
  if (!exs.length) return;
  const exRows = exs.map((e, i) => ({
    id: newId(), workout_id: workoutId, user_id: userId, name: e.name.trim(), muscle_group: e.muscle_group, position: i, notes: e.notes,
  }));
  const { error } = await supabase.from('workout_exercises').insert(exRows);
  if (error) throw error;
  const setRows = exs.flatMap((e, i) =>
    e.sets.map((s, j) => ({ exercise_id: exRows[i].id, user_id: userId, set_number: j + 1, reps: s.reps, weight_kg: s.weight_kg })),
  );
  if (setRows.length) {
    const { error: e2 } = await supabase.from('exercise_sets').insert(setRows);
    if (e2) throw e2;
  }
}

export async function saveWorkout(input: WorkoutInput, userId: string, previous?: Workout): Promise<void> {
  const core = {
    date: input.date, type: input.type, name: input.name.trim(), duration_min: input.duration_min,
    intensity: input.intensity, notes: input.notes.trim(),
  };

  if (!input.id) {
    const id = newId();
    const { error } = await supabase.from('workouts').insert({ id, user_id: userId, ...core });
    if (error) throw error;
    try {
      if (input.type === 'strength') await insertExercises(id, userId, input.exercises);
      if (input.type === 'cardio' && input.cardio) {
        const { error: e } = await supabase.from('cardio_details').insert(cardioRow(id, userId, input.duration_min, input.cardio));
        if (e) throw e;
      }
    } catch (e) {
      await supabase.from('workouts').delete().eq('id', id); // desfaz: nada fica pela metade
      throw e;
    }
    return;
  }

  // Edição: atualiza o treino; insere os novos detalhes ANTES de remover os antigos.
  const { error } = await supabase.from('workouts').update(core).eq('id', input.id);
  if (error) throw error;

  const oldExerciseIds = (previous?.workout_exercises ?? []).map((e) => e.id);
  if (input.type === 'strength') {
    await insertExercises(input.id, userId, input.exercises);
  }
  if (oldExerciseIds.length) {
    const { error: e } = await supabase.from('workout_exercises').delete().in('id', oldExerciseIds);
    if (e) throw e;
  }
  if (input.type === 'cardio' && input.cardio) {
    const { error: e } = await supabase.from('cardio_details').upsert(cardioRow(input.id, userId, input.duration_min, input.cardio));
    if (e) throw e;
  } else {
    const { error: e } = await supabase.from('cardio_details').delete().eq('workout_id', input.id);
    if (e) throw e;
  }
}

export async function deleteWorkout(id: string): Promise<void> {
  const { error } = await supabase.from('workouts').delete().eq('id', id);
  if (error) throw error;
}

export interface BodyInput {
  id?: string;
  date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
}

export async function saveBody(input: BodyInput, userId: string): Promise<void> {
  const { id, ...fields } = input;
  const q = id
    ? supabase.from('body_entries').update(fields).eq('id', id)
    : supabase.from('body_entries').insert({ user_id: userId, ...fields });
  const { error } = await q;
  if (error) throw error;
}

export async function deleteBody(id: string): Promise<void> {
  const { error } = await supabase.from('body_entries').delete().eq('id', id);
  if (error) throw error;
}

export interface SleepInput { id?: string; date: string; hours: number; quality: SleepQuality; notes: string }

export async function saveSleep(input: SleepInput, userId: string): Promise<void> {
  const { id, ...fields } = input;
  const q = id
    ? supabase.from('sleep_logs').update(fields).eq('id', id)
    : supabase.from('sleep_logs').upsert({ user_id: userId, ...fields }, { onConflict: 'user_id,date' }); // 1 noite por dia
  const { error } = await q;
  if (error) throw error;
}

export async function deleteSleep(id: string): Promise<void> {
  const { error } = await supabase.from('sleep_logs').delete().eq('id', id);
  if (error) throw error;
}

export async function saveSettings(userId: string, s: Omit<UserSettings, 'user_id'>): Promise<void> {
  const { error } = await supabase.from('user_settings').upsert({ user_id: userId, ...s });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Fotos (bucket privado; caminho {user_id}/{uuid}.jpg)
// ---------------------------------------------------------------------------
export async function resizeImage(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Não foi possível processar a imagem.'))), 'image/jpeg', quality),
  );
}

export async function uploadPhoto(file: File, meta: { date: string; label: string }, userId: string): Promise<void> {
  const blob = await resizeImage(file);
  const path = `${userId}/${newId()}.jpg`;
  const { error } = await supabase.storage.from(PHOTOS_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const { error: e2 } = await supabase.from('progress_photos').insert({ user_id: userId, date: meta.date, storage_path: path, label: meta.label });
  if (e2) {
    await supabase.storage.from(PHOTOS_BUCKET).remove([path]); // não deixa arquivo órfão
    throw e2;
  }
}

export async function deletePhoto(photo: ProgressPhoto): Promise<void> {
  const { error } = await supabase.from('progress_photos').delete().eq('id', photo.id);
  if (error) throw error;
  await supabase.storage.from(PHOTOS_BUCKET).remove([photo.storage_path]);
}

// ---------------------------------------------------------------------------
// Backup completo
// ---------------------------------------------------------------------------
export async function buildBackup(userId: string) {
  const [workouts, body, sleep, photos, settings, xp, achievements, missions] = await Promise.all([
    fetchAll<RawWorkout>('workouts', WORKOUT_SELECT, [{ col: 'date' }, { col: 'id' }]),
    fetchAll<BodyEntry>('body_entries', '*', [{ col: 'date' }, { col: 'id' }]),
    fetchAll<SleepLog>('sleep_logs', '*', [{ col: 'date' }, { col: 'id' }]),
    fetchAll<ProgressPhoto>('progress_photos', 'id,date,storage_path,label,notes', [{ col: 'date' }, { col: 'id' }]),
    supabase.from('user_settings').select('*').maybeSingle().then((r) => r.data),
    fetchAll<unknown>('xp_events', '*', [{ col: 'id' }]),
    fetchAll<unknown>('user_achievements', '*', [{ col: 'code' }]),
    fetchAll<unknown>('weekly_mission_results', '*', [{ col: 'week_key' }, { col: 'mission_code' }]),
  ]);
  return {
    app: 'projeto-popa',
    format_version: 2,
    exported_at: new Date().toISOString(),
    user_id: userId,
    note: 'As fotos não vão dentro deste arquivo (ficam no armazenamento privado); aqui constam só os registros.',
    data: { workouts, body_entries: body, sleep_logs: sleep, progress_photos: photos, user_settings: settings, xp_events: xp, user_achievements: achievements, weekly_mission_results: missions },
  };
}

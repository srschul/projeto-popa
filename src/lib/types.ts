export type WorkoutType = 'strength' | 'cardio' | 'other';
export type Intensity = 'light' | 'moderate' | 'intense';
export type SleepQuality = 'poor' | 'fair' | 'good' | 'great';
export type MissionCode = 'activities' | 'strength' | 'cardio' | 'minutes' | 'sleep_nights';

export interface ExerciseSet {
  id: string;
  exercise_id: string;
  set_number: number;
  reps: number;
  weight_kg: number;
}

export interface WorkoutExercise {
  id: string;
  workout_id: string;
  name: string;
  muscle_group: string;
  position: number;
  notes: string;
  exercise_sets: ExerciseSet[];
}

export interface CardioDetails {
  workout_id: string;
  modality: string;
  distance_km: number | null;
  avg_speed_kmh: number | null;
  pace_sec_per_km: number | null;
}

export interface Workout {
  id: string;
  date: string; // YYYY-MM-DD
  type: WorkoutType;
  name: string;
  duration_min: number;
  intensity: Intensity;
  notes: string;
  legacy_id: string | null;
  created_at: string;
  workout_exercises: WorkoutExercise[];
  cardio_details: CardioDetails | null;
}

export interface BodyEntry {
  id: string;
  date: string;
  weight_kg: number | null;
  waist_cm: number | null;
  chest_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  extra: Record<string, unknown>;
  legacy_id: string | null;
  created_at: string;
}

export interface SleepLog {
  id: string;
  date: string;
  hours: number;
  quality: SleepQuality;
  notes: string;
  legacy_id: string | null;
}

export interface ProgressPhoto {
  id: string;
  date: string;
  storage_path: string;
  label: string;
  notes: string;
}

export interface UserSettings {
  user_id: string;
  weekly_activities_goal: number;
  weekly_strength_goal: number;
  weekly_cardio_goal: number;
  weekly_minutes_goal: number;
  weekly_sleep_nights_goal: number;
}

export interface XpSummary {
  user_id: string;
  total_xp: number;
  level: number | null;
  level_name: string | null;
  level_min_xp: number | null;
  next_level: number | null;
  next_level_name: string | null;
  next_level_min_xp: number | null;
}

export interface XpEvent {
  id: number;
  reason: 'workout' | 'weekly_mission' | 'achievement';
  source_key: string;
  workout_id: string | null;
  points: number;
  occurred_on: string;
  note: string;
}

export interface LevelDefinition {
  level: number;
  name: string;
  min_xp: number;
}

export interface AchievementDefinition {
  code: string;
  title: string;
  description: string;
  icon: string;
  sort_order: number;
}

export interface UserAchievement {
  code: string;
  unlocked_at: string;
}

export interface MissionResult {
  week_key: string;
  mission_code: MissionCode;
  target: number;
  progress: number;
  completed_at: string;
}

export type Period = '7d' | '30d' | '3m' | '6m' | 'all';

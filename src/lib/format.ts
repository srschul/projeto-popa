import type { Intensity, SleepQuality, WorkoutType } from './types';

export const TYPE_LABEL: Record<WorkoutType, string> = {
  strength: 'Musculação',
  cardio: 'Cardio',
  other: 'Outro exercício',
};
export const TYPE_XP: Record<WorkoutType, number> = { strength: 30, cardio: 25, other: 20 };

export const INTENSITY_LABEL: Record<Intensity, string> = { light: 'Leve', moderate: 'Moderada', intense: 'Intensa' };
export const QUALITY_LABEL: Record<SleepQuality, string> = { poor: 'Ruim', fair: 'Regular', good: 'Boa', great: 'Ótima' };

export const MUSCLE_GROUPS = ['Peito', 'Costas', 'Ombros', 'Bíceps', 'Tríceps', 'Pernas', 'Glúteos', 'Abdômen', 'Antebraço', 'Corpo todo', 'Outro'];

export const fmtNumber = (n: number, digits = 1): string =>
  n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: digits });

export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} min`;
}

export function fmtHoursDecimal(h: number): string {
  return `${fmtNumber(h, 1)} h`;
}

export function fmtPace(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/** Aceita "7,5" ou "7.5"; devolve null se vazio/inválido. */
export function parseDecimal(v: string): number | null {
  const t = v.trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
    const msg = (e as { message: string }).message;
    if (/failed to fetch|networkerror|load failed/i.test(msg)) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
    if (/row-level security|permission denied/i.test(msg)) return 'Sem permissão para esta ação. Tente entrar novamente.';
    if (/duplicate key/i.test(msg)) return 'Já existe um registro para essa data.';
    return msg;
  }
  return 'Algo deu errado. Tente novamente.';
}

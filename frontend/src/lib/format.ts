// Etiquetas pedagógicas en español y formato de fechas. Toda la UI pasa por aquí
// para no mostrar valores técnicos ('right', 'pending', ...) al estudiante.
import type { TaskStatus } from '../api/pedagogy';
import type { ExerciseType, Hand, RoleName } from '../types';

export const HAND_LABEL: Record<Hand, string> = {
  right: 'Mano derecha',
  left: 'Mano izquierda',
  both: 'Manos juntas',
};

export const EXERCISE_TYPE_LABEL: Record<ExerciseType, string> = {
  scale: 'Escala',
  arpeggio: 'Arpegio',
  exercise: 'Ejercicio',
};

export const DIFFICULTY_LABEL: Record<string, string> = {
  beginner: 'Inicial',
  intermediate: 'Intermedio',
  advanced: 'Avanzado',
};

export const ROLE_LABEL: Record<RoleName, string> = {
  student: 'Estudiante',
  teacher: 'Docente',
  institution_admin: 'Admin. de institución',
  admin: 'Administrador',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En práctica',
  completed: 'Completada',
};

export const SESSION_STATUS_LABEL: Record<string, string> = {
  recording: 'Sin terminar',
  completed: 'Analizada',
};

export const NOTE_LABEL: Record<string, string> = {
  C: 'Do',
  D: 'Re',
  E: 'Mi',
  F: 'Fa',
  G: 'Sol',
  A: 'La',
  B: 'Si',
};

export const FINGER_LABEL: Record<number, string> = {
  1: 'pulgar',
  2: 'índice',
  3: 'medio',
  4: 'anular',
  5: 'meñique',
};

export function label<K extends string>(map: Record<K, string>, key: K | string | null | undefined): string {
  if (!key) return '—';
  return (map as Record<string, string>)[key] ?? key;
}

/** Las fechas `YYYY-MM-DD` (sin hora) se interpretan en hora local, no UTC. */
function parseDate(value: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return parseDate(value).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return parseDate(value).toLocaleString('es-BO', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Días hasta la fecha (negativo si ya pasó). */
export function daysUntil(value: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parseDate(value).getTime() - today.getTime()) / 86_400_000);
}

export function dueLabel(value: string | null): { text: string; tone: 'neutral' | 'warning' | 'danger' } {
  if (!value) return { text: 'Sin plazo', tone: 'neutral' };
  const days = daysUntil(value);
  if (days < 0) return { text: `Venció el ${formatDate(value)}`, tone: 'danger' };
  if (days === 0) return { text: 'Vence hoy', tone: 'warning' };
  if (days === 1) return { text: 'Vence mañana', tone: 'warning' };
  if (days <= 3) return { text: `Vence en ${days} días`, tone: 'warning' };
  return { text: `Hasta el ${formatDate(value)}`, tone: 'neutral' };
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function todayIso(): string {
  const d = new Date();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

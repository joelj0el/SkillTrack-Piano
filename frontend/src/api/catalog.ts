import { apiClient } from './client';
import type { Exercise, ExerciseDetail } from '../types';

export async function listExercises(limit = 100, offset = 0): Promise<Exercise[]> {
  const { data } = await apiClient.get<Exercise[]>('/exercises', { params: { limit, offset } });
  return data;
}

export async function getExercise(id: string): Promise<ExerciseDetail> {
  const { data } = await apiClient.get<ExerciseDetail>(`/exercises/${id}`);
  return data;
}

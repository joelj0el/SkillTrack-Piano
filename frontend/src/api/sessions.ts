import { apiClient } from './client';
import type { SessionResult } from '../types';

export interface PracticeSession {
  id: string;
  student_id: string;
  exercise_id: string;
  started_at: string | null;
  ended_at: string | null;
  status: string;
  reference_threshold_version: number | null;
  created_at: string;
}

export async function createSession(studentId: string, exerciseId: string): Promise<PracticeSession> {
  const { data } = await apiClient.post<PracticeSession>('/sessions', {
    student_id: studentId,
    exercise_id: exerciseId,
  });
  return data;
}

export async function submitSessionResult(sessionId: string, result: SessionResult) {
  const { data } = await apiClient.post(`/sessions/${sessionId}/result`, result);
  return data;
}

export async function getStudentHistory(studentId: string): Promise<PracticeSession[]> {
  const { data } = await apiClient.get<PracticeSession[]>(`/sessions/student/${studentId}`);
  return data;
}

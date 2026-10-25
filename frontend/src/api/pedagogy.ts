import { apiClient } from './client';

export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface AssignedTask {
  id: string;
  teacher_id: string;
  student_id: string;
  exercise_id: string;
  due_date: string | null;
  tempo_bpm: number | null;
  notes: string | null;
  status: TaskStatus;
  created_at: string;
  updated_at: string;
}

export interface Observation {
  id: string;
  teacher_id: string;
  student_id: string;
  session_id: string | null;
  content: string;
  created_at: string;
}

export async function listTasks(params: { student_id?: string; teacher_id?: string }): Promise<AssignedTask[]> {
  const { data } = await apiClient.get<AssignedTask[]>('/tasks', { params });
  return data;
}

export interface TaskCreatePayload {
  teacher_id: string;
  student_id: string;
  exercise_id: string;
  due_date: string | null;
  tempo_bpm: number | null;
  notes: string | null;
}

export async function createTask(payload: TaskCreatePayload): Promise<AssignedTask> {
  const { data } = await apiClient.post<AssignedTask>('/tasks', payload);
  return data;
}

export async function updateTaskStatus(taskId: string, status: TaskStatus): Promise<AssignedTask> {
  const { data } = await apiClient.put<AssignedTask>(`/tasks/${taskId}`, { status });
  return data;
}

export async function createObservation(payload: {
  teacher_id: string;
  student_id: string;
  session_id?: string | null;
  content: string;
}): Promise<Observation> {
  const { data } = await apiClient.post<Observation>('/observations', payload);
  return data;
}

export async function listObservations(studentId: string): Promise<Observation[]> {
  const { data } = await apiClient.get<Observation[]>(`/observations/student/${studentId}`);
  return data;
}

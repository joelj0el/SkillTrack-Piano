import { apiClient } from './client';

export interface AssignedTask {
  id: string;
  teacher_id: string;
  student_id: string;
  exercise_id: string;
  due_date: string | null;
  notes: string | null;
  status: string;
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

export async function listTasks(studentId?: string): Promise<AssignedTask[]> {
  const { data } = await apiClient.get<AssignedTask[]>('/tasks', { params: { student_id: studentId } });
  return data;
}

export async function createTask(payload: Omit<AssignedTask, 'id' | 'status' | 'created_at' | 'updated_at'>) {
  const { data } = await apiClient.post<AssignedTask>('/tasks', payload);
  return data;
}

export async function updateTaskStatus(taskId: string, status: string) {
  const { data } = await apiClient.put<AssignedTask>(`/tasks/${taskId}`, { status });
  return data;
}

export async function createObservation(payload: {
  teacher_id: string;
  student_id: string;
  session_id?: string | null;
  content: string;
}) {
  const { data } = await apiClient.post<Observation>('/observations', payload);
  return data;
}

export async function listObservations(studentId: string): Promise<Observation[]> {
  const { data } = await apiClient.get<Observation[]>(`/observations/student/${studentId}`);
  return data;
}

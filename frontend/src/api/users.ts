import { apiClient } from './client';
import type { Institution, RoleName, User } from '../types';

export async function getUser(id: string): Promise<User> {
  const { data } = await apiClient.get<User>(`/users/${id}`);
  return data;
}

export async function listMyStudents(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users/me/students');
  return data;
}

export async function listMyTeachers(): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users/me/teachers');
  return data;
}

// --- Administración ---

export async function listUsers(params: { role?: RoleName; institution_id?: string } = {}): Promise<User[]> {
  const { data } = await apiClient.get<User[]>('/users', { params });
  return data;
}

export interface UserCreatePayload {
  email: string;
  password: string;
  full_name: string;
  role: RoleName;
  institution_id: string | null;
}

export async function createUser(payload: UserCreatePayload): Promise<User> {
  const { data } = await apiClient.post<User>('/users', payload);
  return data;
}

export async function listStudentsOfTeacher(teacherId: string): Promise<User[]> {
  const { data } = await apiClient.get<User[]>(`/users/${teacherId}/students`);
  return data;
}

export async function linkStudent(teacherId: string, studentId: string): Promise<void> {
  await apiClient.post(`/users/${teacherId}/students/${studentId}`);
}

export async function unlinkStudent(teacherId: string, studentId: string): Promise<void> {
  await apiClient.delete(`/users/${teacherId}/students/${studentId}`);
}

export async function listInstitutions(): Promise<Institution[]> {
  const { data } = await apiClient.get<Institution[]>('/institutions');
  return data;
}

export async function createInstitution(payload: { name: string; city: string | null }): Promise<Institution> {
  const { data } = await apiClient.post<Institution>('/institutions', payload);
  return data;
}

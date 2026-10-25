import { apiClient } from './client';
import type { User } from '../types';

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
  const form = new URLSearchParams();
  form.set('username', email);
  form.set('password', password);
  const { data } = await apiClient.post<TokenResponse>('/auth/token', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

/** Perfil del usuario dueño del token (se pasa explícito porque aún no está en el store). */
export async function getMe(token: string): Promise<User> {
  const { data } = await apiClient.get<User>('/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data;
}

import { apiClient } from './client';

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

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  role?: string;
  institution_id?: string | null;
}

export async function register(payload: RegisterPayload): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/auth/register', payload);
  return data;
}

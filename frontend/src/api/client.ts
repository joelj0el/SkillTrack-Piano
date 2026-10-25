import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { mockAdapter } from './mock';

export const IS_DEMO = import.meta.env.VITE_DEMO === 'true';

export const apiClient = axios.create({
  baseURL: '/api/v1',
  ...(IS_DEMO ? { adapter: mockAdapter } : {}),
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Token vencido o inválido: se cierra la sesión y PrivateRoute redirige al login.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginRequest = error.config?.url?.includes('/auth/token');
    if (error.response?.status === 401 && !isLoginRequest) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

/** Mensaje legible para mostrar al usuario a partir de un error de la API. */
export function apiErrorMessage(error: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.';
    const detail = error.response.data?.detail;
    if (typeof detail === 'string') return detail;
    if (error.response.status === 403) return 'No tienes permiso para realizar esta acción.';
    if (error.response.status === 404) return 'No se encontró lo que buscabas.';
  }
  return fallback;
}

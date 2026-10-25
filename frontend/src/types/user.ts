export type RoleName = 'student' | 'teacher' | 'institution_admin' | 'admin';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: RoleName | null;
  institution_id: string | null;
  is_active: boolean;
  created_at?: string | null;
}

export interface Institution {
  id: string;
  name: string;
  city: string | null;
  created_at: string;
}

export const ADMIN_ROLES: RoleName[] = ['admin', 'institution_admin'];

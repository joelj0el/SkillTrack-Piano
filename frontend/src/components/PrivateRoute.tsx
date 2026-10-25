import type { ReactElement } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import type { RoleName } from '../types';
import { homePathFor } from './Layout';

export default function PrivateRoute({ children, roles }: { children: ReactElement; roles?: RoleName[] }) {
  const { token, user } = useAuthStore();
  const location = useLocation();

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  if (roles && (!user.role || !roles.includes(user.role))) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return children;
}

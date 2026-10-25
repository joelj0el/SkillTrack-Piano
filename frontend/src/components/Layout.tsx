import type { ComponentType, SVGProps } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { ROLE_LABEL, label } from '../lib/format';
import type { RoleName } from '../types';
import { IconBook, IconBuilding, IconChat, IconHistory, IconPlus, IconTasks, IconUsers } from './icons';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  end?: boolean;
}

const NAV_BY_ROLE: Record<RoleName, NavItem[]> = {
  student: [
    { to: '/tareas', label: 'Mis tareas', icon: IconTasks },
    { to: '/observaciones', label: 'Observaciones', icon: IconChat },
    { to: '/catalogo', label: 'Catálogo', icon: IconBook },
    { to: '/historial', label: 'Historial', icon: IconHistory },
  ],
  teacher: [
    { to: '/docente', label: 'Mis estudiantes', icon: IconUsers, end: true },
    { to: '/docente/asignar', label: 'Asignar tarea', icon: IconPlus },
    { to: '/catalogo', label: 'Catálogo', icon: IconBook },
  ],
  institution_admin: [
    { to: '/admin', label: 'Administración', icon: IconBuilding },
    { to: '/catalogo', label: 'Catálogo', icon: IconBook },
  ],
  admin: [
    { to: '/admin', label: 'Administración', icon: IconBuilding },
    { to: '/catalogo', label: 'Catálogo', icon: IconBook },
  ],
};

export function homePathFor(role: RoleName | null | undefined): string {
  if (role === 'teacher') return '/docente';
  if (role === 'admin' || role === 'institution_admin') return '/admin';
  return '/tareas';
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const items = user?.role ? NAV_BY_ROLE[user.role] : [];
  // Móvil primero para el estudiante; escritorio primero para docente y administración.
  const narrow = user?.role === 'student';

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to={homePathFor(user?.role)} className="brand" aria-label="SkillTrack Piano, inicio">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            SkillTrack Piano
          </Link>
          <nav className="topnav" aria-label="Principal">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          {user && (
            <div className="user-menu">
              <div className="who">
                {user.full_name ?? user.email}
                <small>{label(ROLE_LABEL, user.role)}</small>
              </div>
              <button className="btn-logout" onClick={handleLogout}>
                Salir
              </button>
            </div>
          )}
        </div>
      </header>

      <main className={`main ${narrow ? 'narrow' : ''}`}>
        <Outlet />
      </main>

      {items.length > 1 && (
        <nav className="tabbar" aria-label="Principal">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>
              <item.icon />
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}

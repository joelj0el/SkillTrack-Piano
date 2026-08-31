import { Link, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function Layout() {
  const { user, logout } = useAuthStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', background: '#1a1a2e', color: '#fff' }}>
        <Link to="/" style={{ color: '#fff', textDecoration: 'none', fontWeight: 700 }}>
          🎹 SkillTrack Piano
        </Link>
        {user && (
          <nav style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <Link to="/history" style={{ color: '#fff' }}>Historial</Link>
            <span>{user.fullName ?? user.email}</span>
            <button onClick={logout}>Salir</button>
          </nav>
        )}
      </header>
      <main style={{ flex: 1, padding: '1rem' }}>
        <Outlet />
      </main>
    </div>
  );
}

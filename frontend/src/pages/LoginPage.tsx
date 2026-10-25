import { useState } from 'react';
import type { FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getMe, login } from '../api/auth';
import { apiErrorMessage } from '../api/client';
import { homePathFor } from '../components/Layout';
import { Field } from '../components/ui';
import { useAuthStore } from '../store/authStore';

const DEMO_ACCOUNTS = [
  { label: 'Estudiante', email: 'demo@estudiante.com' },
  { label: 'Docente', email: 'demo@docente.com' },
  { label: 'Administrador', email: 'demo@admin.com' },
];

const SHOW_DEMO = import.meta.env.DEV;

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { token, user, setAuth } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  if (token && user) return <Navigate to={homePathFor(user.role)} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { access_token } = await login(email.trim(), password);
      const me = await getMe(access_token);
      setAuth(access_token, me);
      navigate(from && from !== '/login' ? from : homePathFor(me.role), { replace: true });
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        setError('El correo o la contraseña no son correctos.');
      } else {
        setError(apiErrorMessage(err, 'No se pudo iniciar sesión.'));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-hero">
        <div>
          <div className="brand" style={{ marginBottom: '2.5rem' }}>
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            SkillTrack Piano
          </div>
          <h1>Tu práctica, acompañada por tu docente.</h1>
          <p>Consulta tus tareas, las observaciones de tu docente y el repertorio de ejercicios en un solo lugar.</p>
        </div>
        <div className="hero-keys" aria-hidden="true">
          {['b', 'b', '', 'b', 'b', 'b', '', 'b', 'b', '', 'b', 'b', 'b', ''].map((k, i) => (
            <span key={i} className={k} />
          ))}
        </div>
      </section>

      <section className="auth-form-side">
        <div className="auth-card">
          <h2 style={{ fontSize: '1.4rem' }}>Iniciar sesión</h2>
          <p className="muted" style={{ margin: '0.25rem 0 1.5rem' }}>
            Ingresa con la cuenta que te dio tu institución.
          </p>
          <form onSubmit={handleSubmit} className="form" noValidate={false}>
            <Field label="Correo electrónico">
              <input
                className="input"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Field>
            <Field label="Contraseña">
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
              {loading ? 'Ingresando…' : 'Ingresar'}
            </button>
          </form>

          {SHOW_DEMO && (
            <div className="demo-accounts">
              <p className="small muted" style={{ marginBottom: '0.5rem' }}>
                Cuentas de demostración (contraseña demo1234)
              </p>
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword('demo1234');
                  }}
                >
                  <strong>{acc.label}</strong>
                  <span className="muted">{acc.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

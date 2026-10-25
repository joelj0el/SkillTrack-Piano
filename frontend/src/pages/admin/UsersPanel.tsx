import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { apiErrorMessage } from '../../api/client';
import { createUser, listInstitutions, listUsers } from '../../api/users';
import { AsyncContent, Badge, EmptyState, Field } from '../../components/ui';
import { IconUsers } from '../../components/icons';
import { useAsync } from '../../hooks/useAsync';
import { ROLE_LABEL, label } from '../../lib/format';
import type { RoleName } from '../../types';
import { useAuthStore } from '../../store/authStore';

const CREATABLE_ROLES: RoleName[] = ['student', 'teacher', 'institution_admin', 'admin'];

export default function UsersPanel() {
  const me = useAuthStore((s) => s.user)!;
  const [roleFilter, setRoleFilter] = useState<RoleName | 'all'>('all');
  const state = useAsync(async () => {
    const [users, institutions] = await Promise.all([listUsers(), listInstitutions()]);
    return { users, institutions };
  }, []);

  const users = useMemo(
    () => (state.data?.users ?? []).filter((u) => roleFilter === 'all' || u.role === roleFilter),
    [state.data, roleFilter]
  );
  const institutionName = (id: string | null) => state.data?.institutions.find((i) => i.id === id)?.name ?? '—';

  // Un administrador de institución solo puede crear estudiantes y docentes.
  const roles = me.role === 'admin' ? CREATABLE_ROLES : CREATABLE_ROLES.filter((r) => r === 'student' || r === 'teacher');

  return (
    <div className="two-col" style={{ gridTemplateColumns: 'minmax(0, 1.6fr) minmax(0, 1fr)' }}>
      <div>
        <div className="row wrap" style={{ marginBottom: '0.75rem' }}>
          <select
            className="select"
            style={{ width: 'auto' }}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as RoleName | 'all')}
            aria-label="Filtrar por rol"
          >
            <option value="all">Todos los roles</option>
            {CREATABLE_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
          {state.data && <span className="small muted">{users.length} usuario(s)</span>}
        </div>
        <AsyncContent state={state}>
          {() =>
            users.length === 0 ? (
              <EmptyState title="No hay usuarios con ese rol" icon={<IconUsers />} />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Correo</th>
                      <th>Rol</th>
                      <th>Institución</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>
                          {u.full_name ?? '—'} {!u.is_active && <Badge tone="danger">Inactivo</Badge>}
                        </td>
                        <td>{u.email}</td>
                        <td>{label(ROLE_LABEL, u.role)}</td>
                        <td>{institutionName(u.institution_id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </AsyncContent>
      </div>

      {state.data && (
        <CreateUserForm
          roles={roles}
          institutions={state.data.institutions}
          defaultInstitution={me.institution_id}
          onCreated={(u) => state.setData((prev) => prev && { ...prev, users: [...prev.users, u] })}
        />
      )}
    </div>
  );
}

function CreateUserForm({
  roles,
  institutions,
  defaultInstitution,
  onCreated,
}: {
  roles: RoleName[];
  institutions: { id: string; name: string }[];
  defaultInstitution: string | null;
  onCreated: (user: Awaited<ReturnType<typeof createUser>>) => void;
}) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<RoleName>('student');
  const [institutionId, setInstitutionId] = useState(defaultInstitution ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (password.length < 8) {
      setError('La contraseña inicial debe tener al menos 8 caracteres.');
      return;
    }
    setSaving(true);
    try {
      const created = await createUser({
        full_name: fullName.trim(),
        email: email.trim(),
        password,
        role,
        institution_id: institutionId || null,
      });
      onCreated(created);
      setSuccess(`Cuenta creada para ${created.full_name}. Comparte la contraseña inicial por un canal seguro.`);
      setFullName('');
      setEmail('');
      setPassword('');
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo crear la cuenta.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h3>Nueva cuenta</h3>
      <Field label="Nombre completo">
        <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </Field>
      <Field label="Correo electrónico">
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Contraseña inicial" hint="Mínimo 8 caracteres.">
        <input
          className="input"
          type="text"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <div className="form-row">
        <Field label="Rol">
          <select className="select" value={role} onChange={(e) => setRole(e.target.value as RoleName)}>
            {roles.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Institución">
          <select className="select" value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
            <option value="">Sin institución</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="alert success" role="status">
          {success}
        </div>
      )}
      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={saving}>
          {saving ? 'Creando…' : 'Crear cuenta'}
        </button>
      </div>
    </form>
  );
}

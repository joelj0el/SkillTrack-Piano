import { useState } from 'react';
import type { FormEvent } from 'react';
import { apiErrorMessage } from '../../api/client';
import { createInstitution, listInstitutions } from '../../api/users';
import { AsyncContent, EmptyState, Field } from '../../components/ui';
import { IconBuilding } from '../../components/icons';
import { useAsync } from '../../hooks/useAsync';
import { formatDate } from '../../lib/format';

export default function InstitutionsPanel() {
  const state = useAsync(listInstitutions, []);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await createInstitution({ name: name.trim(), city: city.trim() || null });
      state.setData((prev) => [...(prev ?? []), created].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setCity('');
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo crear la institución.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="two-col">
      <div>
        <AsyncContent
          state={state}
          isEmpty={(d) => d.length === 0}
          empty={
            <EmptyState title="No hay instituciones registradas" icon={<IconBuilding />}>
              Registra la primera con el formulario.
            </EmptyState>
          }
        >
          {(institutions) => (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Ciudad</th>
                    <th>Alta</th>
                  </tr>
                </thead>
                <tbody>
                  {institutions.map((i) => (
                    <tr key={i.id}>
                      <td>{i.name}</td>
                      <td>{i.city ?? '—'}</td>
                      <td>{formatDate(i.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </AsyncContent>
      </div>

      <form className="card form" onSubmit={handleSubmit}>
        <h3>Nueva institución</h3>
        <Field label="Nombre">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} />
        </Field>
        <Field label="Ciudad">
          <input className="input" value={city} onChange={(e) => setCity(e.target.value)} maxLength={100} />
        </Field>
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Guardando…' : 'Registrar institución'}
          </button>
        </div>
      </form>
    </div>
  );
}

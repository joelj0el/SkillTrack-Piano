import { useMemo, useState } from 'react';
import { listObservations } from '../../api/pedagogy';
import { listMyTeachers } from '../../api/users';
import ObservationTimeline from '../../components/ObservationTimeline';
import { AsyncContent, EmptyState, PageHeader } from '../../components/ui';
import { IconChat } from '../../components/icons';
import { useAsync } from '../../hooks/useAsync';
import { useAuthStore } from '../../store/authStore';

export default function MyObservationsPage() {
  const user = useAuthStore((s) => s.user)!;
  const [query, setQuery] = useState('');

  const state = useAsync(async () => {
    const [observations, teachers] = await Promise.all([listObservations(user.id), listMyTeachers()]);
    return { observations, teachers: new Map(teachers.map((t) => [t.id, t])) };
  }, [user.id]);

  // Búsqueda local: cada indicación del docente debe poder recuperarse (OE1).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = state.data?.observations ?? [];
    return q ? all.filter((o) => o.content.toLowerCase().includes(q)) : all;
  }, [state.data, query]);

  return (
    <>
      <PageHeader title="Observaciones" subtitle="Indicaciones que te dejó tu docente, de la más reciente a la más antigua." />

      <AsyncContent
        state={state}
        isEmpty={(d) => d.observations.length === 0}
        empty={
          <EmptyState title="Aún no tienes observaciones" icon={<IconChat />}>
            Cuando tu docente te deje una indicación, la verás aquí y no se perderá.
          </EmptyState>
        }
      >
        {(data) => (
          <>
            <input
              className="input"
              type="search"
              placeholder="Buscar en las observaciones…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ marginBottom: '1.25rem' }}
              aria-label="Buscar en las observaciones"
            />
            {filtered.length === 0 ? (
              <EmptyState title="Sin resultados">Ninguna observación contiene «{query}».</EmptyState>
            ) : (
              <ObservationTimeline observations={filtered} authors={data.teachers} />
            )}
          </>
        )}
      </AsyncContent>
    </>
  );
}

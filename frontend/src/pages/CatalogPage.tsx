import { useMemo, useState } from 'react';
import { listExercises } from '../api/catalog';
import ExerciseCard from '../components/ExerciseCard';
import { AsyncContent, EmptyState, PageHeader } from '../components/ui';
import { IconBook } from '../components/icons';
import { useAsync } from '../hooks/useAsync';
import { EXERCISE_TYPE_LABEL, HAND_LABEL } from '../lib/format';
import type { ExerciseType, Hand } from '../types';

type Filter<T> = T | 'all';

export default function CatalogPage() {
  const state = useAsync(() => listExercises(), []);
  const [type, setType] = useState<Filter<ExerciseType>>('all');
  const [hand, setHand] = useState<Filter<Hand>>('all');

  const filtered = useMemo(
    () =>
      (state.data ?? []).filter(
        (e) => (type === 'all' || e.exercise_type === type) && (hand === 'all' || e.hand === hand)
      ),
    [state.data, type, hand]
  );

  return (
    <>
      <PageHeader title="Catálogo" subtitle="Repertorio de ejercicios con su partitura, digitación y tempo." />

      <div className="row wrap" style={{ marginBottom: '1rem', gap: '1rem' }}>
        <div className="chips" aria-label="Filtrar por tipo">
          <FilterChip active={type === 'all'} onClick={() => setType('all')}>
            Todos
          </FilterChip>
          {(Object.keys(EXERCISE_TYPE_LABEL) as ExerciseType[]).map((t) => (
            <FilterChip key={t} active={type === t} onClick={() => setType(t)}>
              {EXERCISE_TYPE_LABEL[t]}
            </FilterChip>
          ))}
        </div>
        <select
          className="select"
          style={{ width: 'auto' }}
          value={hand}
          onChange={(e) => setHand(e.target.value as Filter<Hand>)}
          aria-label="Filtrar por mano"
        >
          <option value="all">Cualquier mano</option>
          {(Object.keys(HAND_LABEL) as Hand[]).map((h) => (
            <option key={h} value={h}>
              {HAND_LABEL[h]}
            </option>
          ))}
        </select>
      </div>

      <AsyncContent
        state={state}
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState title="Aún no hay ejercicios" icon={<IconBook />}>
            El repertorio se cargará cuando los docentes lo definan.
          </EmptyState>
        }
      >
        {() =>
          filtered.length === 0 ? (
            <EmptyState title="Ningún ejercicio coincide con el filtro">Prueba con otro tipo o mano.</EmptyState>
          ) : (
            <div className="grid">
              {filtered.map((exercise) => (
                <ExerciseCard key={exercise.id} exercise={exercise} />
              ))}
            </div>
          )
        }
      </AsyncContent>
    </>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button type="button" className="chip" aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

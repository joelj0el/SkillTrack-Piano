import { Link } from 'react-router-dom';
import { listExercises } from '../api/catalog';
import { getStudentHistory } from '../api/sessions';
import SessionList from '../components/SessionList';
import { AsyncContent, EmptyState, PageHeader } from '../components/ui';
import { IconHistory } from '../components/icons';
import { useAsync } from '../hooks/useAsync';
import { useAuthStore } from '../store/authStore';

export default function HistoryPage() {
  const user = useAuthStore((s) => s.user)!;
  const state = useAsync(async () => {
    const [sessions, exercises] = await Promise.all([getStudentHistory(user.id), listExercises()]);
    return { sessions, exercises: new Map(exercises.map((e) => [e.id, e])) };
  }, [user.id]);

  return (
    <>
      <PageHeader title="Historial" subtitle="Tus intentos de práctica registrados." />
      <div className="alert info" style={{ marginBottom: '1rem' }}>
        El análisis de cada intento (notas, ritmo y postura) se incorporará en las próximas versiones.
      </div>
      <AsyncContent
        state={state}
        isEmpty={(d) => d.sessions.length === 0}
        empty={
          <EmptyState
            title="Todavía no hay intentos"
            icon={<IconHistory />}
            action={
              <Link to="/tareas" className="btn btn-secondary">
                Ir a mis tareas
              </Link>
            }
          >
            Cuando practiques un ejercicio, tu intento quedará registrado aquí.
          </EmptyState>
        }
      >
        {(data) => <SessionList sessions={data.sessions} exercises={data.exercises} />}
      </AsyncContent>
    </>
  );
}

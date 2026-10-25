import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listExercises } from '../../api/catalog';
import { apiErrorMessage } from '../../api/client';
import { listTasks, updateTaskStatus } from '../../api/pedagogy';
import type { AssignedTask, TaskStatus } from '../../api/pedagogy';
import { listMyTeachers } from '../../api/users';
import TaskCard from '../../components/TaskCard';
import { AsyncContent, EmptyState, PageHeader, Tabs } from '../../components/ui';
import { IconCheck, IconPlay, IconTasks } from '../../components/icons';
import { useAsync } from '../../hooks/useAsync';
import { daysUntil, formatDate } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';

type View = 'open' | 'completed';

export default function MyTasksPage() {
  const user = useAuthStore((s) => s.user)!;
  const [view, setView] = useState<View>('open');
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const state = useAsync(async () => {
    const [tasks, exercises, teachers] = await Promise.all([
      listTasks({ student_id: user.id }),
      listExercises(),
      listMyTeachers(),
    ]);
    return {
      tasks,
      exercises: new Map(exercises.map((e) => [e.id, e])),
      teachers: new Map(teachers.map((t) => [t.id, t])),
    };
  }, [user.id]);

  const { open, completed } = useMemo(() => {
    const tasks = state.data?.tasks ?? [];
    // Las tareas abiertas se ordenan por plazo: primero las que vencen antes.
    const byDue = (a: AssignedTask, b: AssignedTask) =>
      (a.due_date ? daysUntil(a.due_date) : Infinity) - (b.due_date ? daysUntil(b.due_date) : Infinity);
    return {
      open: tasks.filter((t) => t.status !== 'completed').sort(byDue),
      completed: tasks.filter((t) => t.status === 'completed'),
    };
  }, [state.data]);

  async function changeStatus(task: AssignedTask, status: TaskStatus) {
    setActionError(null);
    setBusyId(task.id);
    try {
      const updated = await updateTaskStatus(task.id, status);
      state.setData((prev) => prev && { ...prev, tasks: prev.tasks.map((t) => (t.id === updated.id ? updated : t)) });
    } catch (err) {
      setActionError(apiErrorMessage(err, 'No se pudo actualizar la tarea.'));
    } finally {
      setBusyId(null);
    }
  }

  const list = view === 'open' ? open : completed;

  return (
    <>
      <PageHeader title="Mis tareas" subtitle={`Hola, ${user.full_name ?? 'estudiante'}. Esto es lo que te asignaron.`} />

      <Tabs
        tabs={[
          { key: 'open', label: 'Por hacer', count: state.data ? open.length : undefined },
          { key: 'completed', label: 'Completadas', count: state.data ? completed.length : undefined },
        ]}
        value={view}
        onChange={setView}
      />

      {actionError && (
        <div className="alert error" role="alert" style={{ marginBottom: '1rem' }}>
          {actionError}
        </div>
      )}

      <AsyncContent state={state}>
        {(data) =>
          list.length === 0 ? (
            view === 'open' ? (
              <EmptyState
                title="No tienes tareas pendientes"
                icon={<IconTasks />}
                action={
                  <Link to="/catalogo" className="btn btn-secondary">
                    Explorar el catálogo
                  </Link>
                }
              >
                Cuando tu docente te asigne un ejercicio, aparecerá aquí.
              </EmptyState>
            ) : (
              <EmptyState title="Todavía no completaste tareas" icon={<IconCheck />}>
                Las tareas que marques como completadas se guardan aquí.
              </EmptyState>
            )
          ) : (
            list.map((task) => {
              const teacher = data.teachers.get(task.teacher_id);
              const busy = busyId === task.id;
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  exercise={data.exercises.get(task.exercise_id)}
                  subtitle={`${teacher?.full_name ?? 'Tu docente'} · ${formatDate(task.created_at)}`}
                  actions={
                    task.status === 'completed' ? (
                      <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => changeStatus(task, 'in_progress')}>
                        Volver a practicar
                      </button>
                    ) : (
                      <>
                        <Link to={`/catalogo/${task.exercise_id}/practicar`} className="btn btn-primary btn-sm">
                          <IconPlay width={14} height={14} /> Practicar
                        </Link>
                        {task.status === 'pending' && (
                          <button
                            className="btn btn-secondary btn-sm"
                            disabled={busy}
                            onClick={() => changeStatus(task, 'in_progress')}
                          >
                            Empecé a practicar
                          </button>
                        )}
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          onClick={() => changeStatus(task, 'completed')}
                        >
                          <IconCheck width={14} height={14} /> Marcar completada
                        </button>
                      </>
                    )
                  }
                />
              );
            })
          )
        }
      </AsyncContent>
    </>
  );
}

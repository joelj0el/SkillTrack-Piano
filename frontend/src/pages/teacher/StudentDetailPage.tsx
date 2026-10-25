import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { listExercises } from '../../api/catalog';
import { apiErrorMessage } from '../../api/client';
import { createObservation, listObservations, listTasks, updateTaskStatus } from '../../api/pedagogy';
import type { AssignedTask, TaskStatus } from '../../api/pedagogy';
import { getStudentHistory } from '../../api/sessions';
import { getUser } from '../../api/users';
import ObservationTimeline from '../../components/ObservationTimeline';
import SessionList from '../../components/SessionList';
import TaskCard from '../../components/TaskCard';
import { AsyncContent, Avatar, EmptyState, Field, PageHeader, Tabs } from '../../components/ui';
import { IconChat, IconHistory, IconPlus, IconTasks } from '../../components/icons';
import { useAsync } from '../../hooks/useAsync';
import { useAuthStore } from '../../store/authStore';
import type { Exercise } from '../../types';

type Tab = 'tasks' | 'observations' | 'sessions';

export default function StudentDetailPage() {
  const { id: studentId = '' } = useParams<{ id: string }>();
  const teacher = useAuthStore((s) => s.user)!;
  const location = useLocation();
  const flash = (location.state as { flash?: string } | null)?.flash;
  const [tab, setTab] = useState<Tab>('tasks');

  const state = useAsync(async () => {
    const [student, tasks, observations, sessions, exercises] = await Promise.all([
      getUser(studentId),
      listTasks({ student_id: studentId, teacher_id: teacher.id }),
      listObservations(studentId),
      getStudentHistory(studentId),
      listExercises(),
    ]);
    return { student, tasks, observations, sessions, exercises: new Map(exercises.map((e) => [e.id, e])) };
  }, [studentId, teacher.id]);

  return (
    <AsyncContent state={state} rows={3}>
      {(data) => {
        const openTasks = data.tasks.filter((t) => t.status !== 'completed').length;
        return (
          <>
            <PageHeader
              back={{ to: '/docente', label: 'Mis estudiantes' }}
              title={
                <span className="row">
                  <Avatar name={data.student.full_name} size="lg" />
                  {data.student.full_name ?? data.student.email}
                </span>
              }
              subtitle={data.student.email}
              actions={
                <Link to={`/docente/asignar?estudiante=${studentId}`} className="btn btn-primary">
                  <IconPlus width={16} height={16} /> Asignar tarea
                </Link>
              }
            />

            {flash && (
              <div className="alert success" role="status" style={{ marginBottom: '1rem' }}>
                {flash}
              </div>
            )}

            <Tabs
              tabs={[
                { key: 'tasks', label: 'Tareas', count: openTasks },
                { key: 'observations', label: 'Observaciones', count: data.observations.length },
                { key: 'sessions', label: 'Intentos', count: data.sessions.length },
              ]}
              value={tab}
              onChange={setTab}
            />

            {tab === 'tasks' && (
              <TasksTab
                tasks={data.tasks}
                exercises={data.exercises}
                studentId={studentId}
                onUpdated={(updated) =>
                  state.setData((prev) => prev && { ...prev, tasks: prev.tasks.map((t) => (t.id === updated.id ? updated : t)) })
                }
              />
            )}

            {tab === 'observations' && (
              <div className="two-col">
                <ObservationForm
                  teacherId={teacher.id}
                  studentId={studentId}
                  onCreated={(obs) => state.setData((prev) => prev && { ...prev, observations: [obs, ...prev.observations] })}
                />
                <div>
                  {data.observations.length === 0 ? (
                    <EmptyState title="Sin observaciones todavía" icon={<IconChat />}>
                      Lo que escribas aquí quedará disponible para el estudiante.
                    </EmptyState>
                  ) : (
                    <ObservationTimeline observations={data.observations} authors={new Map([[teacher.id, teacher]])} />
                  )}
                </div>
              </div>
            )}

            {tab === 'sessions' &&
              (data.sessions.length === 0 ? (
                <EmptyState title="El estudiante aún no registró intentos" icon={<IconHistory />}>
                  Los intentos aparecerán aquí cuando practique desde la aplicación.
                </EmptyState>
              ) : (
                <SessionList sessions={data.sessions} exercises={data.exercises} />
              ))}
          </>
        );
      }}
    </AsyncContent>
  );
}

function TasksTab({
  tasks,
  exercises,
  studentId,
  onUpdated,
}: {
  tasks: AssignedTask[];
  exercises: Map<string, Exercise>;
  studentId: string;
  onUpdated: (task: AssignedTask) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function setStatus(task: AssignedTask, status: TaskStatus) {
    setError(null);
    setBusyId(task.id);
    try {
      onUpdated(await updateTaskStatus(task.id, status));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo actualizar la tarea.'));
    } finally {
      setBusyId(null);
    }
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        title="No le asignaste tareas"
        icon={<IconTasks />}
        action={
          <Link to={`/docente/asignar?estudiante=${studentId}`} className="btn btn-primary">
            Asignar la primera tarea
          </Link>
        }
      />
    );
  }

  return (
    <>
      {error && (
        <div className="alert error" role="alert" style={{ marginBottom: '1rem' }}>
          {error}
        </div>
      )}
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          exercise={exercises.get(task.exercise_id)}
          actions={
            task.status === 'completed' ? (
              <button className="btn btn-ghost btn-sm" disabled={busyId === task.id} onClick={() => setStatus(task, 'pending')}>
                Reabrir tarea
              </button>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                disabled={busyId === task.id}
                onClick={() => setStatus(task, 'completed')}
              >
                Dar por completada
              </button>
            )
          }
        />
      ))}
    </>
  );
}

const MAX_OBSERVATION = 2000;

function ObservationForm({
  teacherId,
  studentId,
  onCreated,
}: {
  teacherId: string;
  studentId: string;
  onCreated: (obs: Awaited<ReturnType<typeof createObservation>>) => void;
}) {
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = content.trim();
    if (!text) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      onCreated(await createObservation({ teacher_id: teacherId, student_id: studentId, content: text }));
      setContent('');
      setSaved(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo guardar la observación.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card form" onSubmit={handleSubmit}>
      <h3>Nueva observación</h3>
      <Field label="Indicación para el estudiante" hint={`${content.length}/${MAX_OBSERVATION} caracteres`}>
        <textarea
          className="textarea"
          rows={5}
          maxLength={MAX_OBSERVATION}
          placeholder="Ej.: Mantén la muñeca relajada al pasar el pulgar en la escala."
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setSaved(false);
          }}
          required
        />
      </Field>
      {error && (
        <div className="alert error" role="alert">
          {error}
        </div>
      )}
      {saved && (
        <div className="alert success" role="status">
          Observación guardada. El estudiante ya puede verla.
        </div>
      )}
      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={saving || !content.trim()}>
          {saving ? 'Guardando…' : 'Guardar observación'}
        </button>
      </div>
    </form>
  );
}

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTasks } from '../../api/pedagogy';
import { listMyStudents } from '../../api/users';
import { AsyncContent, Avatar, Badge, EmptyState, PageHeader } from '../../components/ui';
import { IconPlus, IconUsers } from '../../components/icons';
import { useAsync } from '../../hooks/useAsync';
import { daysUntil } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';

export default function StudentsPage() {
  const user = useAuthStore((s) => s.user)!;
  const [query, setQuery] = useState('');

  const state = useAsync(async () => {
    const [students, tasks] = await Promise.all([listMyStudents(), listTasks({ teacher_id: user.id })]);
    return { students, tasks };
  }, [user.id]);

  const summary = useMemo(() => {
    const perStudent = new Map<string, { open: number; overdue: number; completed: number }>();
    let open = 0;
    let overdue = 0;
    for (const t of state.data?.tasks ?? []) {
      const s = perStudent.get(t.student_id) ?? { open: 0, overdue: 0, completed: 0 };
      if (t.status === 'completed') {
        s.completed++;
      } else {
        s.open++;
        open++;
        if (t.due_date && daysUntil(t.due_date) < 0) {
          s.overdue++;
          overdue++;
        }
      }
      perStudent.set(t.student_id, s);
    }
    return { perStudent, open, overdue };
  }, [state.data]);

  const students = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = state.data?.students ?? [];
    return q
      ? all.filter((s) => (s.full_name ?? '').toLowerCase().includes(q) || s.email.toLowerCase().includes(q))
      : all;
  }, [state.data, query]);

  return (
    <>
      <PageHeader
        title="Mis estudiantes"
        subtitle="Asigna tareas, deja observaciones y revisa cómo avanza cada estudiante."
        actions={
          <Link to="/docente/asignar" className="btn btn-primary">
            <IconPlus width={16} height={16} /> Asignar tarea
          </Link>
        }
      />

      <AsyncContent
        state={state}
        isEmpty={(d) => d.students.length === 0}
        empty={
          <EmptyState title="Aún no tienes estudiantes" icon={<IconUsers />}>
            La administración de tu institución debe vincularte con tus estudiantes.
          </EmptyState>
        }
      >
        {(data) => (
          <>
            <div className="stats">
              <div className="stat">
                <div className="value">{data.students.length}</div>
                <div className="label">Estudiantes</div>
              </div>
              <div className="stat">
                <div className="value">{summary.open}</div>
                <div className="label">Tareas abiertas</div>
              </div>
              <div className="stat">
                <div className="value" style={{ color: summary.overdue ? 'var(--danger)' : undefined }}>
                  {summary.overdue}
                </div>
                <div className="label">Tareas vencidas</div>
              </div>
            </div>

            <input
              className="input"
              type="search"
              placeholder="Buscar por nombre o correo…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{ marginBottom: '1rem', maxWidth: 420 }}
              aria-label="Buscar estudiante"
            />

            {students.length === 0 ? (
              <EmptyState title="Sin resultados">Ningún estudiante coincide con «{query}».</EmptyState>
            ) : (
              <div className="grid">
                {students.map((student) => {
                  const s = summary.perStudent.get(student.id);
                  return (
                    <Link key={student.id} to={`/docente/estudiantes/${student.id}`} className="card card-link">
                      <div className="row">
                        <Avatar name={student.full_name} />
                        <div style={{ minWidth: 0 }}>
                          <div className="card-title">{student.full_name ?? student.email}</div>
                          <div className="card-meta" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {student.email}
                          </div>
                        </div>
                      </div>
                      <div className="chips" style={{ marginTop: '0.8rem' }}>
                        {s?.overdue ? <Badge tone="danger">{s.overdue} vencida(s)</Badge> : null}
                        <Badge tone={s?.open ? 'brass' : 'neutral'}>{s?.open ?? 0} abierta(s)</Badge>
                        <Badge tone="success">{s?.completed ?? 0} completada(s)</Badge>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </AsyncContent>
    </>
  );
}

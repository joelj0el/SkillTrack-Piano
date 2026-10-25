import { useEffect, useMemo, useState } from 'react';
import { apiErrorMessage } from '../../api/client';
import { linkStudent, listStudentsOfTeacher, listUsers, unlinkStudent } from '../../api/users';
import { AsyncContent, Avatar, EmptyState, Field } from '../../components/ui';
import { IconUsers } from '../../components/icons';
import { useAsync } from '../../hooks/useAsync';
import type { User } from '../../types';

export default function LinksPanel() {
  const people = useAsync(async () => {
    const [teachers, students] = await Promise.all([listUsers({ role: 'teacher' }), listUsers({ role: 'student' })]);
    return { teachers, students };
  }, []);
  const [teacherId, setTeacherId] = useState('');

  useEffect(() => {
    if (!teacherId && people.data?.teachers[0]) setTeacherId(people.data.teachers[0].id);
  }, [people.data, teacherId]);

  return (
    <AsyncContent
      state={people}
      isEmpty={(d) => d.teachers.length === 0}
      empty={
        <EmptyState title="No hay docentes registrados" icon={<IconUsers />}>
          Crea primero una cuenta con rol Docente en la pestaña Usuarios.
        </EmptyState>
      }
    >
      {(data) => (
        <>
          <div style={{ maxWidth: 420, marginBottom: '1.25rem' }}>
            <Field label="Docente">
              <select className="select" value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
                {data.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.full_name ?? t.email}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {teacherId && <TeacherStudents key={teacherId} teacherId={teacherId} allStudents={data.students} />}
        </>
      )}
    </AsyncContent>
  );
}

function TeacherStudents({
  teacherId,
  allStudents,
}: {
  teacherId: string;
  allStudents: User[];
}) {
  const state = useAsync(() => listStudentsOfTeacher(teacherId), [teacherId]);
  const [toAdd, setToAdd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const available = useMemo(() => {
    const linked = new Set((state.data ?? []).map((s) => s.id));
    return allStudents.filter((s) => !linked.has(s.id));
  }, [state.data, allStudents]);

  async function add() {
    if (!toAdd) return;
    setBusy(true);
    setError(null);
    try {
      await linkStudent(teacherId, toAdd);
      const student = allStudents.find((s) => s.id === toAdd)!;
      state.setData((prev) => [...(prev ?? []), student]);
      setToAdd('');
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo vincular al estudiante.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(studentId: string) {
    setBusy(true);
    setError(null);
    try {
      await unlinkStudent(teacherId, studentId);
      state.setData((prev) => (prev ?? []).filter((s) => s.id !== studentId));
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo desvincular al estudiante.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="two-col">
      <div>
        <h3 style={{ marginBottom: '0.75rem' }}>Estudiantes a su cargo</h3>
        <AsyncContent
          state={state}
          rows={2}
          isEmpty={(d) => d.length === 0}
          empty={<EmptyState title="Sin estudiantes vinculados">Vincula estudiantes con el formulario.</EmptyState>}
        >
          {(students) =>
            students.map((s) => (
              <div key={s.id} className="card row">
                <Avatar name={s.full_name} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="card-title">{s.full_name ?? s.email}</div>
                  <div className="card-meta">{s.email}</div>
                </div>
                <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => remove(s.id)}>
                  Quitar
                </button>
              </div>
            ))
          }
        </AsyncContent>
      </div>

      <div className="card form">
        <h3>Vincular estudiante</h3>
        {available.length === 0 ? (
          <p className="muted">Todos los estudiantes registrados ya están vinculados a este docente.</p>
        ) : (
          <>
            <Field label="Estudiante">
              <select className="select" value={toAdd} onChange={(e) => setToAdd(e.target.value)}>
                <option value="">Selecciona…</option>
                {available.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.email}
                  </option>
                ))}
              </select>
            </Field>
            <div className="form-actions">
              <button className="btn btn-primary" disabled={busy || !toAdd} onClick={add}>
                Vincular
              </button>
            </div>
          </>
        )}
        {error && (
          <div className="alert error" role="alert">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

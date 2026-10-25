import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { listExercises } from '../../api/catalog';
import { apiErrorMessage } from '../../api/client';
import { createTask } from '../../api/pedagogy';
import { listMyStudents } from '../../api/users';
import { AsyncContent, EmptyState, Field, PageHeader } from '../../components/ui';
import { IconUsers } from '../../components/icons';
import { useAsync } from '../../hooks/useAsync';
import { EXERCISE_TYPE_LABEL, HAND_LABEL, label, todayIso } from '../../lib/format';
import { useAuthStore } from '../../store/authStore';

export default function AssignTaskPage() {
  const teacher = useAuthStore((s) => s.user)!;
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const [studentId, setStudentId] = useState(params.get('estudiante') ?? '');
  const [exerciseId, setExerciseId] = useState(params.get('ejercicio') ?? '');
  const [tempo, setTempo] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = useAsync(async () => {
    const [students, exercises] = await Promise.all([listMyStudents(), listExercises()]);
    return { students, exercises };
  }, []);

  const exercise = state.data?.exercises.find((e) => e.id === exerciseId);

  // Al elegir ejercicio se propone su tempo de referencia; el docente puede ajustarlo.
  useEffect(() => {
    setTempo(exercise?.tempo_bpm ? String(exercise.tempo_bpm) : '');
  }, [exercise]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const tempoNum = tempo ? Number(tempo) : null;
    if (tempoNum !== null && (!Number.isInteger(tempoNum) || tempoNum < 20 || tempoNum > 240)) {
      setError('El tempo debe ser un número entero entre 20 y 240.');
      return;
    }
    setSaving(true);
    try {
      await createTask({
        teacher_id: teacher.id,
        student_id: studentId,
        exercise_id: exerciseId,
        tempo_bpm: tempoNum,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      });
      const student = state.data?.students.find((s) => s.id === studentId);
      navigate(`/docente/estudiantes/${studentId}`, {
        state: { flash: `Tarea «${exercise?.title}» asignada a ${student?.full_name ?? 'el estudiante'}.` },
      });
    } catch (err) {
      setError(apiErrorMessage(err, 'No se pudo asignar la tarea.'));
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        back={{ to: '/docente', label: 'Mis estudiantes' }}
        title="Asignar tarea"
        subtitle="Elige el ejercicio, el tempo al que debe practicarlo y hasta cuándo."
      />

      <AsyncContent
        state={state}
        rows={1}
        isEmpty={(d) => d.students.length === 0 || d.exercises.length === 0}
        empty={
          <EmptyState title="Todavía no puedes asignar tareas" icon={<IconUsers />}>
            {state.data?.students.length === 0
              ? 'No tienes estudiantes vinculados. Pide a la administración que te los asigne.'
              : 'El catálogo de ejercicios está vacío.'}
          </EmptyState>
        }
      >
        {(data) => (
          <form className="card form" onSubmit={handleSubmit} style={{ maxWidth: 680 }}>
            <Field label="Estudiante">
              <select className="select" value={studentId} onChange={(e) => setStudentId(e.target.value)} required>
                <option value="">Selecciona un estudiante…</option>
                {data.students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name ?? s.email}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Ejercicio">
              <select className="select" value={exerciseId} onChange={(e) => setExerciseId(e.target.value)} required>
                <option value="">Selecciona un ejercicio del repertorio…</option>
                {data.exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} · {label(EXERCISE_TYPE_LABEL, ex.exercise_type)} · {label(HAND_LABEL, ex.hand)}
                  </option>
                ))}
              </select>
            </Field>
            {exercise && (
              <p className="small muted" style={{ marginTop: '-0.4rem' }}>
                <Link to={`/catalogo/${exercise.id}`}>Ver partitura y digitación</Link>
              </p>
            )}

            <div className="form-row">
              <Field
                label="Tempo (pulsos por minuto)"
                hint={exercise?.tempo_bpm ? `Referencia del ejercicio: ${exercise.tempo_bpm}` : undefined}
              >
                <input
                  className="input"
                  type="number"
                  inputMode="numeric"
                  min={20}
                  max={240}
                  value={tempo}
                  onChange={(e) => setTempo(e.target.value)}
                />
              </Field>
              <Field label="Plazo" hint="Opcional">
                <input
                  className="input"
                  type="date"
                  min={todayIso()}
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </Field>
            </div>

            <Field label="Indicaciones" hint="Opcional. El estudiante las verá junto a la tarea.">
              <textarea
                className="textarea"
                rows={4}
                maxLength={2000}
                placeholder="Ej.: Practica primero manos separadas, 10 minutos al día."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>

            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}

            <div className="form-actions">
              <Link to="/docente" className="btn btn-ghost">
                Cancelar
              </Link>
              <button type="submit" className="btn btn-primary" disabled={saving || !studentId || !exerciseId}>
                {saving ? 'Asignando…' : 'Asignar tarea'}
              </button>
            </div>
          </form>
        )}
      </AsyncContent>
    </>
  );
}

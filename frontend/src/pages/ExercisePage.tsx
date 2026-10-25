import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getExercise } from '../api/catalog';
import KeyboardDiagram from '../components/KeyboardDiagram';
import { AsyncContent, Badge, PageHeader } from '../components/ui';
import { useAsync } from '../hooks/useAsync';
import {
  DIFFICULTY_LABEL,
  EXERCISE_TYPE_LABEL,
  FINGER_LABEL,
  HAND_LABEL,
  NOTE_LABEL,
  label,
} from '../lib/format';
import { useAuthStore } from '../store/authStore';
import { useExerciseStore } from '../store/exerciseStore';
import { IconPlay, IconPlus } from '../components/icons';

export default function ExercisePage() {
  const { id = '' } = useParams<{ id: string }>();
  const role = useAuthStore((s) => s.user?.role);
  const setActiveExercise = useExerciseStore((s) => s.setActiveExercise);
  const state = useAsync(() => getExercise(id), [id]);

  useEffect(() => {
    if (state.data) setActiveExercise(state.data);
  }, [state.data, setActiveExercise]);

  return (
    <AsyncContent state={state} rows={2}>
      {(exercise) => {
        const notes = [...(exercise.expected_score?.score_data.notes ?? [])].sort((a, b) => a.position - b.position);
        return (
          <>
            <PageHeader
              back={{ to: '/catalogo', label: 'Catálogo' }}
              title={exercise.title}
              subtitle={exercise.description}
              actions={
                <>
                  {role === 'student' && (
                    <Link to={`/catalogo/${exercise.id}/practicar`} className="btn btn-primary">
                      <IconPlay width={16} height={16} /> Practicar
                    </Link>
                  )}
                  {role === 'teacher' && (
                    <Link to={`/docente/asignar?ejercicio=${exercise.id}`} className="btn btn-primary">
                      <IconPlus width={16} height={16} /> Asignar como tarea
                    </Link>
                  )}
                </>
              }
            />

            <div className="card">
              <div className="facts">
                <Fact k="Tipo" v={label(EXERCISE_TYPE_LABEL, exercise.exercise_type)} />
                <Fact k="Mano" v={label(HAND_LABEL, exercise.hand)} />
                <Fact k="Tempo" v={exercise.tempo_bpm ? `♩ = ${exercise.tempo_bpm}` : '—'} />
                <Fact k="Tonalidad" v={exercise.key_signature ?? '—'} />
                <Fact k="Octavas" v={exercise.octaves ?? '—'} />
                <Fact k="Nivel" v={label(DIFFICULTY_LABEL, exercise.difficulty_level)} />
              </div>
            </div>

            <section className="section">
              <div className="section-title">
                <h2>Partitura y digitación</h2>
                {exercise.expected_score && (
                  <Badge plain>Versión {exercise.expected_score.version}</Badge>
                )}
              </div>
              {notes.length === 0 ? (
                <div className="alert info">Este ejercicio todavía no tiene partitura cargada.</div>
              ) : (
                <div className="card">
                  <KeyboardDiagram notes={notes} />
                  <p className="small muted" style={{ margin: '1rem 0 0.5rem' }}>
                    Secuencia ({notes.length} notas). El número indica el dedo: 1 pulgar · 2 índice · 3 medio · 4
                    anular · 5 meñique{exercise.hand === 'both' ? ' · «I» = mano izquierda' : ''}.
                  </p>
                  <ol className="note-seq" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {notes.map((n) => (
                      <li
                        key={`${n.position}-${n.hand}`}
                        className="note-pill"
                        title={`Tiempo ${n.rhythm_position} · dedo ${label(FINGER_LABEL, String(n.finger))}`}
                      >
                        <div className="n">
                          {NOTE_LABEL[n.note.replace('#', '')] ?? n.note}
                          {n.note.includes('#') ? '♯' : ''}
                          <sub>{n.octave}</sub>
                        </div>
                        <div className="f">
                          {n.hand === 'left' ? 'I' : ''}
                          {n.finger}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          </>
        );
      }}
    </AsyncContent>
  );
}

function Fact({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="fact">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}

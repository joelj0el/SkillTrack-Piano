import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getExercise } from '../api/catalog';
import { useExerciseStore } from '../store/exerciseStore';
import type { ExerciseDetail } from '../types';

export default function ExercisePage() {
  const { id } = useParams<{ id: string }>();
  const [exercise, setExercise] = useState<ExerciseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const setActiveExercise = useExerciseStore((state) => state.setActiveExercise);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    getExercise(id)
      .then((data) => {
        setExercise(data);
        setActiveExercise(data);
      })
      .finally(() => setLoading(false));
  }, [id, setActiveExercise]);

  if (loading) return <p>Cargando…</p>;
  if (!exercise) return <p>Ejercicio no encontrado.</p>;

  return (
    <div>
      <h2>{exercise.title}</h2>
      <p>{exercise.description}</p>
      <ul>
        <li>Dificultad: {exercise.difficultyLevel}</li>
        <li>Mano: {exercise.hand}</li>
        <li>Tempo: {exercise.tempoBpm} bpm</li>
        <li>Tonalidad: {exercise.keySignature}</li>
        <li>Notas esperadas: {exercise.expectedScore?.scoreData.notes.length ?? 0}</li>
      </ul>
      <button onClick={() => navigate(`/exercises/${exercise.id}/capture`)}>Comenzar práctica</button>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { listExercises } from '../api/catalog';
import ExerciseCard from '../components/ExerciseCard';
import type { Exercise } from '../types';

export default function HomePage() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listExercises()
      .then(setExercises)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h2>Ejercicios disponibles</h2>
      {loading && <p>Cargando…</p>}
      {!loading && exercises.length === 0 && <p>No hay ejercicios disponibles todavía.</p>}
      {exercises.map((exercise) => (
        <ExerciseCard key={exercise.id} exercise={exercise} />
      ))}
    </div>
  );
}

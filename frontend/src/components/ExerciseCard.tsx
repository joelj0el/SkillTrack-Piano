import { Link } from 'react-router-dom';
import type { Exercise } from '../types';

export default function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <Link
      to={`/exercises/${exercise.id}`}
      style={{
        display: 'block',
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: '1rem',
        marginBottom: '0.75rem',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <h3 style={{ margin: 0 }}>{exercise.title}</h3>
      <p style={{ margin: '0.25rem 0', color: '#666' }}>{exercise.description}</p>
      <small>
        {exercise.exerciseType} · {exercise.hand} · {exercise.tempoBpm ?? '--'} bpm
      </small>
    </Link>
  );
}

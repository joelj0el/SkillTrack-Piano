import { Link } from 'react-router-dom';
import type { Exercise } from '../types';
import { DIFFICULTY_LABEL, EXERCISE_TYPE_LABEL, HAND_LABEL, label } from '../lib/format';
import { Badge } from './ui';

export default function ExerciseCard({ exercise }: { exercise: Exercise }) {
  return (
    <Link to={`/catalogo/${exercise.id}`} className="card card-link">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="card-title">{exercise.title}</div>
        <Badge tone="brass" plain>
          {label(EXERCISE_TYPE_LABEL, exercise.exercise_type)}
        </Badge>
      </div>
      {exercise.description && (
        <p className="card-meta" style={{ marginTop: '0.35rem' }}>
          {exercise.description}
        </p>
      )}
      <div className="chips" style={{ marginTop: '0.75rem' }}>
        <Badge plain>{label(HAND_LABEL, exercise.hand)}</Badge>
        {exercise.tempo_bpm && <Badge plain>♩ = {exercise.tempo_bpm}</Badge>}
        {exercise.key_signature && <Badge plain>{exercise.key_signature}</Badge>}
        {exercise.difficulty_level && <Badge plain>{label(DIFFICULTY_LABEL, exercise.difficulty_level)}</Badge>}
      </div>
    </Link>
  );
}

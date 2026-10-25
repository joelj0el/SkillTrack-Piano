import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { AssignedTask } from '../api/pedagogy';
import type { Exercise } from '../types';
import { HAND_LABEL, TASK_STATUS_LABEL, dueLabel, formatDate, label } from '../lib/format';
import { Badge } from './ui';

const STATUS_TONE = { pending: 'brass', in_progress: 'info', completed: 'success' } as const;

export default function TaskCard({
  task,
  exercise,
  subtitle,
  actions,
}: {
  task: AssignedTask;
  exercise: Exercise | undefined;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  const due = dueLabel(task.due_date);
  const tempo = task.tempo_bpm ?? exercise?.tempo_bpm;

  return (
    <article className={`card task-card status-${task.status}`}>
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="card-title">
            {exercise ? (
              <Link to={`/catalogo/${exercise.id}`} style={{ textDecoration: 'none' }}>
                {exercise.title}
              </Link>
            ) : (
              'Ejercicio no disponible'
            )}
          </div>
          <div className="card-meta">
            {subtitle ?? `Asignada el ${formatDate(task.created_at)}`}
          </div>
        </div>
        <Badge tone={STATUS_TONE[task.status] ?? 'neutral'}>{label(TASK_STATUS_LABEL, task.status)}</Badge>
      </div>

      <div className="chips" style={{ marginTop: '0.7rem' }}>
        {task.status !== 'completed' && (
          <Badge tone={due.tone === 'neutral' ? 'neutral' : due.tone} plain={due.tone === 'neutral'}>
            {due.text}
          </Badge>
        )}
        {tempo && (
          <Badge plain>
            ♩ = {tempo}
            {task.tempo_bpm && exercise?.tempo_bpm && task.tempo_bpm !== exercise.tempo_bpm ? ' (ajustado)' : ''}
          </Badge>
        )}
        {exercise && <Badge plain>{label(HAND_LABEL, exercise.hand)}</Badge>}
      </div>

      {task.notes && <p className="task-notes pre-line">{task.notes}</p>}
      {actions && <div className="task-actions">{actions}</div>}
    </article>
  );
}

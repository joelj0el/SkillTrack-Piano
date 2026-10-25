import type { PracticeSession } from '../api/sessions';
import type { Exercise } from '../types';
import { SESSION_STATUS_LABEL, formatDateTime, label } from '../lib/format';
import { Badge } from './ui';

function duration(s: PracticeSession): string {
  if (!s.started_at || !s.ended_at) return '—';
  const secs = Math.max(0, Math.round((new Date(s.ended_at).getTime() - new Date(s.started_at).getTime()) / 1000));
  return secs < 60 ? `${secs} s` : `${Math.floor(secs / 60)} min ${secs % 60} s`;
}

export default function SessionList({
  sessions,
  exercises,
}: {
  sessions: PracticeSession[];
  exercises: Map<string, Exercise>;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Ejercicio</th>
            <th>Duración</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <tr key={s.id}>
              <td>{formatDateTime(s.started_at ?? s.created_at)}</td>
              <td>{exercises.get(s.exercise_id)?.title ?? 'Ejercicio no disponible'}</td>
              <td>{duration(s)}</td>
              <td>
                <Badge tone={s.status === 'completed' ? 'success' : 'neutral'}>
                  {label(SESSION_STATUS_LABEL, s.status)}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

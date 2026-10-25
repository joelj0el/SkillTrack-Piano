import type { Observation } from '../api/pedagogy';
import type { User } from '../types';
import { formatDateTime } from '../lib/format';
import { Avatar } from './ui';

export default function ObservationTimeline({
  observations,
  authors,
}: {
  observations: Observation[];
  authors: Map<string, User>;
}) {
  return (
    <ol className="timeline">
      {observations.map((obs) => {
        const author = authors.get(obs.teacher_id);
        return (
          <li key={obs.id}>
            <Avatar name={author?.full_name ?? 'Docente'} />
            <div className="bubble">
              <div className="row between small" style={{ marginBottom: '0.3rem' }}>
                <strong>{author?.full_name ?? 'Docente'}</strong>
                <time className="muted" dateTime={obs.created_at}>
                  {formatDateTime(obs.created_at)}
                </time>
              </div>
              <p className="pre-line">{obs.content}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

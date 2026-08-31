// STUB: cálculo de puntuación final y generación de retroalimentación pedagógica.
// Se implementará en una iteración futura (comparación contra expected_score y reference_thresholds).
import type { ExpectedNote, ReferenceThreshold } from '../types';
import type { FeedbackItem } from '../types/feedback';
import type { FusedEvent } from './fusion';

export interface ScoringResult {
  overallScore: number;
  feedback: FeedbackItem[];
}

export function scoreSession(
  fusedEvents: FusedEvent[],
  expectedNotes: ExpectedNote[],
  thresholds: ReferenceThreshold | null
): ScoringResult {
  console.warn('STUB: módulo no implementado', {
    fusedEventsCount: fusedEvents.length,
    expectedNotesCount: expectedNotes.length,
    hasThresholds: thresholds !== null,
  });
  return {
    overallScore: 0,
    feedback: [],
  };
}

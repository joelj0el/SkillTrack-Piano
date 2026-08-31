// Sincronización del resultado de la sesión con el backend.
import { submitSessionResult } from '../api/sessions';
import type { SessionResult } from '../types';

export async function syncSessionResult(result: SessionResult): Promise<void> {
  await submitSessionResult(result.sessionId, result);
}

export function buildEmptySessionResult(params: {
  sessionId: string;
  exerciseId: string;
  studentId: string;
  startedAt: string;
  referenceThresholdVersion: number;
}): SessionResult {
  return {
    sessionId: params.sessionId,
    exerciseId: params.exerciseId,
    studentId: params.studentId,
    startedAt: params.startedAt,
    endedAt: new Date().toISOString(),
    referenceThresholdVersion: params.referenceThresholdVersion,
    visionErrors: [],
    audioEvents: [],
    fusionEvents: [],
    feedbackSummary: [],
    overallScore: undefined,
  };
}

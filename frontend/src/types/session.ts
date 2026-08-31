import type { FeedbackItem } from './feedback';

export interface ExpectedNote {
  position: number; // orden en la secuencia
  note: string; // 'C', 'D', 'E', etc.
  octave: number; // 4, 5, etc.
  hand: 'left' | 'right';
  finger: number; // 1-5
  rhythmPosition: number; // en beats
}

export interface Landmark {
  x: number;
  y: number;
  z: number;
}

export interface VisionError {
  notePosition: number;
  finger: number;
  hand: 'left' | 'right';
  errorType: 'wrong_finger' | 'curvature' | 'timing' | 'missed';
  severity: 'low' | 'medium' | 'high';
  detectedValue?: number;
  expectedValue?: number;
}

export interface AudioEvent {
  timestamp: number;
  frequency: number;
  onsetDetected: boolean;
  rhythmConformity: number; // 0-1
}

export interface FusedEvent {
  notePosition: number;
  timestamp: number;
  visionConfirmed: boolean;
  audioConfirmed: boolean;
  resolved: boolean;
}

export interface SessionResult {
  sessionId: string;
  exerciseId: string;
  studentId: string;
  startedAt: string; // ISO 8601
  endedAt: string;
  referenceThresholdVersion: number;
  visionErrors: VisionError[];
  audioEvents: AudioEvent[];
  fusionEvents: FusedEvent[];
  feedbackSummary: FeedbackItem[];
  overallScore?: number;
}

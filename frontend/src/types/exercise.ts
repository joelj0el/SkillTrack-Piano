import type { ExpectedNote } from './session';

export type { ExpectedNote };

export interface RhythmPosition {
  position: number;
  beat: number;
}

export interface ExpectedScore {
  id: string;
  version: number;
  scoreData: {
    notes: ExpectedNote[];
  };
  createdAt: string;
}

export interface ReferenceThreshold {
  id: string;
  version: number;
  thresholds: {
    angle_tolerances: Record<string, number>;
    distance_tolerances: Record<string, number>;
    timing_tolerance_ms: number;
    validated_by: string[];
  };
  createdAt: string;
}

export interface Exercise {
  id: string;
  title: string;
  description?: string;
  difficultyLevel?: string;
  hand: 'left' | 'right' | 'both';
  tempoBpm?: number;
  keySignature?: string;
  octaves?: number;
  exerciseType: 'scale' | 'arpeggio' | 'exercise';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExerciseDetail extends Exercise {
  expectedScore?: ExpectedScore;
  referenceThresholds: ReferenceThreshold[];
}

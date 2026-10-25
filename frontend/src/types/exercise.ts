// Los campos siguen el formato snake_case que devuelve la API (schemas/catalog.py).

export interface ExpectedNote {
  position: number; // orden en la secuencia
  note: string; // 'C', 'D', 'E', etc.
  octave: number; // 4, 5, etc.
  hand: 'left' | 'right';
  finger: number; // 1-5
  rhythm_position: number; // en beats
}

export interface ExpectedScore {
  id: string;
  version: number;
  score_data: {
    notes: ExpectedNote[];
  };
  created_at: string;
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
  created_at: string;
}

export type Hand = 'left' | 'right' | 'both';
export type ExerciseType = 'scale' | 'arpeggio' | 'exercise';

export interface Exercise {
  id: string;
  title: string;
  description: string | null;
  difficulty_level: string | null;
  hand: Hand;
  tempo_bpm: number | null;
  key_signature: string | null;
  octaves: number | null;
  exercise_type: ExerciseType;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExerciseDetail extends Exercise {
  expected_score: ExpectedScore | null;
  reference_thresholds: ReferenceThreshold[];
}

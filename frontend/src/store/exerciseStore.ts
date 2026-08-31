import { create } from 'zustand';
import type { ExerciseDetail } from '../types';

interface ExerciseState {
  activeExercise: ExerciseDetail | null;
  setActiveExercise: (exercise: ExerciseDetail | null) => void;
}

export const useExerciseStore = create<ExerciseState>((set) => ({
  activeExercise: null,
  setActiveExercise: (exercise) => set({ activeExercise: exercise }),
}));

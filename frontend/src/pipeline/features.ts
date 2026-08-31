// STUB: extracción de características invariantes a partir de los landmarks de mano.
// Se implementará en una iteración futura (normalización de escala/rotación, ángulos de dedo, etc.).
import type { Landmark } from '../types';

export interface InvariantFeatures {
  handId: number;
  fingerAngles: number[]; // ángulo de flexión por dedo, 5 valores
  fingerSpacing: number[]; // distancia normalizada entre dedos adyacentes
  wristFlatnessDeg: number;
  palmOrientation: 'up' | 'down' | 'side';
  timestamp: number;
}

export function extractInvariantFeatures(
  landmarks: Landmark[],
  timestamp: number
): InvariantFeatures {
  console.warn('STUB: módulo no implementado', { landmarksCount: landmarks.length });
  return {
    handId: 0,
    fingerAngles: [0, 0, 0, 0, 0],
    fingerSpacing: [0, 0, 0, 0],
    wristFlatnessDeg: 0,
    palmOrientation: 'down',
    timestamp,
  };
}

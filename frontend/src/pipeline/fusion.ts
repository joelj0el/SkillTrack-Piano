// STUB: fusión de eventos de visión y audio en una línea de tiempo unificada.
// Se implementará en una iteración futura (alineación temporal, resolución de conflictos).
import type { AudioFeatures } from './audio';
import type { InvariantFeatures } from './features';

export interface FusedEvent {
  notePosition: number;
  timestamp: number;
  visionConfirmed: boolean;
  audioConfirmed: boolean;
  resolved: boolean;
}

export function fuseEvents(
  visionFeatures: InvariantFeatures[],
  audioFeatures: AudioFeatures[]
): FusedEvent[] {
  console.warn('STUB: módulo no implementado', {
    visionCount: visionFeatures.length,
    audioCount: audioFeatures.length,
  });
  return [];
}

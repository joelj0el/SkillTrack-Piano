// STUB: análisis de audio (detección de onset y estimación de frecuencia fundamental).
// Se implementará en una iteración futura (Web Audio API + FFT / autocorrelación).

export interface AudioFeatures {
  timestamp: number;
  frequency: number;
  amplitude: number;
  onsetDetected: boolean;
  rhythmConformity: number; // 0-1
}

export function analyzeAudioChunk(audioBuffer: Float32Array, sampleRate: number, timestamp: number): AudioFeatures {
  console.warn('STUB: módulo no implementado', { samples: audioBuffer.length, sampleRate });
  return {
    timestamp,
    frequency: 0,
    amplitude: 0,
    onsetDetected: false,
    rhythmConformity: 0,
  };
}

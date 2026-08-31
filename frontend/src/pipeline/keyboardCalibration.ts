// STUB: calibración de la posición del teclado en el encuadre de la cámara.
// Se implementará en una iteración futura (detección de bordes del teclado, mapeo tecla->región).

export interface KeyRegion {
  note: string;
  octave: number;
  x: number; // posición normalizada 0-1 en el frame
  y: number;
  width: number;
  height: number;
}

export interface KeyboardMap {
  calibrated: boolean;
  keys: KeyRegion[];
  originX: number;
  originY: number;
  widthPerKey: number;
}

export function calibrateKeyboard(frameWidth: number, frameHeight: number): KeyboardMap {
  console.warn('STUB: módulo no implementado', { frameWidth, frameHeight });
  return {
    calibrated: false,
    keys: [],
    originX: 0,
    originY: 0,
    widthPerKey: 0,
  };
}

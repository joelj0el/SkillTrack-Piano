/**
 * Metrónomo y conteo previo. Programa en tiempo (s) relativo al inicio: el reloj real lo pone
 * quien reproduce (AudioContext), no el núcleo.
 */

/** 2 compases de 2/4 = 4 pulsos audibles antes de tocar. */
export const PULSOS_CONTEO = 4;
// PRM-02: el docente asigna entre 60 y 75; el estudiante puede bajar a 40 como práctica lenta.
export const TEMPO_MINIMO_ESTUDIANTE = 40;
export const TEMPO_MAXIMO = 75;

export type ModoMetronomo = "con" | "sin";

export interface Programa {
  /** Instantes de los clics audibles del conteo. */
  conteo: number[];
  /** Instante desde el que se mide la ejecución (el pulso siguiente al conteo). */
  inicioMedicion: number;
  /** Pulsos visuales mudos tras el conteo (solo "con metrónomo"), hasta `duracion`. */
  pulsosVisuales: number[];
}

export function programa(tempo: number, modo: ModoMetronomo, duracion: number): Programa {
  const pulso = 60 / tempo;
  const conteo = Array.from({ length: PULSOS_CONTEO }, (_, i) => i * pulso);
  const inicioMedicion = PULSOS_CONTEO * pulso;
  const pulsosVisuales: number[] = [];
  if (modo === "con") {
    // Por índice, no acumulando: sumar 0,8 repetidamente pierde precisión y omite el último pulso.
    const cantidad = Math.ceil(duracion / pulso - 1e-9);
    for (let i = 0; i < cantidad; i++) pulsosVisuales.push(inicioMedicion + i * pulso);
  }
  return { conteo, inicioMedicion, pulsosVisuales };
}

export interface OpcionesTempo {
  min: number;
  max: number;
  /** Por debajo de este tempo se etiqueta "Práctica lenta: no cuenta para la tarea". */
  minimoQueCuenta: number | null;
}

/** PA-HU19-01: con tarea, de 40 al máximo de la tarea; sin tarea, todo el rango de PRM-02. */
export function opcionesTempo(tarea: { tempoMin: number; tempoMax: number } | null): OpcionesTempo {
  if (tarea === null)
    return { min: TEMPO_MINIMO_ESTUDIANTE, max: TEMPO_MAXIMO, minimoQueCuenta: null };
  return { min: TEMPO_MINIMO_ESTUDIANTE, max: tarea.tempoMax, minimoQueCuenta: tarea.tempoMin };
}

export function etiquetaTempo(tempo: number, opciones: OpcionesTempo): string | null {
  return opciones.minimoQueCuenta !== null && tempo < opciones.minimoQueCuenta
    ? "Práctica lenta: no cuenta para la tarea"
    : null;
}

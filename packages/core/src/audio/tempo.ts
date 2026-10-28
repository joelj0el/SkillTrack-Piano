/**
 * Ritmo sobre los ataques crudos (antes de alinear con la partitura). Repertorio en semicorcheas:
 * cuatro notas por pulso. Umbrales provisionales del proyecto: PRM-08 (4 pulsos para el tempo
 * inicial), PRM-09 (5 % de cambio de tempo) y PRM-10 (±25 % del intervalo para un tropiezo).
 */
export const NOTAS_POR_PULSO = 4;
export const PULSOS_TEMPO_INICIAL = 4;
export const UMBRAL_CAMBIO_TEMPO = 0.05;
export const UMBRAL_TROPIEZO = 0.25;

function mediana(v: readonly number[]): number {
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
}

function intervalos(ataques: readonly number[]): number[] {
  return ataques.slice(1).map((t, i) => t - ataques[i]!);
}

/** Tempo (♩/min) a partir de intervalos entre semicorcheas (mediana: robusta a un tropiezo). */
export function tempoDeIntervalos(ints: readonly number[]): number {
  return 60 / (NOTAS_POR_PULSO * mediana(ints));
}

export interface AnalisisTempo {
  referencia: "tempo_elegido" | "tempo_inicial";
  tempoReferencia: number;
  tempoInicial: number;
  tempoFinal: number;
  cambioPct: number;
  estado: "estable" | "aceleraste" | "frenaste";
  /** Índices de los ataques marcados como tropiezo o pausa. */
  tropiezos: number[];
}

export function analizarTempo(
  ataques: readonly number[],
  modo: { metronomo: "con" | "sin"; tempoElegido: number | null },
): AnalisisTempo {
  const ints = intervalos(ataques);
  const n = Math.min(ints.length, PULSOS_TEMPO_INICIAL * NOTAS_POR_PULSO);
  if (n < 2) throw new Error("Muy pocos ataques para estimar el tempo");
  const tempoInicial = tempoDeIntervalos(ints.slice(0, n));
  const tempoFinal = tempoDeIntervalos(ints.slice(-n));
  const conReferenciaElegida = modo.metronomo === "con" && modo.tempoElegido !== null;
  const tempoReferencia = conReferenciaElegida ? modo.tempoElegido! : tempoInicial;
  const cambio = (tempoFinal - tempoInicial) / tempoInicial;
  const estado =
    Math.abs(cambio) <= UMBRAL_CAMBIO_TEMPO ? "estable" : cambio > 0 ? "aceleraste" : "frenaste";

  // Tropiezo: la nota se aparta del punto medio entre sus vecinas más que PRM-10 del intervalo.
  const tropiezos: number[] = [];
  for (let i = 1; i < ataques.length - 1; i++) {
    const intervaloLocal = (ataques[i + 1]! - ataques[i - 1]!) / 2;
    const esperado = (ataques[i - 1]! + ataques[i + 1]!) / 2;
    if (Math.abs(ataques[i]! - esperado) > UMBRAL_TROPIEZO * intervaloLocal) tropiezos.push(i);
  }

  return {
    referencia: conReferenciaElegida ? "tempo_elegido" : "tempo_inicial",
    tempoReferencia,
    tempoInicial,
    tempoFinal,
    cambioPct: cambio * 100,
    estado,
    tropiezos,
  };
}

/** PA-HU10-05: un tempo medido fuera del rango de la tarea se informa y no cuenta. */
export function tempoEnRango(tempoMedido: number, min: number, max: number) {
  const redondeado = Math.round(tempoMedido);
  const dentro = redondeado >= min && redondeado <= max;
  return {
    cuenta: dentro,
    mensaje: dentro ? null : `Tocaste a ♩≈${redondeado}; tu tarea pide ${min}–${max}`,
  };
}

/**
 * Dedo–tecla y digitación por evento (versión simple).
 * La señal de entrada es la "altura" de cada punta respecto del teclado en cada fotograma: un
 * descenso marcado seguido de un mínimo se toma como una pulsación. Cómo se estima esa altura con
 * la vista de referencia (profundidad relativa del detector u otra) lo decide S1.
 */
import type { Dedo } from "./rasgos.ts";
import type { IdMano } from "./manos.ts";
import { teclaBajo, type ModeloTeclado } from "../geometria/teclado.ts";

export interface MuestraAltura {
  t: number;
  /** Altura por dedo; null si ese dedo no es visible en el fotograma. */
  alturas: Partial<Record<Dedo, number | null>>;
}

export interface Descenso {
  dedo: Dedo;
  t: number;
  profundidad: number;
}

/** PROPUESTA provisional: caída mínima (en unidades de la señal) para contar una pulsación. */
export const DESCENSO_MINIMO = 0.05;

/** Mínimos locales precedidos por una caída ≥ `minimo` desde el último máximo, por dedo. */
export function detectarDescensos(
  serie: readonly MuestraAltura[],
  dedos: readonly Dedo[],
  minimo = DESCENSO_MINIMO,
): Descenso[] {
  const descensos: Descenso[] = [];
  for (const dedo of dedos) {
    let maximo = Number.NEGATIVE_INFINITY;
    let candidato: { t: number; altura: number } | null = null;
    for (const muestra of serie) {
      const altura = muestra.alturas[dedo];
      if (altura === null || altura === undefined) continue;
      if (candidato && altura > candidato.altura) {
        if (maximo - candidato.altura >= minimo) {
          descensos.push({ dedo, t: candidato.t, profundidad: maximo - candidato.altura });
        }
        candidato = null;
        maximo = altura;
        continue;
      }
      if (altura >= maximo && !candidato) {
        maximo = altura;
      } else if (!candidato || altura < candidato.altura) {
        candidato = { t: muestra.t, altura };
      }
    }
    if (candidato && maximo - candidato.altura >= minimo) {
      descensos.push({ dedo, t: candidato.t, profundidad: maximo - candidato.altura });
    }
  }
  return descensos.sort((a, b) => a.t - b.t);
}

export interface EventoVisual {
  mano: IdMano;
  dedo: Dedo;
  t: number;
  /** Tecla bajo la punta en el instante del descenso; null si no cae sobre una tecla. */
  midi: number | null;
  /** El dedo estaba oculto en parte de la ventana del evento (p. ej., paso del pulgar). */
  ocluido?: boolean;
}

export interface EventoEsperadoDigitacion {
  idx: number;
  mano: IdMano;
  dedo: number;
  midi: number;
}

export type EstadoDigitacion =
  | { idx: number; estado: "digitacion-correcta"; dedo: Dedo }
  | { idx: number; estado: "dedo-incorrecto"; dedo: Dedo; esperado: number }
  | { idx: number; estado: "no-evaluable"; motivo: "sin-evento-visual" | "dedo-oculto" };

const NUMERO_DEDO: Record<Dedo, number> = { pulgar: 1, indice: 2, medio: 3, anular: 4, menique: 5 };

/**
 * Empareja en orden, por mano, cada evento esperado con el siguiente evento visual de la misma
 * mano sobre la misma tecla. Un evento visual se usa una sola vez.
 */
export function compararDigitacion(
  esperados: readonly EventoEsperadoDigitacion[],
  visuales: readonly EventoVisual[],
): EstadoDigitacion[] {
  const usados = new Set<number>();
  const cursor: Record<IdMano, number> = { MI: 0, MD: 0 };
  const ordenados = visuales.map((v, i) => ({ v, i })).sort((a, b) => a.v.t - b.v.t);
  return esperados.map((e) => {
    const encontrado = ordenados.find(
      ({ v, i }, pos) =>
        pos >= cursor[e.mano] && !usados.has(i) && v.mano === e.mano && v.midi === e.midi,
    );
    if (!encontrado) return { idx: e.idx, estado: "no-evaluable", motivo: "sin-evento-visual" };
    usados.add(encontrado.i);
    cursor[e.mano] = ordenados.indexOf(encontrado) + 1;
    const { v } = encontrado;
    if (v.ocluido) return { idx: e.idx, estado: "no-evaluable", motivo: "dedo-oculto" };
    return NUMERO_DEDO[v.dedo] === e.dedo
      ? { idx: e.idx, estado: "digitacion-correcta", dedo: v.dedo }
      : { idx: e.idx, estado: "dedo-incorrecto", dedo: v.dedo, esperado: e.dedo };
  });
}

/** PRM-16: el intento es evaluable si al menos el 70 % de los eventos esperados lo son. */
export const MINIMO_EVALUABLE = 0.7;

export function intentoEvaluable(estados: readonly EstadoDigitacion[]): boolean {
  if (estados.length === 0) return false;
  const evaluables = estados.filter((e) => e.estado !== "no-evaluable").length;
  return evaluables / estados.length >= MINIMO_EVALUABLE;
}

/**
 * Descensos de una mano → eventos visuales: la tecla es la que está bajo la punta del dedo en el
 * instante del descenso. `puntaEnTeclado` da la punta en el plano del teclado (o null si no se ve).
 */
export function eventosVisuales(
  mano: IdMano,
  descensos: readonly Descenso[],
  puntaEnTeclado: (dedo: Dedo, t: number) => { x: number; y: number } | null,
  modelo: ModeloTeclado,
): EventoVisual[] {
  return descensos.map(({ dedo, t }) => {
    const punta = puntaEnTeclado(dedo, t);
    const tecla = punta ? teclaBajo(modelo, punta) : null;
    return { mano, dedo, t, midi: tecla?.midi ?? null, ocluido: punta === null };
  });
}

import { secuenciaEscala, type NotaEsperada } from "./escala.ts";

/** Evento de la partitura importada (eventos_esperados de la versión del ejercicio). */
export interface EventoPartitura {
  mano: "MI" | "MD";
  dedo: number;
  midi: number;
  clase_altura: number;
  tiempo_beats: number;
}

/** De dónde salen las notas esperadas: la partitura importada o la escala provisional. */
export type SecuenciaEsperada = "partitura" | "provisional";

/**
 * Notas que se esperan en el intento. Si la versión del ejercicio tiene la partitura importada,
 * se toman de ella, con mano y dedo; si no, se usa la escala provisional, sin digitación.
 */
export function notasEsperadas(
  eventos: readonly EventoPartitura[],
  tonalidad: string,
  manos: "MI" | "MD" | "juntas",
): { esperadas: NotaEsperada[]; secuencia: SecuenciaEsperada } {
  if (eventos.length === 0) {
    return { esperadas: secuenciaEscala(tonalidad, manos), secuencia: "provisional" };
  }
  const esperadas = eventos
    .filter((e) => manos === "juntas" || e.mano === manos)
    .map((e, idx) => ({
      idx,
      mano: e.mano,
      midi: e.midi,
      claseAltura: e.clase_altura,
      tiempoBeats: e.tiempo_beats,
      dedo: e.dedo,
    }));
  return { esperadas, secuencia: "partitura" };
}

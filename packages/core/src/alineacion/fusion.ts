import type { EventoVisual } from "../rasgos/dedos.ts";

/**
 * Fusión por ataque (versión simple): a cada ataque de audio se le atribuye el evento visual más
 * cercano en el tiempo dentro de la ventana. Cada evento visual se usa una sola vez. La modalidad
 * dice de dónde sale cada dato: "VA" con audio y visión, "A" solo audio.
 */

/** PROPUESTA provisional: media ventana de búsqueda (s); el desfase real se mide en S3. */
export const VENTANA_FUSION = 0.08;

export interface AtaqueFusionado {
  t: number;
  modalidad: "VA" | "A";
  mano: EventoVisual["mano"] | null;
  dedo: EventoVisual["dedo"] | null;
  midi: number | null;
  /** Diferencia visión − audio (s), si hubo emparejamiento. */
  desfase: number | null;
}

export function fusionar(
  ataques: readonly number[],
  visuales: readonly EventoVisual[],
  ventana = VENTANA_FUSION,
): AtaqueFusionado[] {
  const usados = new Set<number>();
  return ataques.map((t) => {
    let mejor = -1;
    let menor = Number.POSITIVE_INFINITY;
    visuales.forEach((v, i) => {
      const d = Math.abs(v.t - t);
      // Tolerancia numérica: 1,08 − 1,00 no da exactamente 0,08 en punto flotante.
      if (!usados.has(i) && d <= ventana + 1e-9 && d < menor) {
        menor = d;
        mejor = i;
      }
    });
    if (mejor < 0) return { t, modalidad: "A", mano: null, dedo: null, midi: null, desfase: null };
    usados.add(mejor);
    const v = visuales[mejor]!;
    return { t, modalidad: "VA", mano: v.mano, dedo: v.dedo, midi: v.midi, desfase: v.t - t };
  });
}

import { SeguidorManos, type Asignacion, type IdMano } from "@skilltrack/core";
import type { PuntoNormalizado } from "./detector.ts";

export type ManoVista = PuntoNormalizado[];

/**
 * Identidad de cada mano en la imagen, con el seguidor del núcleo. Con la vista de referencia
 * (cámara detrás del pianista) la izquierda de la imagen es la mano izquierda; con la cámara
 * frontal la imagen está en espejo y se invierte x antes de asignar.
 */
export function crearAsignador(frontal: () => boolean) {
  const seguidor = new SeguidorManos<ManoVista>(0.5);
  return (manos: readonly ManoVista[]): Asignacion<ManoVista> =>
    seguidor.asignar(
      manos.map((m) => {
        const muneca = m[0]!;
        return { muneca: { x: frontal() ? 1 - muneca.x : muneca.x, y: muneca.y }, datos: m };
      }),
    );
}

export const NOMBRE_MANO: Record<IdMano, string> = { MI: "Izquierda", MD: "Derecha" };

/** Fotogramas por segundo con media móvil exponencial. */
export function crearContadorFps(alfa = 0.1) {
  let anterior: number | null = null;
  let fps = 0;
  return (tMs: number): number => {
    if (anterior !== null && tMs > anterior) {
      const instantaneo = 1000 / (tMs - anterior);
      fps = fps === 0 ? instantaneo : fps + alfa * (instantaneo - fps);
    }
    anterior = tMs;
    return fps;
  };
}

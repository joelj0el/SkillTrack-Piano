import type { IdMano } from "@skilltrack/core";
import type { PuntoNormalizado } from "./detector.ts";

export type ManoVista = PuntoNormalizado[];

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

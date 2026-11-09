import type { EventoVisual } from "../rasgos/dedos.ts";
import type { NotaEsperada } from "./escala.ts";

/**
 * Resultado visual por nota esperada (versión simple): se recorre cada mano en orden y cada nota
 * se empareja con el siguiente evento visual de esa mano sobre la misma tecla. Sin la partitura
 * transcrita no hay digitación esperada: el dedo detectado se informa, pero no se califica.
 */
export type EstadoNotaVisual =
  | { estado: "detectada"; dedo: EventoVisual["dedo"]; t: number }
  | { estado: "no-evaluable"; motivo: "sin evento visual" | "dedo oculto" };

export interface ResultadoNotaVisual {
  idx: number;
  mano: "MI" | "MD";
  midiEsperado: number;
  resultado: EstadoNotaVisual;
}

export function resultadoVisual(
  esperadas: readonly NotaEsperada[],
  visuales: readonly EventoVisual[],
): ResultadoNotaVisual[] {
  const ordenados = [...visuales].sort((a, b) => a.t - b.t);
  const cursor: Record<"MI" | "MD", number> = { MI: 0, MD: 0 };
  return esperadas.map((n) => {
    const desde = cursor[n.mano];
    const pos = ordenados.findIndex((v, i) => i >= desde && v.mano === n.mano && v.midi === n.midi);
    if (pos < 0) {
      return {
        idx: n.idx,
        mano: n.mano,
        midiEsperado: n.midi,
        resultado: { estado: "no-evaluable", motivo: "sin evento visual" },
      };
    }
    cursor[n.mano] = pos + 1;
    const v = ordenados[pos]!;
    return {
      idx: n.idx,
      mano: n.mano,
      midiEsperado: n.midi,
      resultado: v.ocluido
        ? { estado: "no-evaluable", motivo: "dedo oculto" }
        : { estado: "detectada", dedo: v.dedo, t: v.t },
    };
  });
}

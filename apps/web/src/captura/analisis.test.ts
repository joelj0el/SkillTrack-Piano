import { homografia, secuenciaEscala } from "@skilltrack/core";
import { describe, expect, it } from "vitest";
import { analizar, type MuestraMano } from "./analisis.ts";

describe("análisis al terminar la ejecución", () => {
  it("PU-capture-12: un índice que baja sobre Re4 produce esa nota con el dedo detectado", () => {
    const esperadas = secuenciaEscala("Do mayor", "MD").slice(0, 2); // Do4, Re4
    // Plano del teclado = imagen (calibración identidad sobre el tramo Do4–Do6).
    const identidad = homografia(
      [
        { x: 0, y: 0 },
        { x: 15, y: 0 },
        { x: 0, y: 1 },
        { x: 15, y: 1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 15, y: 0 },
        { x: 0, y: 1 },
        { x: 15, y: 1 },
      ],
    );
    const serie: MuestraMano[] = [1, 0.9, 0.8, 0.9, 1].map((altura, i) => ({
      t: i / 10,
      alturas: { indice: altura },
      puntas: { indice: { x: 1.5, y: 0.5 } }, // segunda blanca del tramo: Re4
    }));

    const r = analizar(
      { series: { MD: serie }, calibracion: identidad, rango: { min: 60, max: 84 }, esperadas },
      () => 0,
    );

    expect(r.notas[1]!.resultado).toEqual({ estado: "detectada", dedo: "indice", t: 0.2 });
    expect(r.notas[0]!.resultado.estado).toBe("no-evaluable");
  });
});

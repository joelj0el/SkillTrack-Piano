import { homografia, secuenciaEscala } from "@skilltrack/core";
import { secuencia } from "../../../../packages/core/src/audio/sintesis.ts";
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

describe("análisis con audio", () => {
  it("PU-capture-13: una escala sintética a 44,1 kHz se oye correcta, con tempo estable", () => {
    const esperadas = secuenciaEscala("Do mayor", "MD").slice(0, 8);
    const tasa = 44100;
    const senal = secuencia(
      esperadas.map((n, i) => ({ midi: n.midi, t: 0.3 + i * 0.25 })),
      2.6,
      tasa,
    );
    const r = analizar(
      {
        series: {},
        audio: { muestras: senal, tasa, t0: 4 },
        metronomo: "sin",
        tempoElegido: 60,
        calibracion: homografia(
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
          ],
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
          ],
        ),
        rango: { min: 60, max: 84 },
        esperadas,
      },
      () => 0,
    );
    const acustico = r.acustico!;
    expect(acustico.notas.esperadas.map((n) => n.estado)).toEqual(new Array(8).fill("correcta"));
    expect(acustico.ataques[0]).toBeCloseTo(4.3, 1);
    expect(acustico.tempo?.estado).toBe("estable");
    expect(acustico.tempo?.tempoInicial).toBeCloseTo(60, 0);
    // Sin eventos visuales, cada ataque queda solo con audio.
    expect(acustico.fusion.every((f) => f.modalidad === "A")).toBe(true);
  });
});

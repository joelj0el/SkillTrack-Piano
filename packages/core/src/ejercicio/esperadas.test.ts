import { describe, expect, it } from "vitest";
import { secuenciaEscala } from "./escala.ts";
import { notasEsperadas, type EventoPartitura } from "./esperadas.ts";

const partitura: EventoPartitura[] = [
  { mano: "MI", dedo: 5, midi: 48, clase_altura: 0, tiempo_beats: 0 },
  { mano: "MD", dedo: 1, midi: 60, clase_altura: 0, tiempo_beats: 0 },
  { mano: "MI", dedo: 4, midi: 50, clase_altura: 2, tiempo_beats: 0.25 },
  { mano: "MD", dedo: 2, midi: 62, clase_altura: 2, tiempo_beats: 0.25 },
];

describe("notas esperadas", () => {
  it("PU-esperadas-01: con partitura importada se usan sus eventos, con mano y dedo", () => {
    const { esperadas, secuencia } = notasEsperadas(partitura, "Do mayor", "juntas");
    expect(secuencia).toBe("partitura");
    expect(esperadas).toEqual([
      { idx: 0, mano: "MI", midi: 48, claseAltura: 0, tiempoBeats: 0, dedo: 5 },
      { idx: 1, mano: "MD", midi: 60, claseAltura: 0, tiempoBeats: 0, dedo: 1 },
      { idx: 2, mano: "MI", midi: 50, claseAltura: 2, tiempoBeats: 0.25, dedo: 4 },
      { idx: 3, mano: "MD", midi: 62, claseAltura: 2, tiempoBeats: 0.25, dedo: 2 },
    ]);
  });

  it("PU-esperadas-02: con una sola mano quedan solo sus eventos, numerados desde 0", () => {
    const { esperadas } = notasEsperadas(partitura, "Do mayor", "MD");
    expect(esperadas.map((n) => [n.idx, n.mano, n.midi])).toEqual([
      [0, "MD", 60],
      [1, "MD", 62],
    ]);
  });

  it("PU-esperadas-03: sin partitura importada se usa la escala provisional, sin dedos", () => {
    const { esperadas, secuencia } = notasEsperadas([], "Fa mayor", "MI");
    expect(secuencia).toBe("provisional");
    expect(esperadas).toEqual(secuenciaEscala("Fa mayor", "MI"));
    expect(esperadas.every((n) => n.dedo === undefined)).toBe(true);
  });
});

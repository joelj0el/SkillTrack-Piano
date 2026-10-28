import { describe, expect, it } from "vitest";
import type { EventoVisual } from "../rasgos/dedos.ts";
import { fusionar } from "./fusion.ts";

const visual = (t: number, dedo: EventoVisual["dedo"], midi: number): EventoVisual => ({
  mano: "MD",
  dedo,
  t,
  midi,
});

describe("fusión de ataques con eventos visuales", () => {
  it("PU-align-01: cada ataque toma el dedo del evento visual más cercano dentro de la ventana", () => {
    const r = fusionar([1.0, 1.25], [visual(1.02, "pulgar", 60), visual(1.24, "indice", 62)]);
    expect(r.map((x) => [x.modalidad, x.dedo, x.midi])).toEqual([
      ["VA", "pulgar", 60],
      ["VA", "indice", 62],
    ]);
    expect(r[0]!.desfase).toBeCloseTo(0.02);
  });

  it("PU-align-02: frontera de la ventana: a 80 ms se empareja, a 81 ms queda solo audio", () => {
    expect(fusionar([1.0], [visual(1.08, "medio", 64)])[0]!.modalidad).toBe("VA");
    expect(fusionar([1.0], [visual(1.081, "medio", 64)])[0]).toMatchObject({
      modalidad: "A",
      dedo: null,
    });
  });

  it("PU-align-03: un evento visual no se atribuye a dos ataques", () => {
    const r = fusionar([1.0, 1.05], [visual(1.03, "anular", 65)]);
    expect(r.map((x) => x.modalidad)).toEqual(["VA", "A"]);
  });
});

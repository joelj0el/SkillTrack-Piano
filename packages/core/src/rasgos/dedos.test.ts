import { describe, expect, it } from "vitest";
import { modeloTeclado } from "../geometria/teclado.ts";
import {
  compararDigitacion,
  eventosVisuales,
  detectarDescensos,
  intentoEvaluable,
  type EventoEsperadoDigitacion,
  type EventoVisual,
  type MuestraAltura,
} from "./dedos.ts";

/** Serie sintética: el índice baja de 1,0 a 0,8 en t = 0,2 s y vuelve a subir. */
function serie(alturas: number[], dedo: "indice" | "medio" = "indice"): MuestraAltura[] {
  return alturas.map((a, i) => ({ t: i / 10, alturas: { [dedo]: a } }));
}

describe("descenso de cada dedo", () => {
  it("PU-features-11: una caída seguida de una subida es una pulsación en el mínimo", () => {
    const d = detectarDescensos(serie([1, 0.9, 0.8, 0.9, 1]), ["indice"]);
    expect(d).toHaveLength(1);
    expect(d[0]!.t).toBeCloseTo(0.2);
    expect(d[0]!.profundidad).toBeCloseTo(0.2);
  });

  it("PU-features-12: frontera de la caída mínima (justo por debajo no cuenta)", () => {
    expect(detectarDescensos(serie([1, 0.95, 1]), ["indice"], 0.05)).toHaveLength(1);
    expect(detectarDescensos(serie([1, 0.951, 1]), ["indice"], 0.05)).toHaveLength(0);
  });

  it("PU-features-13: dos pulsaciones del mismo dedo y fotogramas sin dato", () => {
    const muestras = serie([1, 0.8, 1, 0.8, 1]);
    muestras.splice(2, 0, { t: 0.15, alturas: { indice: null } });
    expect(detectarDescensos(muestras, ["indice"]).map((d) => d.t)).toEqual([0.1, 0.3]);
  });
});

describe("digitación por evento", () => {
  const esperados: EventoEsperadoDigitacion[] = [
    { idx: 0, mano: "MD", dedo: 1, midi: 60 },
    { idx: 1, mano: "MD", dedo: 2, midi: 62 },
    { idx: 2, mano: "MD", dedo: 3, midi: 64 },
  ];
  const visual = (t: number, dedo: EventoVisual["dedo"], midi: number, extra = {}) =>
    ({ mano: "MD", dedo, t, midi, ...extra }) as EventoVisual;

  it("PU-features-14: dedo correcto, dedo incorrecto y nota sin evento visual", () => {
    const r = compararDigitacion(esperados, [visual(0.1, "pulgar", 60), visual(0.3, "medio", 62)]);
    expect(r).toEqual([
      { idx: 0, estado: "digitacion-correcta", dedo: "pulgar" },
      { idx: 1, estado: "dedo-incorrecto", dedo: "medio", esperado: 2 },
      { idx: 2, estado: "no-evaluable", motivo: "sin-evento-visual" },
    ]);
  });

  it("PU-features-15: el pulgar oculto deja ese evento como no evaluable, solo ese", () => {
    const r = compararDigitacion(esperados, [
      visual(0.1, "pulgar", 60, { ocluido: true }),
      visual(0.2, "indice", 62),
      visual(0.3, "medio", 64),
    ]);
    expect(r.map((x) => x.estado)).toEqual([
      "no-evaluable",
      "digitacion-correcta",
      "digitacion-correcta",
    ]);
  });

  it("PU-features-16: los eventos de la otra mano no se emparejan", () => {
    const r = compararDigitacion(esperados.slice(0, 1), [
      { mano: "MI", dedo: "pulgar", t: 0.1, midi: 60 },
    ]);
    expect(r[0]!.estado).toBe("no-evaluable");
  });

  it("PU-features-17: el intento es evaluable con 70 % de eventos evaluables (PRM-16)", () => {
    const evaluable = { idx: 0, estado: "digitacion-correcta", dedo: "indice" } as const;
    const no = { idx: 0, estado: "no-evaluable", motivo: "dedo-oculto" } as const;
    expect(intentoEvaluable([...Array(7).fill(evaluable), ...Array(3).fill(no)])).toBe(true);
    expect(intentoEvaluable([...Array(69).fill(evaluable), ...Array(31).fill(no)])).toBe(false);
    expect(intentoEvaluable([])).toBe(false);
  });
});

describe("eventos visuales", () => {
  it("PU-features-18: cada descenso toma la tecla bajo la punta en ese instante", () => {
    const modelo = modeloTeclado(60, 72);
    const punta = (dedo: string) => (dedo === "indice" ? { x: 1.5, y: 0.5 } : null);
    const eventos = eventosVisuales(
      "MD",
      [
        { dedo: "indice", t: 0.2, profundidad: 0.1 },
        { dedo: "pulgar", t: 0.4, profundidad: 0.1 },
      ],
      punta,
      modelo,
    );
    expect(eventos).toEqual([
      { mano: "MD", dedo: "indice", t: 0.2, midi: 62, ocluido: false },
      { mano: "MD", dedo: "pulgar", t: 0.4, midi: null, ocluido: true },
    ]);
  });
});

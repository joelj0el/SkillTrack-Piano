import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { DEDOS, flexion, rasgosDeLaMano, type Mano, type Punto3 } from "./rasgos.ts";

// Mano plantilla (muñeca abajo, dedos hacia arriba) con puntos separados al menos 0,1.
const PLANTILLA: Punto3[] = [
  { x: 0, y: 0, z: 0 },
  ...[-0.4, -0.15, 0.05, 0.25, 0.45].flatMap((x) =>
    [0.5, 0.9, 1.2, 1.45].map((y) => ({ x, y: y - (x < -0.3 ? 0.3 : 0), z: 0 })),
  ),
];
// Perturbaciones de ±0,04: la mano cambia de forma sin que dos puntos coincidan.
const mano = fc
  .array(
    fc.record({
      x: fc.integer({ min: -40, max: 40 }),
      y: fc.integer({ min: -40, max: 40 }),
      z: fc.integer({ min: -40, max: 40 }),
    }),
    { minLength: 21, maxLength: 21 },
  )
  .map((ds) =>
    PLANTILLA.map((p, i) => ({
      x: p.x + ds[i]!.x / 1000,
      y: p.y + ds[i]!.y / 1000,
      z: p.z + ds[i]!.z / 1000,
    })),
  );

function rotar(p: Punto3, a: number, b: number): Punto3 {
  // Rotación alrededor de z y luego de x.
  const x1 = p.x * Math.cos(a) - p.y * Math.sin(a);
  const y1 = p.x * Math.sin(a) + p.y * Math.cos(a);
  return {
    x: x1,
    y: y1 * Math.cos(b) - p.z * Math.sin(b),
    z: y1 * Math.sin(b) + p.z * Math.cos(b),
  };
}

function plano(...valores: number[]): number[] {
  return valores;
}

function vector(m: Mano): number[] {
  const r = rasgosDeLaMano(m);
  return plano(
    ...DEDOS.flatMap((d) => [r.flexion[d].mcp, r.flexion[d].pip, r.flexion[d].dip]),
    ...Object.values(r.apertura),
  );
}

describe("rasgos de la mano", () => {
  it("PU-features-05: flexión 0° con el dedo recto y 90° en ángulo recto", () => {
    const a = { x: 0, y: 0, z: 0 };
    expect(flexion(a, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 })).toBeCloseTo(0);
    expect(flexion(a, { x: 1, y: 0, z: 0 }, { x: 1, y: 1, z: 0 })).toBeCloseTo(90);
  });

  it("PU-features-06: sin 21 puntos no hay rasgos", () => {
    expect(() => rasgosDeLaMano([])).toThrow(/21 puntos/);
  });

  it("PP-features-01: los rasgos no cambian con la escala, la traslación ni la rotación", () => {
    fc.assert(
      fc.property(
        mano,
        fc.double({ min: 0.1, max: 10, noNaN: true }),
        fc.record({
          x: fc.double({ min: -5, max: 5, noNaN: true }),
          y: fc.double({ min: -5, max: 5, noNaN: true }),
          z: fc.double({ min: -5, max: 5, noNaN: true }),
        }),
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
        fc.double({ min: 0, max: 2 * Math.PI, noNaN: true }),
        (m, escala, t, a, b) => {
          const transformada = m.map((p) => {
            const r = rotar(p, a, b);
            return { x: r.x * escala + t.x, y: r.y * escala + t.y, z: r.z * escala + t.z };
          });
          const antes = vector(m);
          const despues = vector(transformada);
          antes.forEach((v, i) => expect(Math.abs(v - despues[i]!)).toBeLessThan(1e-6));
        },
      ),
      { numRuns: 1000 },
    );
  });
});

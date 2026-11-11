import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Observacion } from "./bandas.ts";
import { aplicarRetencion, dispersionEntreDocentes } from "./retencion.ts";

// Datos SINTÉTICOS. Cada docente toca 2 veces; la unidad es el evento.
function tomas(rasgo: string, porDocente: Record<string, number[]>, unidad = "e0"): Observacion[] {
  return Object.entries(porDocente).flatMap(([docente, valores]) =>
    valores.map((valor, k) => ({
      docente,
      ejecucion: `${docente}-${k}`,
      unidad,
      rasgo,
      valor,
    })),
  );
}

describe("regla de retención (DM-12b)", () => {
  it("PU-bandas-07: la dispersión entre docentes es el rango intercuartil de sus medianas", () => {
    // Medianas por docente: 1, 2, 3 → P25 = 1,25 y P75 = 2,75 (interpolación en los centros de masa).
    const obs = tomas("r", { D1: [0, 2], D2: [2, 2], D3: [3, 3] });
    expect(dispersionEntreDocentes(obs, "r")).toBeCloseTo(1.5);
  });

  it("PU-bandas-08: el rasgo ruidoso se descarta con su motivo y el estable se retiene", () => {
    const obs = [
      ...tomas("ruidoso", { D1: [0, 1], D2: [20, 21], D3: [40, 41] }),
      ...tomas("estable", { D1: [10, 11], D2: [10, 12], D3: [11, 11] }),
    ];
    const r = aplicarRetencion(
      obs,
      {
        ruidoso: { diferencia_buscada: 5 },
        estable: { diferencia_buscada: 5 },
      },
      1,
    );
    expect(r.retenidos).toEqual(["estable"]);
    expect(r.descartados).toHaveLength(1);
    expect(r.descartados[0]).toMatchObject({
      rasgo: "ruidoso",
      diferencia_buscada: 5,
      factor: 1,
    });
    expect(r.descartados[0]!.dispersion).toBeGreaterThanOrEqual(5);
    expect(r.descartados[0]!.motivo).toMatch(/comparable a la diferencia buscada/);
  });

  it("PU-bandas-09: frontera: dispersión igual a factor × diferencia se descarta; apenas menor, no", () => {
    // 2 docentes con medianas 0 y 4: dispersión 4.
    const obs = tomas("r", { D1: [0, 0], D2: [4, 4] });
    expect(dispersionEntreDocentes(obs, "r")).toBeCloseTo(4);
    expect(aplicarRetencion(obs, { r: { diferencia_buscada: 8 } }, 0.5).retenidos).toEqual([]);
    expect(aplicarRetencion(obs, { r: { diferencia_buscada: 8.01 } }, 0.5).retenidos).toEqual([
      "r",
    ]);
  });

  it("PU-bandas-10: sin diferencia buscada documentada no se evalúa la retención y se informa", () => {
    const obs = [...tomas("a", { D1: [0], D2: [9] }), ...tomas("b", { D1: [0], D2: [9] })];
    const r = aplicarRetencion(obs, { a: { diferencia_buscada: null } }, 1);
    expect(r.retenidos).toEqual([]);
    expect(r.descartados).toEqual([]);
    expect(r.sin_evaluar.map((s) => s.rasgo)).toEqual(["a", "b"]);
    expect(r.sin_evaluar[0]!.motivo).toMatch(/PENDIENTE/);
  });

  it("PU-bandas-11: con un solo docente no se puede medir la dispersión y se informa", () => {
    const r = aplicarRetencion(tomas("a", { D1: [0, 1] }), { a: { diferencia_buscada: 1 } }, 1);
    expect(r.sin_evaluar).toEqual([
      expect.objectContaining({
        rasgo: "a",
        motivo: expect.stringMatching(/un solo docente/),
      }),
    ]);
  });

  it("PU-bandas-12: la dispersión de un rasgo es la mediana de la de sus unidades", () => {
    const obs = [
      ...tomas("r", { D1: [0], D2: [1] }, "e0"),
      ...tomas("r", { D1: [0], D2: [2] }, "e1"),
      ...tomas("r", { D1: [0], D2: [9] }, "e2"),
    ];
    expect(dispersionEntreDocentes(obs, "r")).toBeCloseTo(2);
  });

  it("PP-bandas-04: la retención no depende del orden de entrada", () => {
    const obs = fc.array(
      fc.record({
        docente: fc.constantFrom("D1", "D2", "D3"),
        ejecucion: fc.constantFrom("a", "b"),
        unidad: fc.constantFrom("e0", "e1"),
        rasgo: fc.constantFrom("x", "y"),
        valor: fc.double({ min: -100, max: 100, noNaN: true }),
      }),
      { minLength: 1, maxLength: 30 },
    );
    fc.assert(
      fc.property(obs, fc.double({ min: 0, max: 50, noNaN: true }), (lista, dif) => {
        const p = {
          x: { diferencia_buscada: dif },
          y: { diferencia_buscada: dif },
        };
        expect(aplicarRetencion([...lista].reverse(), p, 1)).toEqual(aplicarRetencion(lista, p, 1));
      }),
      { numRuns: 1000 },
    );
  });
});

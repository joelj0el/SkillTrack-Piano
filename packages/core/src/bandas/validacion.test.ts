import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Observacion } from "./bandas.ts";
import { validarDejandoUnDocenteFuera } from "./validacion.ts";

// Datos SINTÉTICOS.
const P10_P90 = { inferior: 10, superior: 90 };

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

describe("V2: validación dejando un docente fuera", () => {
  it("PU-bandas-13: el docente que toca como los demás cae dentro; el que se aparta, fuera", () => {
    const obs = tomas("r", {
      D1: [10, 11],
      D2: [9, 12],
      D3: [10, 11],
      D4: [50, 51],
    });
    const v = validarDejandoUnDocenteFuera(obs, P10_P90, ["r"]);
    const de = (d: string) => v.find((x) => x.docente === d)!.por_rasgo[0]!;
    expect(de("D1")).toEqual({
      rasgo: "r",
      dentro: 2,
      total: 2,
      porcentaje: 100,
    });
    expect(de("D4")).toEqual({
      rasgo: "r",
      dentro: 0,
      total: 2,
      porcentaje: 0,
    });
  });

  it("PU-bandas-14: una unidad que solo tocó el docente excluido no se cuenta", () => {
    const obs = [...tomas("r", { D1: [1], D2: [1] }, "e0"), ...tomas("r", { D1: [7] }, "e1")];
    const d1 = validarDejandoUnDocenteFuera(obs, P10_P90, ["r"]).find((x) => x.docente === "D1")!;
    expect(d1.por_rasgo).toEqual([{ rasgo: "r", dentro: 1, total: 1, porcentaje: 100 }]);
  });

  it("PU-bandas-15: solo se validan los rasgos pedidos (los retenidos); sin datos, porcentaje null", () => {
    const obs = [...tomas("r", { D1: [1], D2: [1] }), ...tomas("s", { D1: [1], D2: [1] })];
    const v = validarDejandoUnDocenteFuera(obs, P10_P90, ["s", "t"]);
    expect(v.map((x) => x.docente)).toEqual(["D1", "D2"]);
    expect(v[0]!.por_rasgo).toEqual([
      { rasgo: "s", dentro: 1, total: 1, porcentaje: 100 },
      { rasgo: "t", dentro: 0, total: 0, porcentaje: null },
    ]);
  });

  it("PP-bandas-05: la validación no depende del orden de entrada", () => {
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
      fc.property(obs, (lista) => {
        expect(validarDejandoUnDocenteFuera([...lista].reverse(), P10_P90, ["x", "y"])).toEqual(
          validarDejandoUnDocenteFuera(lista, P10_P90, ["x", "y"]),
        );
      }),
      { numRuns: 1000 },
    );
  });
});

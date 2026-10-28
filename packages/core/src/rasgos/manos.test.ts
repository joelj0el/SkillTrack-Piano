import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SeguidorManos, manosDeLaTarea, type ManoDetectada } from "./manos.ts";

const en = (x: number, y = 0, datos = "") => ({ muneca: { x, y }, datos }) as ManoDetectada<string>;

describe("identidad de las manos", () => {
  it("PU-features-07: sin historia, la mano de la izquierda del teclado es la MI", () => {
    const s = new SeguidorManos<string>(7);
    const r = s.asignar([en(10, 0, "b"), en(3, 0, "a")]);
    expect(r.MI?.datos).toBe("a");
    expect(r.MD?.datos).toBe("b");
  });

  it("PU-features-08: el orden del detector cambia en cada fotograma y no hay intercambios", () => {
    const s = new SeguidorManos<string>(7);
    for (let t = 0; t < 60; t++) {
      // Las manos se acercan hasta casi tocarse; el detector las entrega en orden alterno.
      const izquierda = en(3 + t * 0.05, 0, "izquierda");
      const derecha = en(11 - t * 0.05, 0, "derecha");
      const r = s.asignar(t % 2 === 0 ? [izquierda, derecha] : [derecha, izquierda]);
      expect(r.MI?.datos).toBe("izquierda");
      expect(r.MD?.datos).toBe("derecha");
    }
  });

  it("PU-features-09: si se pierde una mano, la que queda conserva su identidad", () => {
    const s = new SeguidorManos<string>(7);
    s.asignar([en(3, 0, "i"), en(11, 0, "d")]);
    expect(s.asignar([en(10.8, 0, "d")]).MD?.datos).toBe("d");
    expect(s.asignar([en(3.2, 0, "i")]).MI?.datos).toBe("i");
  });

  it("PU-features-10: en una tarea de una sola mano la otra se descarta (PA-HU12-03)", () => {
    const asignacion = { MI: en(3), MD: en(11) };
    expect(Object.keys(manosDeLaTarea(asignacion, "MD"))).toEqual(["MD"]);
    expect(Object.keys(manosDeLaTarea(asignacion, "juntas")).sort()).toEqual(["MD", "MI"]);
    expect(manosDeLaTarea({ MI: en(3) }, "MD")).toEqual({});
  });

  it("PP-features-02: el orden en que llegan las detecciones no cambia la asignación", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            i: fc.double({ min: 0, max: 6, noNaN: true }),
            d: fc.double({ min: 8, max: 14, noNaN: true }),
            invertir: fc.boolean(),
          }),
          { minLength: 1, maxLength: 40 },
        ),
        (fotogramas) => {
          const s = new SeguidorManos<string>(7);
          for (const f of fotogramas) {
            const izquierda = en(f.i, 0, "izquierda");
            const derecha = en(f.d, 0, "derecha");
            const r = s.asignar(f.invertir ? [derecha, izquierda] : [izquierda, derecha]);
            expect(r.MI?.datos).toBe("izquierda");
            expect(r.MD?.datos).toBe("derecha");
          }
        },
      ),
      { numRuns: 1000 },
    );
  });
});

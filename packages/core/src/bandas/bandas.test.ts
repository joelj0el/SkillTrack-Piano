import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { construirBandas, percentilPonderado, type Observacion } from "./bandas.ts";

// Datos SINTÉTICOS: docentes, ejecuciones y valores inventados para las pruebas.
const P10_P90 = { inferior: 10, superior: 90 };

function obs(
  docente: string,
  ejecucion: string,
  valor: number,
  unidad = "e0",
  rasgo = "r",
): Observacion {
  return { docente, ejecucion, unidad, rasgo, valor };
}

describe("percentil ponderado", () => {
  it("PU-bandas-01: con pesos iguales es el percentil habitual por interpolación", () => {
    const iguales = [1, 2, 3, 4].map((valor) => ({ valor, peso: 1 }));
    expect(percentilPonderado(iguales, 50)).toBeCloseTo(2.5);
    expect(percentilPonderado(iguales, 0)).toBe(1);
    expect(percentilPonderado(iguales, 100)).toBe(4);
  });

  it("PU-bandas-02: un valor con el triple de peso arrastra la mediana hacia él", () => {
    const valores = [
      { valor: 0, peso: 3 },
      { valor: 10, peso: 1 },
    ];
    expect(percentilPonderado(valores, 50)).toBeLessThan(5);
  });
});

describe("bandas por consenso", () => {
  it("PU-bandas-03: cada docente pesa lo mismo aunque grabe más ejecuciones", () => {
    // D1 graba 4 veces cerca de 0; D2 graba 1 vez en 10. La mediana ponderada queda en el medio.
    const [banda] = construirBandas(
      [
        obs("D1", "a", 0),
        obs("D1", "b", 0),
        obs("D1", "c", 0),
        obs("D1", "d", 0),
        obs("D2", "e", 10),
      ],
      P10_P90,
    );
    expect(banda!.centro).toBeCloseTo(5);
    expect(banda!.n_docentes).toBe(2);
    expect(banda!.n_ejecuciones).toBe(5);
  });

  it("PU-bandas-04: una banda por unidad y rasgo, ordenadas", () => {
    const bandas = construirBandas(
      [obs("D1", "a", 1, "e1", "y"), obs("D1", "a", 2, "e0", "y"), obs("D1", "a", 3, "e0", "x")],
      P10_P90,
    );
    expect(bandas.map((b) => `${b.unidad}/${b.rasgo}`)).toEqual(["e0/x", "e0/y", "e1/y"]);
  });

  it("PU-bandas-05: la banda refleja la variación de una ejecución individual", () => {
    // Dos docentes con la misma mediana (5) y ejecuciones entre 0 y 10: la banda no colapsa a 5.
    const [banda] = construirBandas(
      [obs("D1", "a", 0), obs("D1", "b", 10), obs("D2", "c", 2), obs("D2", "d", 8)],
      P10_P90,
    );
    expect(banda!.centro).toBeCloseTo(5);
    expect(banda!.inferior).toBeLessThan(2);
    expect(banda!.superior).toBeGreaterThan(8);
  });

  it("PU-bandas-06: percentiles fuera de 0–100 o invertidos se rechazan", () => {
    expect(() => construirBandas([obs("D1", "a", 1)], { inferior: 90, superior: 10 })).toThrow();
    expect(() => construirBandas([obs("D1", "a", 1)], { inferior: -1, superior: 90 })).toThrow();
  });

  const observaciones = fc.array(
    fc.record({
      docente: fc.constantFrom("D1", "D2", "D3"),
      ejecucion: fc.constantFrom("a", "b", "c", "d"),
      unidad: fc.constantFrom("e0", "e1"),
      rasgo: fc.constantFrom("x", "y"),
      valor: fc.double({ min: -100, max: 100, noNaN: true }),
    }),
    { minLength: 1, maxLength: 40 },
  );

  it("PP-bandas-01: el resultado no depende del orden de entrada", () => {
    fc.assert(
      fc.property(observaciones, fc.integer(), (lista, semilla) => {
        const barajada = [...lista].sort(
          (a, b) =>
            ((lista.indexOf(a) * 7919 + semilla) % 97) - ((lista.indexOf(b) * 7919 + semilla) % 97),
        );
        expect(construirBandas(barajada, P10_P90)).toEqual(construirBandas(lista, P10_P90));
      }),
      { numRuns: 1000 },
    );
  });

  it("PP-bandas-02: la banda contiene el centro", () => {
    fc.assert(
      fc.property(observaciones, (lista) => {
        for (const b of construirBandas(lista, P10_P90)) {
          expect(b.inferior).toBeLessThanOrEqual(b.centro);
          expect(b.centro).toBeLessThanOrEqual(b.superior);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it("PP-bandas-03: repetir todas las ejecuciones de un docente no desplaza el resultado", () => {
    fc.assert(
      fc.property(observaciones, fc.integer({ min: 2, max: 5 }), (lista, veces) => {
        const repetidas = lista.flatMap((o) =>
          o.docente === "D1"
            ? Array.from({ length: veces }, (_, k) => ({ ...o, ejecucion: `${o.ejecucion}-${k}` }))
            : [o],
        );
        const quitarConteo = (b: ReturnType<typeof construirBandas>[number]) => ({
          ...b,
          n_ejecuciones: 0,
        });
        expect(construirBandas(repetidas, P10_P90).map(quitarConteo)).toEqual(
          construirBandas(lista, P10_P90).map(quitarConteo),
        );
      }),
      { numRuns: 1000 },
    );
  });
});

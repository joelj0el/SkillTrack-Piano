import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { aplicar, homografia, invertir, type Punto } from "./homografia.ts";

const CUADRADO: Punto[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];

function cerca(a: Punto, b: Punto, tolerancia = 1e-6) {
  expect(Math.abs(a.x - b.x)).toBeLessThan(tolerancia);
  expect(Math.abs(a.y - b.y)).toBeLessThan(tolerancia);
}

// Cuadriláteros convexos de imagen razonables: un rectángulo con las esquinas perturbadas.
const cuadrilatero = fc
  .record({
    x0: fc.double({ min: 0, max: 400, noNaN: true }),
    y0: fc.double({ min: 0, max: 400, noNaN: true }),
    ancho: fc.double({ min: 200, max: 1200, noNaN: true }),
    alto: fc.double({ min: 60, max: 400, noNaN: true }),
    ruido: fc.array(fc.double({ min: -20, max: 20, noNaN: true }), {
      minLength: 8,
      maxLength: 8,
    }),
  })
  .map(({ x0, y0, ancho, alto, ruido }) => {
    const r = (i: number) => ruido[i] ?? 0;
    return [
      { x: x0 + r(0), y: y0 + alto + r(1) },
      { x: x0 + ancho + r(2), y: y0 + alto + r(3) },
      { x: x0 + r(4), y: y0 + r(5) },
      { x: x0 + ancho + r(6), y: y0 + r(7) },
    ];
  });

describe("homografía por DLT", () => {
  it("PU-geometry-01: con 4 puntos iguales en origen y destino es la identidad", () => {
    const h = homografia(CUADRADO, CUADRADO);
    cerca(aplicar(h, { x: 0.3, y: 0.7 }), { x: 0.3, y: 0.7 });
  });

  it("PU-geometry-02: recupera una traslación y un escalado conocidos", () => {
    const destino = CUADRADO.map((p) => ({ x: 10 + 4 * p.x, y: 20 + 2 * p.y }));
    const h = homografia(CUADRADO, destino);
    cerca(aplicar(h, { x: 0.5, y: 0.5 }), { x: 12, y: 21 });
  });

  it("PU-geometry-03: con tres puntos alineados no hay homografía (error explícito)", () => {
    const alineados = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 0 },
    ];
    expect(() => homografia(alineados, CUADRADO)).toThrow(/degenerad/);
  });

  it("PU-geometry-13: funciona aunque la línea de fuga pase por el origen de la imagen", () => {
    // Contraejemplo encontrado por PP-geometry-01: las rectas del frente y de las negras
    // se cortan en x = 0, así que h33 = 0 en coordenadas crudas.
    const imagen = [
      { x: 400, y: 256 },
      { x: 600, y: 276 },
      { x: 400, y: 216 },
      { x: 600, y: 216 },
    ];
    const h = homografia(imagen, CUADRADO);
    imagen.forEach((p, i) => cerca(aplicar(h, p), CUADRADO[i] as Punto));
  });

  it("PP-geometry-01: la homografía lleva exactamente cada punto de origen a su destino", () => {
    fc.assert(
      fc.property(cuadrilatero, (imagen) => {
        const h = homografia(imagen, CUADRADO);
        imagen.forEach((p, i) => cerca(aplicar(h, p), CUADRADO[i] as Punto, 1e-6));
      }),
      { numRuns: 1000 },
    );
  });

  it("PP-geometry-02: aplicar la inversa devuelve el punto original", () => {
    fc.assert(
      fc.property(
        cuadrilatero,
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (imagen, u, v) => {
          const h = homografia(CUADRADO, imagen);
          const p = aplicar(h, { x: u, y: v });
          cerca(aplicar(invertir(h), p), { x: u, y: v }, 1e-6);
        },
      ),
      { numRuns: 1000 },
    );
  });
});

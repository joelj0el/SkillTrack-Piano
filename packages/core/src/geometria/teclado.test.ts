import { describe, expect, it } from "vitest";
import { aplicar, homografia } from "./homografia.ts";
import {
  calibracion,
  coberturaDelRango,
  esNegra,
  modeloTeclado,
  teclaBajo,
  type ModeloTeclado,
} from "./teclado.ts";

const DO4 = 60;
const SIb3 = 58;

describe("modelo del teclado", () => {
  it("PU-geometry-04: un tramo Do4–Do5 tiene 8 blancas y 5 negras en su lugar", () => {
    const modelo = modeloTeclado(DO4, DO4 + 12);

    expect(modelo.blancas).toBe(8);
    expect(modelo.teclas.filter((t) => !t.negra).map((t) => t.midi)).toEqual([
      60, 62, 64, 65, 67, 69, 71, 72,
    ]);
    expect(modelo.teclas.filter((t) => t.negra).map((t) => t.midi)).toEqual([61, 63, 66, 68, 70]);
    // Do#4 queda centrada sobre el borde entre Do4 y Re4.
    const doSostenido = modelo.teclas.find((t) => t.midi === 61)!;
    expect((doSostenido.x0 + doSostenido.x1) / 2).toBeCloseTo(1);
  });

  it("PU-geometry-05: si el rango empieza o termina en una negra se extiende a la blanca vecina", () => {
    const modelo = modeloTeclado(SIb3, 75); // Si♭3 a Mi♭5

    expect(modelo.primeraBlanca).toBe(57); // La3
    expect(modelo.ultimaBlanca).toBe(76); // Mi5
    expect(esNegra(SIb3)).toBe(true);
  });
});

describe("tecla bajo el dedo", () => {
  const modelo = modeloTeclado(DO4, DO4 + 12);

  it("PU-geometry-06: delante de la línea de las negras solo hay teclas blancas", () => {
    expect(teclaBajo(modelo, { x: 0.99, y: 0.9 })?.midi).toBe(60);
    expect(teclaBajo(modelo, { x: 1.01, y: 0.9 })?.midi).toBe(62);
  });

  it("PU-geometry-07: detrás de la línea, el borde entre dos blancas con negra es la negra", () => {
    expect(teclaBajo(modelo, { x: 1.0, y: 1.5 })?.midi).toBe(61);
    // Mi–Fa no tiene negra: sigue siendo blanca a ambos lados del borde.
    expect(teclaBajo(modelo, { x: 2.99, y: 1.5 })?.midi).toBe(64);
    expect(teclaBajo(modelo, { x: 3.01, y: 1.5 })?.midi).toBe(65);
  });

  it("PU-geometry-08: frontera de la negra: dentro de su ancho es negra, fuera es blanca", () => {
    const negra = modelo.teclas.find((t) => t.midi === 61)!;
    expect(teclaBajo(modelo, { x: negra.x0 + 1e-6, y: 1.2 })?.midi).toBe(61);
    expect(teclaBajo(modelo, { x: negra.x0 - 1e-6, y: 1.2 })?.midi).toBe(60);
    expect(teclaBajo(modelo, { x: negra.x1 + 1e-6, y: 1.2 })?.midi).toBe(62);
  });

  it("PU-geometry-09: fuera del tramo calibrado no hay tecla", () => {
    expect(teclaBajo(modelo, { x: -0.01, y: 0.5 })).toBeNull();
    expect(teclaBajo(modelo, { x: 8.01, y: 0.5 })).toBeNull();
    expect(teclaBajo(modelo, { x: 2, y: -0.1 })).toBeNull();
  });

  it("PU-geometry-10: la tecla informa la posición a lo largo (para el lugar del dedo en la tecla)", () => {
    expect(teclaBajo(modelo, { x: 0.5, y: 0.25 })?.aLoLargo).toBeCloseTo(0.25);
  });
});

describe("calibración y cobertura del rango", () => {
  it("PU-geometry-11: los 4 toques llevan la imagen al plano del teclado", () => {
    const modelo: ModeloTeclado = modeloTeclado(DO4, DO4 + 12);
    // Teclado visto en perspectiva: el frente más ancho que la línea de las negras.
    const toques = {
      frenteIzquierda: { x: 100, y: 500 },
      frenteDerecha: { x: 900, y: 500 },
      negrasIzquierda: { x: 140, y: 420 },
      negrasDerecha: { x: 860, y: 420 },
    };
    const h = calibracion(toques, modelo);

    const enTeclado = aplicar(h, { x: 500, y: 500 });
    expect(enTeclado.x).toBeCloseTo(4);
    expect(enTeclado.y).toBeCloseTo(0);
    const vuelta = aplicar(
      homografia(
        [
          { x: 0, y: 0 },
          { x: 8, y: 0 },
          { x: 0, y: 1 },
          { x: 8, y: 1 },
        ],
        [
          toques.frenteIzquierda,
          toques.frenteDerecha,
          toques.negrasIzquierda,
          toques.negrasDerecha,
        ],
      ),
      { x: 8, y: 1 },
    );
    expect(vuelta.x).toBeCloseTo(860);
  });

  it("PU-geometry-12: el rango del ejercicio que no entra en el tramo dice qué falta", () => {
    const calibrado = modeloTeclado(48, 72); // Do3–Do5

    expect(coberturaDelRango(calibrado, 48, 72)).toEqual({ cubre: true, faltan: [] });
    expect(coberturaDelRango(calibrado, 46, 72)).toEqual({ cubre: false, faltan: ["graves"] });
    expect(coberturaDelRango(calibrado, 48, 75)).toEqual({ cubre: false, faltan: ["agudas"] });
    expect(coberturaDelRango(calibrado, 41, 79)).toEqual({
      cubre: false,
      faltan: ["graves", "agudas"],
    });
  });
});

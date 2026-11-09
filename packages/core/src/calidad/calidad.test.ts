import { describe, expect, it } from "vitest";
import {
  UMBRALES_PROPUESTOS as U,
  calibracionInvalida,
  desplazamientoTeclado,
  evaluarCalidad,
  luminanciaMedia,
  movimiento,
  nitidez,
  type MedidasFotograma,
} from "./calidad.ts";

const BIEN: MedidasFotograma = {
  luminancia: 120,
  nitidez: 200,
  movimiento: 2,
  manosDetectadas: 2,
  manosEsperadas: 2,
  rangoVisible: true,
};

describe("puertas de calidad visual", () => {
  it("PU-quality-01: un fotograma bien encuadrado da verde sin motivos", () => {
    expect(evaluarCalidad(BIEN)).toEqual({ nivel: "verde", motivos: [] });
  });

  it("PU-quality-02: fronteras de la luz (rojo, ámbar, verde)", () => {
    expect(evaluarCalidad({ ...BIEN, luminancia: U.luzMinRojo - 0.01 }).nivel).toBe("rojo");
    expect(evaluarCalidad({ ...BIEN, luminancia: U.luzMinRojo }).nivel).toBe("ambar");
    expect(evaluarCalidad({ ...BIEN, luminancia: U.luzMinVerde - 0.01 }).nivel).toBe("ambar");
    expect(evaluarCalidad({ ...BIEN, luminancia: U.luzMinVerde }).nivel).toBe("verde");
  });

  it("PU-quality-03: cada problema da su motivo con texto; rango cortado o cámara en movimiento es rojo", () => {
    const casos: [Partial<MedidasFotograma>, string, string][] = [
      [{ nitidez: U.nitidezMin - 0.01 }, "borroso", "ambar"],
      [{ movimiento: U.movimientoMax + 0.01 }, "camara-en-movimiento", "rojo"],
      [{ rangoVisible: false }, "rango-cortado", "rojo"],
      [{ manosDetectadas: 1 }, "sin-manos", "ambar"],
      [{ manosDetectadas: 0, manosEsperadas: 1 }, "sin-manos", "ambar"],
    ];
    for (const [cambio, codigo, nivel] of casos) {
      const s = evaluarCalidad({ ...BIEN, ...cambio });
      expect(s.nivel, codigo).toBe(nivel);
      expect(s.motivos.map((m) => m.codigo)).toEqual([codigo]);
      expect(s.motivos[0]!.texto.length).toBeGreaterThan(10);
    }
    expect(evaluarCalidad({ ...BIEN, movimiento: U.movimientoMax }).nivel).toBe("verde");
    expect(evaluarCalidad({ ...BIEN, manosDetectadas: 1, manosEsperadas: 1 }).nivel).toBe("verde");
  });

  it("PU-quality-04: medidas de imagen: luminancia, nitidez y movimiento", () => {
    const gris = (v: number) => new Uint8ClampedArray([v, v, v, 255, v, v, v, 255]);
    expect(luminanciaMedia(gris(100))).toBeCloseTo(100);

    const plana = new Array(25).fill(50);
    const tablero = Array.from({ length: 25 }, (_, i) => (i % 2 === 0 ? 0 : 255));
    expect(nitidez(plana, 5, 5)).toBe(0);
    expect(nitidez(tablero, 5, 5)).toBeGreaterThan(0);

    expect(movimiento([10, 10, 10], [10, 10, 10])).toBe(0);
    expect(movimiento([0, 0, 0], [30, 0, 0])).toBe(10);
  });
});

describe("desplazamiento del teclado (PRM-17)", () => {
  const calibradas = [
    { x: 100, y: 500 },
    { x: 900, y: 500 },
    { x: 140, y: 420 },
    { x: 860, y: 420 },
  ];
  const mover = (dx: number) => calibradas.map((p) => ({ x: p.x + dx, y: p.y }));

  it("PU-quality-05: hasta el 2 % del ancho se reutiliza; por encima invalida la calibración", () => {
    expect(desplazamientoTeclado(calibradas, mover(16))).toBeCloseTo(0.02);
    expect(calibracionInvalida(desplazamientoTeclado(calibradas, mover(16)))).toBe(false);
    expect(calibracionInvalida(desplazamientoTeclado(calibradas, mover(16.1)))).toBe(true);
  });
});

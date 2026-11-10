import { describe, expect, it } from "vitest";
import { CalibracionSesion } from "./calibracion.ts";

const punto = { x: 1, y: 2 };
const valida = {
  version: 1,
  sesion: "2026-11-09-digital-1",
  clip: "CAL-digital-1",
  instrumento: "digital",
  video: { archivo: "CAL-digital-1.mp4", sha256: "a".repeat(64), ancho: 640, alto: 400 },
  tiempo_fotograma_s: 0.5,
  rango: { min: 60, max: 84 },
  toques: {
    frenteIzquierda: punto,
    frenteDerecha: punto,
    negrasIzquierda: punto,
    negrasDerecha: punto,
  },
  homografia: [1, 0, 0, 0, 1, 0, 0, 0, 1],
  version_nucleo: "0.1.0",
  guardada_en: "2026-11-10T12:00:00.000Z",
  tomas: ["D01-EJ01-MD-60-R1"],
};

describe("contrato CalibracionSesion", () => {
  it("PU-contracts-16: exige una homografía de 9 valores y no admite campos extra", () => {
    expect(CalibracionSesion.safeParse(valida).success).toBe(true);
    expect(CalibracionSesion.safeParse({ ...valida, homografia: [1, 0, 0] }).success).toBe(false);
    expect(CalibracionSesion.safeParse({ ...valida, extra: 1 }).success).toBe(false);
  });
});

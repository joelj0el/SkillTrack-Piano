import { describe, expect, it } from "vitest";
import { detectarAtaques, f1Ataques } from "./ataques.ts";
import { secuencia } from "./sintesis.ts";

const TASA = 22050;
// Escala de Do mayor ascendente a ♩ = 60 en semicorcheas: una nota cada 250 ms.
const ESCALA = [60, 62, 64, 65, 67, 69, 71, 72];
const TIEMPOS = ESCALA.map((_, i) => 0.3 + i * 0.25);

describe("detección de ataques", () => {
  it("PU-audio-05: en una señal limpia cada ataque se recupera con error ≤ 10 ms", () => {
    const senal = secuencia(
      ESCALA.map((midi, i) => ({ midi, t: TIEMPOS[i]! })),
      2.6,
      TASA,
    );
    const detectados = detectarAtaques(senal, TASA);

    expect(detectados).toHaveLength(TIEMPOS.length);
    detectados.forEach((t, i) => expect(Math.abs(t - TIEMPOS[i]!)).toBeLessThanOrEqual(0.01));
  });

  it("PU-audio-06: a ♩ = 75 (200 ms entre notas) tampoco se pierden ni duplican ataques", () => {
    const tiempos = ESCALA.map((_, i) => 0.3 + i * 0.2);
    const senal = secuencia(
      ESCALA.map((midi, i) => ({ midi, t: tiempos[i]! })),
      2.2,
      TASA,
    );

    expect(f1Ataques(detectarAtaques(senal, TASA), tiempos, 0.05).f1).toBe(1);
  });

  it("PU-audio-07: el silencio no produce ataques", () => {
    expect(detectarAtaques(new Float32Array(TASA), TASA)).toEqual([]);
  });

  it("PU-audio-08: F1 con tolerancia: dentro de ±50 ms acierta, fuera no", () => {
    expect(f1Ataques([1.0, 2.05], [1.0, 2.0], 0.05).f1).toBe(1);
    expect(f1Ataques([1.0, 2.051], [1.0, 2.0], 0.05).f1).toBeCloseTo(0.5);
    expect(f1Ataques([], [1.0], 0.05).f1).toBe(0);
  });
});

describe("ataques en el registro grave", () => {
  it("PU-audio-09: la escala de Do3 a Do4 también se recupera con error ≤ 10 ms", () => {
    const graves = [48, 50, 52, 53, 55, 57, 59, 60];
    const tiempos = graves.map((_, i) => 0.3 + i * 0.25);
    const senal = secuencia(
      graves.map((midi, i) => ({ midi, t: tiempos[i]! })),
      2.6,
      TASA,
    );
    const detectados = detectarAtaques(senal, TASA);

    expect(detectados).toHaveLength(tiempos.length);
    detectados.forEach((t, i) => expect(Math.abs(t - tiempos[i]!)).toBeLessThanOrEqual(0.01));
  });
});

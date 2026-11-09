import { describe, expect, it } from "vitest";
import { fft, frecuenciaDeBin, stft } from "./fft.ts";

const TASA = 22050;

describe("FFT y STFT", () => {
  it("PU-audio-01: un impulso tiene espectro plano y una constante solo componente continua", () => {
    const re = new Float64Array(8);
    const im = new Float64Array(8);
    re[0] = 1;
    fft(re, im);
    expect([...re]).toEqual(new Array(8).fill(1));

    const c = new Float64Array(8).fill(2);
    const ci = new Float64Array(8);
    fft(c, ci);
    expect(c[0]).toBeCloseTo(16);
    expect(Math.hypot(c[3]!, ci[3]!)).toBeCloseTo(0);
  });

  it("PU-audio-02: el pico de un tono puro cae en el bin de su frecuencia", () => {
    const frecuencia = frecuenciaDeBin(41, 1024, TASA); // centrado en un bin
    const senal = Float64Array.from({ length: 2048 }, (_, i) =>
      Math.sin((2 * Math.PI * frecuencia * i) / TASA),
    );
    const { cuadros } = stft(senal, TASA);
    const primero = cuadros[0]!;
    const pico = primero.indexOf(Math.max(...primero));
    expect(pico).toBe(41);
  });

  it("PU-audio-03: el tamaño de la FFT debe ser potencia de 2", () => {
    expect(() => fft(new Float64Array(6), new Float64Array(6))).toThrow(/potencia de 2/);
  });

  it("PU-audio-04: número de cuadros de la STFT según tamaño y salto", () => {
    expect(stft(new Float32Array(1024 + 128 * 9), TASA).cuadros).toHaveLength(10);
  });
});

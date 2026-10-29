import { describe, expect, it } from "vitest";
import { crearMedidorDePico } from "./microfono.ts";

const TASA = 48000;
const bloque = (amplitud: number) =>
  Float32Array.from({ length: 128 }, (_, i) => amplitud * Math.sin(i / 3));

describe("medidor de nivel", () => {
  it("PU-audio-21: tras un pitido, el medidor mantiene el pico durante un segundo de silencio", () => {
    const medir = crearMedidorDePico(TASA);
    let nivel: number | null = null;
    // 0,1 s de pitido y luego 0,8 s de silencio digital.
    for (let i = 0; i < 38; i++) nivel = medir(bloque(0.5)) ?? nivel;
    const pico = nivel!;
    for (let i = 0; i < 300; i++) nivel = medir(bloque(0)) ?? nivel;
    expect(pico).toBeGreaterThan(-20);
    expect(nivel).toBe(pico);
  });

  it("PU-audio-22: pasado más de un segundo de silencio, el medidor baja", () => {
    const medir = crearMedidorDePico(TASA);
    let nivel: number | null = null;
    for (let i = 0; i < 38; i++) nivel = medir(bloque(0.5)) ?? nivel;
    for (let i = 0; i < 600; i++) nivel = medir(bloque(0)) ?? nivel;
    expect(nivel).toBe(-100);
  });
});

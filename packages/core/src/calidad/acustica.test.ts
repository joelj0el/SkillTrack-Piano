import { describe, expect, it } from "vitest";
import { secuencia } from "../audio/sintesis.ts";
import { evaluarAudio, medirAudio } from "./acustica.ts";

const TASA = 22050;
const SILENCIO = new Float32Array(TASA);
const piano = () =>
  secuencia(
    [60, 62, 64, 65].map((midi, i) => ({ midi, t: 0.1 + i * 0.5 })),
    2.2,
    TASA,
  );

/** Ruido determinista (sin azar): suma de senos de frecuencias no armónicas. */
function ruido(muestras: Float32Array, amplitud: number): Float32Array {
  for (let i = 0; i < muestras.length; i++) {
    const t = i / TASA;
    muestras[i]! +=
      amplitud * (Math.sin(2 * Math.PI * 377 * t) + Math.sin(2 * Math.PI * 1913 * t + 1)) * 0.5;
  }
  return muestras;
}

describe("puerta de calidad acústica", () => {
  it("PU-quality-06: sala silenciosa con piano audible: verde", () => {
    expect(evaluarAudio(medirAudio(SILENCIO, piano()))).toEqual({ nivel: "verde", mensajes: [] });
  });

  it("PU-quality-07: ruido de fondo fuerte: ámbar o rojo con 'Hay mucho ruido alrededor'", () => {
    const s = evaluarAudio(medirAudio(ruido(new Float32Array(TASA), 0.05), ruido(piano(), 0.05)));
    expect(["ambar", "rojo"]).toContain(s.nivel);
    expect(s.mensajes).toContain("Hay mucho ruido alrededor");
  });

  it("PU-quality-08: saturación: rojo con el mensaje de alejar el teléfono", () => {
    const saturado = piano().map((v) => Math.max(-1, Math.min(1, v * 8)));
    const s = evaluarAudio(medirAudio(SILENCIO, saturado));
    expect(s.nivel).toBe("rojo");
    expect(s.mensajes).toContain("Aleja el teléfono del instrumento o baja su volumen");
  });

  it("PU-quality-09: sin sonido del piano: ámbar pidiendo acercar el teléfono", () => {
    const s = evaluarAudio(medirAudio(SILENCIO, new Float32Array(TASA)));
    expect(s.nivel).toBe("ambar");
    expect(s.mensajes).toEqual(["No se escucha el piano: acerca el teléfono"]);
  });
});

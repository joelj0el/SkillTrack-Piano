import { describe, expect, it } from "vitest";
import { latenciaMetronomo, leerWav, tablaLatencia } from "./latencia.ts";

// Señal SINTÉTICA: un toque y los 4 clics del conteo, generados por código (ninguna grabación).
const TASA = 44100;

function rafaga(senal: Float32Array, t: number, hz: number) {
  const inicio = Math.round(t * TASA);
  for (let i = 0; i < 0.03 * TASA; i++) {
    senal[inicio + i] =
      0.5 * Math.sin((2 * Math.PI * hz * i) / TASA) * Math.exp(-i / (0.008 * TASA));
  }
}

/** WAV PCM de 16 bits, mono. */
function wav(senal: Float32Array): Uint8Array {
  const datos = new DataView(new ArrayBuffer(44 + senal.length * 2));
  const texto = (o: number, s: string) =>
    [...s].forEach((c, i) => datos.setUint8(o + i, c.charCodeAt(0)));
  texto(0, "RIFF");
  datos.setUint32(4, 36 + senal.length * 2, true);
  texto(8, "WAVEfmt ");
  datos.setUint32(16, 16, true);
  datos.setUint16(20, 1, true);
  datos.setUint16(22, 1, true);
  datos.setUint32(24, TASA, true);
  datos.setUint32(28, TASA * 2, true);
  datos.setUint16(32, 2, true);
  datos.setUint16(34, 16, true);
  texto(36, "data");
  datos.setUint32(40, senal.length * 2, true);
  senal.forEach((x, i) => datos.setInt16(44 + i * 2, Math.round(x * 32767), true));
  return new Uint8Array(datos.buffer);
}

/** Repeticiones: toque en `t`, primer clic 50 ms programados + `latencia` después, a ♩ = 60. */
function grabacion(latencias: number[], conToque = true): Float32Array {
  const senal = new Float32Array(TASA * (2 + latencias.length * 8));
  latencias.forEach((lat, r) => {
    const toque = 1 + r * 8;
    if (conToque) rafaga(senal, toque, 3000);
    for (let i = 0; i < 4; i++) rafaga(senal, toque + 0.05 + lat + i, i === 0 ? 1500 : 1000);
  });
  return senal;
}

describe("latencia del metrónomo (TI-HU19-03)", () => {
  it("PU-research-89: lee un WAV PCM y devuelve la señal y su tasa", () => {
    const { muestras, tasa } = leerWav(wav(new Float32Array([0, 0.5, -0.5])));
    expect(tasa).toBe(TASA);
    expect([...muestras].map((x) => Math.round(x * 100) / 100)).toEqual([0, 0.5, -0.5]);
    expect(() => leerWav(new Uint8Array(12))).toThrow(/WAV/);
  });

  it("PU-research-90: mide la latencia desde el toque y el error de cada intervalo del conteo", () => {
    const { muestras, tasa } = leerWav(wav(grabacion([0.12, 0.14, 0.13])));
    const r = latenciaMetronomo(muestras, tasa, 60);
    expect(r.repeticiones).toHaveLength(3);
    const lat = r.repeticiones.map((x) => x.latencia_ms!);
    [120, 140, 130].forEach((esperada, i) => expect(Math.abs(lat[i]! - esperada)).toBeLessThan(10));
    for (const x of r.repeticiones) {
      expect(x.clics).toBe(4);
      for (const e of x.error_intervalos_ms) expect(Math.abs(e)).toBeLessThan(10);
    }
    expect(tablaLatencia(r)).toMatch(/n chico: 3 repeticiones \(< 10\)/);
  });

  it("PU-research-91: sin el toque grabado solo informa los intervalos, nunca una latencia supuesta", () => {
    const { muestras, tasa } = leerWav(wav(grabacion([0.12], false)));
    const [rep] = latenciaMetronomo(muestras, tasa, 60).repeticiones;
    expect(rep!.latencia_ms).toBeNull();
    expect(rep!.clics).toBe(4);
  });
});

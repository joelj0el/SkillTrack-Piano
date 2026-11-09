import { describe, expect, it } from "vitest";
import { ResultadoIntento } from "./index.ts";

export const RESULTADO = {
  client_uuid: "0b6a3c3e-6f1e-4d8a-9a51-2f0f3d6f9c11",
  version_ejercicio_id: 1,
  tarea_id: null,
  version_nucleo: "0.1.0",
  version_modelo_mano: "hand_landmarker@1.1",
  instrumento: "digital",
  manos: "MD",
  clase_dispositivo: "Android/Chrome",
  modo: "V",
  modo_metronomo: null,
  tempo_elegido_bpm: 60,
  estado: "evaluado",
  motivo_no_evaluable: null,
  iniciado_en: "2026-11-10T16:00:00Z",
  duracion_ms: 9000,
  pct_eventos_evaluables: 90,
  pct_digitacion_correcta: 80,
  eventos: [
    {
      idx: 0,
      estado: "digitacion-correcta",
      motivo: null,
      mano: "MD",
      dedo: 1,
      midi: 60,
      rasgos: { "flexion.indice.pip": 35.2 },
    },
  ],
};

describe("contrato ResultadoIntento", () => {
  it("PU-contracts-14: un resultado válido pasa; no admite campos extra (sin medios)", () => {
    expect(ResultadoIntento.safeParse(RESULTADO).success).toBe(true);
    expect(ResultadoIntento.safeParse({ ...RESULTADO, video: "AAAA" }).success).toBe(false);
    expect(ResultadoIntento.safeParse({ ...RESULTADO, landmarks: [[0, 0, 0]] }).success).toBe(
      false,
    );
  });

  it("PU-contracts-15: exige las versiones de núcleo y de modelo de mano no vacías (T-27)", () => {
    expect(ResultadoIntento.safeParse({ ...RESULTADO, version_modelo_mano: "" }).success).toBe(
      false,
    );
    expect(ResultadoIntento.safeParse({ ...RESULTADO, version_nucleo: "" }).success).toBe(false);
  });
});

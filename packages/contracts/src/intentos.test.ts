import { describe, expect, it } from "vitest";
import { ResultadoIntento, ResultadoIntentoV1 } from "./index.ts";

const COMUNES = {
  client_uuid: "0b6a3c3e-6f1e-4d8a-9a51-2f0f3d6f9c11",
  version_ejercicio_id: 1,
  tarea_id: null,
  version_nucleo: "0.1.0",
  version_modelo_mano: "hand_landmarker@1.1",
  instrumento: "digital",
  manos: "MD",
  clase_dispositivo: "Android/Chrome",
  modo: "VA",
  modo_metronomo: "sin",
  tempo_elegido_bpm: 60,
  estado: "evaluado",
  motivo_no_evaluable: null,
  iniciado_en: "2026-11-10T16:00:00Z",
  duracion_ms: 9000,
  pct_eventos_evaluables: 90,
  pct_digitacion_correcta: 80,
};

export const EVENTO = {
  idx: 0,
  mano: "MD",
  midi_esperado: 60,
  dedo_esperado: 1,
  estado: "evaluado",
  motivo: null,
  ataque_ms: 1000,
  modalidad: "VA",
  nota: { estado: "correcta", midi: 60, clase_oida: 0, modalidad: "VA" },
  dedo: { valor: 1, estado: "correcto", modalidad: "V" },
  tecla: { midi: 60, zona: 0.3, modalidad: "V" },
  desfase_manos: null,
  rasgos: { "altura.pulgar": 0.2 },
  rasgos_modalidad: "V",
};

export const RESULTADO = {
  version: 2,
  ...COMUNES,
  tempo_medido_bpm: 61.2,
  referencia_temporal: "tempo_inicial",
  cambio_tempo_pct: 2.1,
  audio_sin_procesar: true,
  eventos: [EVENTO],
};

export const RESULTADO_V1 = {
  ...COMUNES,
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

describe("secuencia esperada", () => {
  it("PU-contracts-19: la secuencia esperada es opcional y solo admite partitura o provisional", async () => {
    const { ResultadoIntento } = await import("./intentos.ts");
    const base = ResultadoIntento.parse({ ...RESULTADO, secuencia_esperada: undefined });
    expect(base.secuencia_esperada).toBeUndefined();
    const conPartitura = ResultadoIntento.parse({ ...RESULTADO, secuencia_esperada: "partitura" });
    expect(conPartitura.secuencia_esperada).toBe("partitura");
    expect(ResultadoIntento.safeParse({ ...RESULTADO, secuencia_esperada: "otra" }).success).toBe(
      false,
    );
  });
});

describe("ResultadoIntento v2", () => {
  it("PU-contracts-20: la v1 sigue siendo válida como v1, pero no como v2", () => {
    expect(ResultadoIntentoV1.safeParse(RESULTADO_V1).success).toBe(true);
    expect(ResultadoIntento.safeParse(RESULTADO_V1).success).toBe(false);
    expect(ResultadoIntentoV1.safeParse(RESULTADO).success).toBe(false);
  });

  it("PU-contracts-21: cada dato del evento lleva su modalidad y la visión solo marca V", () => {
    const con = (cambio: object) =>
      ResultadoIntento.safeParse({ ...RESULTADO, eventos: [{ ...EVENTO, ...cambio }] }).success;
    expect(con({ dedo: { valor: 1, estado: "correcto", modalidad: "A" } })).toBe(false);
    expect(con({ nota: { estado: "correcta", midi: 60, clase_oida: 0 } })).toBe(false);
    expect(
      con({
        desfase_manos: { estado: "tarde", ms: 80, mano_tarde: "MI", modalidad: "VA" },
      }),
    ).toBe(true);
    expect(
      con({ nota: { estado: "sin-dato", midi: null, clase_oida: null, modalidad: null } }),
    ).toBe(true);
  });
});

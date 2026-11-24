// Datos SINTÉTICOS para las pruebas de V1: eventos y resultados inventados, sin grabaciones.
import { ResultadoReproceso, type EventoResultado } from "@skilltrack/contracts";

export function evento(idx: number, cambios: Partial<EventoResultado> = {}): EventoResultado {
  return {
    idx,
    mano: "MD",
    midi_esperado: 60 + idx,
    dedo_esperado: 2,
    estado: "evaluado",
    motivo: null,
    ataque_ms: idx * 250,
    modalidad: "VA",
    nota: {
      estado: "correcta",
      midi: 60 + idx,
      clase_oida: idx % 12,
      modalidad: "VA",
    },
    dedo: { valor: 2, estado: "correcto", modalidad: "V" },
    tecla: { midi: 60 + idx, zona: 0.3, modalidad: "V" },
    desfase_manos: null,
    rasgos: {},
    rasgos_modalidad: null,
    ...cambios,
  };
}

export function resultado(
  codigo: string,
  eventos: EventoResultado[],
  cambios: { origen?: "real" | "actuado" | "sintetico"; final?: boolean } = {},
): ResultadoReproceso {
  const sha = "0".repeat(64);
  return ResultadoReproceso.parse({
    version: 1,
    codigo_toma: codigo,
    origen: cambios.origen ?? "real",
    versiones: {
      nucleo: "0.9.0",
      modelo_mano: "m@1",
      ejercicio: "EJ-01@1",
      referencia: null,
      reglas: null,
      clasificador: null,
      reprocesamiento: "1.2.0",
    },
    secuencia_esperada: "partitura",
    calibracion: { sesion: "s", clip: "CAL-digital-1" },
    video: {
      archivo: "v.mp4",
      sha256: sha,
      codec_video: "h264",
      codec_audio: "aac",
      ancho: 1280,
      alto: 720,
      duracion_s: 10,
    },
    deteccion: {
      delegado: "CPU",
      fotogramas: 300,
      con_manos: 300,
      perdidos: 0,
    },
    landmarks_sha256: sha,
    audio_events_sha256: sha,
    analisis: { notas: [], visuales: [], acustico: null, eventos },
    porcentaje_evaluable: 100,
    evaluable: { planilla: true, analisis: true, final: cambios.final ?? true },
  });
}

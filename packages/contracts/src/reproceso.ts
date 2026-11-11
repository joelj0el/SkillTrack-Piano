import { z } from "zod";

const Sha256 = z.string().length(64);
const Punto = z.tuple([z.number(), z.number(), z.number()]);

const ManoFotograma = z.strictObject({
  mano: z.enum(["MI", "MD"]),
  /** 21 puntos normalizados a la imagen. */
  puntos: z.array(Punto).length(21),
  /** 21 puntos en metros: de ellos salen los rasgos. */
  mundo: z.array(Punto).length(21),
  rasgos: z.record(z.string(), z.unknown()),
});

/** Una línea de landmarks.jsonl: un fotograma, tenga o no manos. */
export const FotogramaReproceso = z.strictObject({
  t: z.number().nonnegative(),
  manos: z.array(ManoFotograma).max(2),
});
export type FotogramaReproceso = z.infer<typeof FotogramaReproceso>;

const AtaqueOido = z.strictObject({
  t: z.number(),
  clase: z.int().min(0).max(11).nullable(),
  energia: z.number().nonnegative(),
  croma: z.array(z.number()).length(12),
});

/** audio_events.json: lo que se oyó en la toma. */
export const EventosAudio = z.strictObject({
  version: z.literal(1),
  codigo_toma: z.string().min(1),
  pista: z.boolean(),
  /** Motivo por el que no hay eventos, cuando el video no trae audio utilizable. */
  motivo: z.string().min(1).nullable(),
  tasa_hz: z.number().positive().nullable(),
  ataques: z.array(AtaqueOido),
});
export type EventosAudio = z.infer<typeof EventosAudio>;

/** resultado.json: análisis de la toma y con qué versiones se obtuvo. */
export const ResultadoReproceso = z.strictObject({
  version: z.literal(1),
  codigo_toma: z.string().min(1),
  origen: z.enum(["real", "actuado", "sintetico"]),
  versiones: z.strictObject({
    nucleo: z.string().min(1),
    modelo_mano: z.string().min(1),
    ejercicio: z.string().min(1),
    /** Aún no existen esos artefactos: null hasta que se publiquen. */
    referencia: z.string().min(1).nullable(),
    reglas: z.string().min(1).nullable(),
    clasificador: z.string().min(1).nullable(),
    reprocesamiento: z.string().min(1),
  }),
  /** De dónde salieron las notas esperadas: la partitura importada o la escala provisional. */
  secuencia_esperada: z.enum(["partitura", "provisional"]),
  calibracion: z.strictObject({
    sesion: z.string().min(1),
    clip: z.string().min(1),
  }),
  video: z.strictObject({
    archivo: z.string().min(1),
    sha256: Sha256,
    codec_video: z.string().min(1).nullable(),
    codec_audio: z.string().min(1).nullable(),
    ancho: z.int().positive(),
    alto: z.int().positive(),
    duracion_s: z.number().positive(),
  }),
  deteccion: z.strictObject({
    delegado: z.enum(["GPU", "CPU"]),
    fotogramas: z.int().nonnegative(),
    con_manos: z.int().nonnegative(),
    /** Fotogramas que el navegador no llegó a entregar a la detección. */
    perdidos: z.int().nonnegative(),
  }),
  landmarks_sha256: Sha256,
  audio_events_sha256: Sha256,
  analisis: z.strictObject({
    notas: z.array(z.unknown()),
    visuales: z.array(z.unknown()),
    acustico: z.record(z.string(), z.unknown()).nullable(),
  }),
  porcentaje_evaluable: z.number().min(0).max(100),
  evaluable: z.strictObject({
    planilla: z.boolean(),
    analisis: z.boolean(),
    final: z.boolean(),
  }),
});
export type ResultadoReproceso = z.infer<typeof ResultadoReproceso>;

import { z } from "zod";
import { Manos } from "./catalogo.ts";

/**
 * ResultadoIntento v1: lo único que sale del teléfono después de un intento. Es estricto: no
 * admite campos extra, así que no hay dónde meter video, audio, imágenes ni series de puntos de
 * la mano. Los rasgos van agregados por evento.
 */
export const LIMITE_CUERPO_BYTES = 256 * 1024;

export const EventoResultado = z
  .strictObject({
    idx: z.int().nonnegative(),
    estado: z.enum(["digitacion-correcta", "dedo-incorrecto", "no-evaluable"]),
    motivo: z.string().max(80).nullable(),
    mano: z.enum(["MI", "MD"]).nullable(),
    dedo: z.int().min(1).max(5).nullable(),
    midi: z.int().min(0).max(127).nullable(),
    rasgos: z.record(z.string().max(40), z.number()),
  })
  .meta({ title: "EventoResultado" });
export type EventoResultado = z.infer<typeof EventoResultado>;

export const ResultadoIntento = z
  .strictObject({
    client_uuid: z.uuid(),
    version_ejercicio_id: z.int().positive(),
    tarea_id: z.int().positive().nullable(),
    version_nucleo: z.string().min(1).max(32),
    version_modelo_mano: z.string().min(1).max(64),
    instrumento: z.enum(["acustico", "digital", "teclado", "no_declarado"]),
    manos: Manos,
    // Clase de dispositivo (p. ej. "Android/Chrome"), nunca un identificador.
    clase_dispositivo: z.string().max(40),
    modo: z.enum(["V", "A", "VA"]),
    modo_metronomo: z.enum(["con", "sin"]).nullable(),
    tempo_elegido_bpm: z.int().min(40).max(75).nullable(),
    estado: z.enum(["evaluado", "no_evaluable"]),
    motivo_no_evaluable: z.string().max(120).nullable(),
    iniciado_en: z.iso.datetime({ offset: true }),
    duracion_ms: z.int().nonnegative(),
    pct_eventos_evaluables: z.number().min(0).max(100).nullable(),
    pct_digitacion_correcta: z.number().min(0).max(100).nullable(),
    eventos: z.array(EventoResultado).max(400),
  })
  .meta({ title: "ResultadoIntento" });
export type ResultadoIntento = z.infer<typeof ResultadoIntento>;

export const IntentoGuardado = z
  .strictObject({
    id: z.int().positive(),
    client_uuid: z.uuid(),
    estudiante_id: z.int().positive(),
    tarea_id: z.int().positive().nullable(),
    estado: z.enum(["evaluado", "no_evaluable"]),
    motivo_no_evaluable: z.string().nullable(),
    cuenta_para_tarea: z.boolean(),
    motivo_no_cuenta: z.string().nullable(),
    version_nucleo: z.string(),
    version_modelo_mano: z.string(),
    instrumento: z.string(),
    manos: Manos,
    modo_metronomo: z.enum(["con", "sin"]).nullable(),
    tempo_elegido_bpm: z.int().nullable(),
    iniciado_en: z.iso.datetime({ offset: true }),
  })
  .meta({ title: "IntentoGuardado" });
export type IntentoGuardado = z.infer<typeof IntentoGuardado>;

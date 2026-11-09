import { z } from "zod";
import { Manos, TEMPO_DOCENTE_MAX, TEMPO_DOCENTE_MIN } from "./catalogo.ts";

// PRM-20: repeticiones por día que el docente puede pedir.
export const REPETICIONES_MIN = 1;
export const REPETICIONES_MAX = 20;
export const LONGITUD_MAXIMA_OBSERVACION = 1000;

const Tempo = z.int().min(TEMPO_DOCENTE_MIN).max(TEMPO_DOCENTE_MAX);
const Repeticiones = z.int().min(REPETICIONES_MIN).max(REPETICIONES_MAX);
const Fecha = z.iso.date();

export const TareaNueva = z
  .strictObject({
    estudiante_id: z.int().positive(),
    ejercicio_id: z.int().positive(),
    manos: Manos,
    tempo_min_bpm: Tempo,
    tempo_max_bpm: Tempo,
    repeticiones_por_dia: Repeticiones,
    fecha_limite: Fecha,
  })
  .meta({ title: "TareaNueva" });
export type TareaNueva = z.infer<typeof TareaNueva>;

export const TareaCambio = z
  .strictObject({
    tempo_min_bpm: Tempo.optional(),
    tempo_max_bpm: Tempo.optional(),
    repeticiones_por_dia: Repeticiones.optional(),
    fecha_limite: Fecha.optional(),
  })
  .meta({ title: "TareaCambio" });
export type TareaCambio = z.infer<typeof TareaCambio>;

export const EstadoTarea = z.enum(["Asignada", "Vencida", "Cancelada"]);
export type EstadoTarea = z.infer<typeof EstadoTarea>;

export const Observacion = z
  .strictObject({
    id: z.int().positive(),
    tarea_id: z.int().positive(),
    aspecto: z
      .strictObject({ codigo: z.string(), nombre: z.string() })
      .meta({ title: "Aspecto" })
      .nullable(),
    texto: z.string(),
    creada_en: z.iso.datetime({ offset: true }),
  })
  .meta({ title: "Observacion" });
export type Observacion = z.infer<typeof Observacion>;

export const Tarea = z
  .strictObject({
    id: z.int().positive(),
    estudiante_id: z.int().positive(),
    docente_id: z.int().positive(),
    ejercicio: z
      .strictObject({ id: z.int().positive(), codigo: z.string(), nombre: z.string() })
      .meta({ title: "EjercicioDeTarea" }),
    manos: Manos,
    tempo_min_bpm: z.int(),
    tempo_max_bpm: z.int(),
    repeticiones_por_dia: z.int(),
    fecha_limite: Fecha,
    estado: EstadoTarea,
    observaciones: z.array(Observacion),
  })
  .meta({ title: "Tarea" });
export type Tarea = z.infer<typeof Tarea>;

export const ObservacionNueva = z
  .strictObject({
    tarea_id: z.int().positive(),
    // Aspecto opcional de la taxonomía vigente (id de clase_error).
    clase_error_id: z.int().positive().nullable().optional(),
    texto: z.string().trim().min(1).max(LONGITUD_MAXIMA_OBSERVACION),
  })
  .meta({ title: "ObservacionNueva" });
export type ObservacionNueva = z.infer<typeof ObservacionNueva>;

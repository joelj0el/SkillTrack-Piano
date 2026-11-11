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

// Asignada → En práctica (≥ 1 intento válido) → Vencida (plazo cumplido); Cancelada por el docente.
export const EstadoTarea = z.enum(["Asignada", "En práctica", "Vencida", "Cancelada"]);
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

/** Intento de la tarea en el avance: si cuenta para la meta del día y, si no, por qué. */
export const IntentoDeAvance = z
  .strictObject({
    id: z.int().positive(),
    iniciado_en: z.iso.datetime({ offset: true }),
    estado: z.enum(["evaluado", "no_evaluable"]),
    tempo_elegido_bpm: z.int().nullable(),
    tempo_medido_bpm: z.number().nullable(),
    cuenta_para_tarea: z.boolean(),
    motivo_no_cuenta: z.string().nullable(),
  })
  .meta({ title: "IntentoDeAvance" });
export type IntentoDeAvance = z.infer<typeof IntentoDeAvance>;

export const DiaDeAvance = z
  .strictObject({ fecha: z.iso.date(), validas: z.int().nonnegative(), meta: z.int().positive() })
  .meta({ title: "DiaDeAvance" });
export type DiaDeAvance = z.infer<typeof DiaDeAvance>;

/** HU-37: repeticiones válidas por día (en la zona horaria de La Paz) frente a la meta. */
export const AvanceTarea = z
  .strictObject({
    tarea_id: z.int().positive(),
    meta_por_dia: z.int().positive(),
    hoy: z.iso.date(),
    validas_hoy: z.int().nonnegative(),
    /** Un día por cada fecha desde la asignación hasta hoy o el plazo, el primero que llegue. */
    dias: z.array(DiaDeAvance),
    /** Del más reciente al más antiguo. */
    intentos: z.array(IntentoDeAvance),
  })
  .meta({ title: "AvanceTarea" });
export type AvanceTarea = z.infer<typeof AvanceTarea>;

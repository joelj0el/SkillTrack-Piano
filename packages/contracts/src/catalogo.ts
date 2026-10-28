import { z } from "zod";

// PRM-02: el docente asigna dentro de 60–75 (60–70 por defecto); el estudiante puede bajar a 40
// como "práctica lenta".
export const TEMPO_DOCENTE_MIN = 60;
export const TEMPO_DOCENTE_MAX = 75;
export const TEMPO_SUGERIDO = { min: 60, max: 70 } as const;
export const TEMPO_PRACTICA_LENTA_MIN = 40;

export const Manos = z.enum(["MI", "MD", "juntas"]);
export type Manos = z.infer<typeof Manos>;

export const EventoEsperado = z
  .strictObject({
    idx: z.int().nonnegative(),
    tiempo_beats: z.number().nonnegative(),
    mano: z.enum(["MI", "MD"]),
    dedo: z.int().min(1).max(5),
    clase_altura: z.int().min(0).max(11),
    midi: z.int().min(0).max(127),
  })
  .meta({ title: "EventoEsperado" });
export type EventoEsperado = z.infer<typeof EventoEsperado>;

export const VersionEjercicio = z
  .strictObject({
    id: z.int().positive(),
    version: z.int().positive(),
    tempo_min_permitido_bpm: z.int().positive(),
    tempo_max_permitido_bpm: z.int().positive(),
    rango_octavas: z.int().positive(),
    nota_min_midi: z.int().min(0).max(127).nullable(),
    nota_max_midi: z.int().min(0).max(127).nullable(),
    eventos_esperados: z.array(EventoEsperado),
    partitura_svg: z.string().nullable(),
    // "pendiente" mientras la partitura no se transcriba y verifique nota por nota.
    transcripcion: z.enum(["pendiente", "verificada"]),
  })
  .meta({ title: "VersionEjercicio" });
export type VersionEjercicio = z.infer<typeof VersionEjercicio>;

export const Ejercicio = z
  .strictObject({
    id: z.int().positive(),
    codigo: z.string().regex(/^EJ-\d{2}$/),
    nombre: z.string(),
    fuente: z.string(),
    tonalidad: z.string(),
    compas: z.string(),
    figura: z.string(),
    orden: z.int().positive(),
    variantes_manos: z.array(Manos),
    version_vigente: VersionEjercicio,
  })
  .meta({ title: "Ejercicio" });
export type Ejercicio = z.infer<typeof Ejercicio>;

export const ClaseError = z
  .strictObject({
    id: z.int().positive(),
    codigo: z.string().regex(/^ER-[A-F]$/),
    nombre_pedagogico: z.string(),
    variable_estudiante: z.string(),
    modalidad: z.enum(["V", "A", "VA"]),
    version_taxonomia: z.string(),
  })
  .meta({ title: "ClaseError" });
export type ClaseError = z.infer<typeof ClaseError>;

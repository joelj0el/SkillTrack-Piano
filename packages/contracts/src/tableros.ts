import { z } from "zod";
import { CodigoClase, CodigoIndicador } from "./reglas.ts";

/**
 * HU-15: tableros descriptivos. Solo tendencias del propio estudiante y errores recurrentes:
 * no hay puntaje global, estrellas, rankings ni comparaciones entre estudiantes.
 */

export const ULTIMOS_POR_DEFECTO = 10;
export const ULTIMOS_MAX = 50;

/** Promedio del % de una variable en los intentos evaluados de una semana (lunes a domingo). */
export const SemanaDeProgreso = z
  .strictObject({
    semana: z.iso.date(),
    clase: CodigoClase,
    intentos: z.int().positive(),
    pct_promedio: z.number().min(0).max(100),
  })
  .meta({ title: "SemanaDeProgreso" });
export type SemanaDeProgreso = z.infer<typeof SemanaDeProgreso>;

export const MiProgreso = z
  .strictObject({ semanas: z.array(SemanaDeProgreso) })
  .meta({ title: "MiProgreso" });
export type MiProgreso = z.infer<typeof MiProgreso>;

/** En cuántos de los últimos N intentos evaluados apareció la clase, y con qué indicadores. */
export const ErrorRecurrente = z
  .strictObject({
    clase: CodigoClase,
    intentos_con_error: z.int().positive(),
    indicadores: z.array(CodigoIndicador),
  })
  .meta({ title: "ErrorRecurrente" });
export type ErrorRecurrente = z.infer<typeof ErrorRecurrente>;

export const EstudianteDelGrupo = z
  .strictObject({
    estudiante_id: z.int().positive(),
    nombre_visible: z.string(),
    intentos_considerados: z.int().min(0).max(ULTIMOS_MAX),
    errores: z.array(ErrorRecurrente),
  })
  .meta({ title: "EstudianteDelGrupo" });
export type EstudianteDelGrupo = z.infer<typeof EstudianteDelGrupo>;

/** Los estudiantes van en orden alfabético, nunca ordenados por sus errores. */
export const MiGrupo = z
  .strictObject({
    ultimos: z.int().min(1).max(ULTIMOS_MAX),
    estudiantes: z.array(EstudianteDelGrupo),
  })
  .meta({ title: "MiGrupo" });
export type MiGrupo = z.infer<typeof MiGrupo>;

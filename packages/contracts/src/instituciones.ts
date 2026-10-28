import { z } from "zod";
import { Rol } from "./identidad.ts";

// Correo opcional (RD-08: los menores no lo necesitan). Validación de forma, no de existencia.
const Correo = z
  .string()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  .max(254);
const Fecha = z.iso.date();

export const UsuarioNuevo = z
  .strictObject({
    usuario: z.string().regex(/^[a-z0-9._-]{3,64}$/),
    nombre_visible: z.string().min(1).max(120),
    email: Correo.nullable().optional(),
    es_menor: z.boolean(),
    rol: Rol,
  })
  .meta({ title: "UsuarioNuevo" });
export type UsuarioNuevo = z.infer<typeof UsuarioNuevo>;

export const UsuarioCreado = z
  .strictObject({
    id: z.int().positive(),
    usuario: z.string(),
    // Se muestra una sola vez; el servidor solo guarda su hash.
    clave_temporal: z.string(),
  })
  .meta({ title: "UsuarioCreado" });
export type UsuarioCreado = z.infer<typeof UsuarioCreado>;

export const UsuarioListado = z
  .strictObject({
    id: z.int().positive(),
    usuario: z.string(),
    nombre_visible: z.string(),
    es_menor: z.boolean(),
    roles: z.array(Rol),
  })
  .meta({ title: "UsuarioListado" });
export type UsuarioListado = z.infer<typeof UsuarioListado>;

export const AsignacionNueva = z
  .strictObject({ docente_id: z.int().positive(), estudiante_id: z.int().positive() })
  .meta({ title: "AsignacionNueva" });
export type AsignacionNueva = z.infer<typeof AsignacionNueva>;

export const Asignacion = z
  .strictObject({
    id: z.int().positive(),
    docente_id: z.int().positive(),
    estudiante_id: z.int().positive(),
    desde: Fecha,
    hasta: Fecha.nullable(),
  })
  .meta({ title: "Asignacion" });
export type Asignacion = z.infer<typeof Asignacion>;

export const EstudianteResumen = z
  .strictObject({
    id: z.int().positive(),
    usuario: z.string(),
    nombre_visible: z.string(),
    es_menor: z.boolean(),
  })
  .meta({ title: "EstudianteResumen" });
export type EstudianteResumen = z.infer<typeof EstudianteResumen>;

export const ClaveRestablecida = z
  .strictObject({ clave_temporal: z.string() })
  .meta({ title: "ClaveRestablecida" });
export type ClaveRestablecida = z.infer<typeof ClaveRestablecida>;

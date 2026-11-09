import { z } from "zod";

// Longitud mínima de la contraseña (PRM-25).
export const LONGITUD_MINIMA_CLAVE = 8;

export const Rol = z.enum(["admin_inst", "docente", "estudiante", "investigador"]);
export type Rol = z.infer<typeof Rol>;

export const InicioSesion = z
  .strictObject({
    usuario: z.string().min(1).max(64),
    clave: z.string().min(1).max(256),
  })
  .meta({ title: "InicioSesion" });
export type InicioSesion = z.infer<typeof InicioSesion>;

export const UsuarioActual = z
  .strictObject({
    id: z.int().positive(),
    usuario: z.string(),
    nombre_visible: z.string(),
    superadmin: z.boolean(),
    clave_temporal: z.boolean(),
    membresias: z.array(
      z.strictObject({ institucion_id: z.int().positive(), rol: Rol }).meta({ title: "Membresia" }),
    ),
  })
  .meta({ title: "UsuarioActual" });
export type UsuarioActual = z.infer<typeof UsuarioActual>;

export const CambioClave = z
  .strictObject({
    clave_actual: z.string().min(1).max(256),
    clave_nueva: z.string().min(LONGITUD_MINIMA_CLAVE).max(256),
  })
  .meta({ title: "CambioClave" });
export type CambioClave = z.infer<typeof CambioClave>;

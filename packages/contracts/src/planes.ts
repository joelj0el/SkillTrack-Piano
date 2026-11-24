import { z } from "zod";

/**
 * HU-39 (ADR-004): planes, suscripción por institución, solicitudes de acceso y pago por QR.
 * Un precio o un límite sin definir es null y se muestra como "—": no se inventan cifras.
 */

export const Periodo = z.enum(["mensual", "anual"]);
export type Periodo = z.infer<typeof Periodo>;

const Limite = z.int().min(1).max(100_000).nullable();
// El servidor lo guarda redondeado a centavos.
const Precio = z.number().min(0).max(1_000_000).nullable();
const Texto = (max: number) => z.string().trim().min(1).max(max);
const Correo = z
  .string()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  .max(254);

const camposPlan = {
  nombre: Texto(80),
  descripcion: Texto(240),
  beneficios: z.array(Texto(160)).max(12),
  precio_bs: Precio,
  periodo: Periodo,
  limite_docentes: Limite,
  limite_estudiantes: Limite,
  destacado: z.boolean(),
  activo: z.boolean(),
};

export const PlanNuevo = z.strictObject(camposPlan).meta({ title: "PlanNuevo" });
export type PlanNuevo = z.infer<typeof PlanNuevo>;

export const PlanCambio = z.strictObject(camposPlan).partial().meta({ title: "PlanCambio" });
export type PlanCambio = z.infer<typeof PlanCambio>;

export const Plan = z
  .strictObject({ id: z.int().positive(), ...camposPlan })
  .meta({ title: "Plan" });
export type Plan = z.infer<typeof Plan>;

export const EstadoSuscripcion = z.enum(["pendiente", "activa", "vencida", "cancelada"]);
export type EstadoSuscripcion = z.infer<typeof EstadoSuscripcion>;

const Fecha = z.iso.date();

const camposSuscripcion = {
  plan_id: z.int().positive(),
  estado: EstadoSuscripcion,
  inicio: Fecha.nullable(),
  fin: Fecha.nullable(),
  /** Convenio especial: sus condiciones y límites reemplazan a los del plan. */
  convenio: z.boolean(),
  condiciones: z.string().trim().max(1000).nullable(),
  limite_docentes: Limite,
  limite_estudiantes: Limite,
};

export const SuscripcionNueva = z
  .strictObject({ institucion_id: z.int().positive(), ...camposSuscripcion })
  .meta({ title: "SuscripcionNueva" });
export type SuscripcionNueva = z.infer<typeof SuscripcionNueva>;

export const SuscripcionCambio = z
  .strictObject(camposSuscripcion)
  .partial()
  .meta({ title: "SuscripcionCambio" });
export type SuscripcionCambio = z.infer<typeof SuscripcionCambio>;

export const Suscripcion = z
  .strictObject({
    id: z.int().positive(),
    institucion_id: z.int().positive(),
    institucion: z.string(),
    plan: z.string(),
    ...camposSuscripcion,
  })
  .meta({ title: "Suscripcion" });
export type Suscripcion = z.infer<typeof Suscripcion>;

/** "Mi plan" del administrador de la institución: plan vigente, límites y cuántos se usan. */
export const MiPlan = z
  .strictObject({
    institucion: z.string(),
    suscripcion: Suscripcion.nullable(),
    limite_docentes: Limite,
    limite_estudiantes: Limite,
    docentes: z.int().min(0),
    estudiantes: z.int().min(0),
  })
  .meta({ title: "MiPlan" });
export type MiPlan = z.infer<typeof MiPlan>;

/** Docente independiente: una institución de un solo docente, que también la administra. */
export const InstitucionNueva = z
  .strictObject({
    nombre: Texto(160),
    independiente: z.boolean(),
    admin_usuario: z.string().regex(/^[a-z0-9._-]{3,64}$/),
    admin_nombre: Texto(120),
    admin_email: Correo.nullable(),
  })
  .meta({ title: "InstitucionNueva" });
export type InstitucionNueva = z.infer<typeof InstitucionNueva>;

export const InstitucionCreada = z
  .strictObject({
    id: z.int().positive(),
    admin_usuario: z.string(),
    // Se muestra una sola vez; el servidor solo guarda su hash.
    clave_temporal: z.string(),
  })
  .meta({ title: "InstitucionCreada" });
export type InstitucionCreada = z.infer<typeof InstitucionCreada>;

export const InstitucionListada = z
  .strictObject({
    id: z.int().positive(),
    nombre: z.string(),
    activo: z.boolean(),
  })
  .meta({ title: "InstitucionListada" });
export type InstitucionListada = z.infer<typeof InstitucionListada>;

export const SolicitudAccesoNueva = z
  .strictObject({
    nombre: Texto(120),
    institucion: Texto(160),
    correo: Correo,
    telefono: z
      .string()
      .regex(/^[0-9 +()-]{6,20}$/)
      .nullable(),
    plan_id: z.int().positive().nullable(),
    mensaje: z.string().trim().max(1000).nullable(),
  })
  .meta({ title: "SolicitudAccesoNueva" });
export type SolicitudAccesoNueva = z.infer<typeof SolicitudAccesoNueva>;

export const SolicitudAcceso = z
  .strictObject({
    id: z.int().positive(),
    ...SolicitudAccesoNueva.shape,
    plan: z.string().nullable(),
    creada_en: z.iso.datetime({ offset: true }),
    atendida: z.boolean(),
  })
  .meta({ title: "SolicitudAcceso" });
export type SolicitudAcceso = z.infer<typeof SolicitudAcceso>;

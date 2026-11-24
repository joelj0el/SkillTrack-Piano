import { z } from "zod";
import { LONGITUD_MINIMA_CLAVE } from "./identidad.ts";
import { EstadoSuscripcion, Periodo } from "./planes.ts";

/**
 * HU-40 (ADR-005): registro de compradores (docente independiente o institución, adultos),
 * convenios con código y pago de la cuenta pendiente. Los estudiantes no se registran solos.
 */

const Texto = (max: number) => z.string().trim().min(1).max(max);
const Correo = z
  .string()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
  .max(254);
const Telefono = z.string().regex(/^[0-9 +()-]{6,20}$/);
const Fecha = z.iso.date();
// El código se guarda en mayúsculas; en el registro se acepta como lo escriba la persona.
const Codigo = z.string().regex(/^[A-Z0-9-]{4,32}$/);
const CodigoEscrito = z.string().regex(/^[A-Za-z0-9-]{4,32}$/);
const Monto = z.number().min(0).max(1_000_000);

export const TipoCuenta = z.enum(["independiente", "institucion"]);
export type TipoCuenta = z.infer<typeof TipoCuenta>;

/** Sin código de convenio, el plan es obligatorio; con código, el plan sale del convenio. */
export const RegistroNuevo = z
  .strictObject({
    tipo: TipoCuenta,
    nombre: Texto(120),
    correo: Correo,
    telefono: Telefono,
    usuario: z.string().regex(/^[a-z0-9._-]{3,64}$/),
    clave: z.string().min(LONGITUD_MINIMA_CLAVE).max(256),
    institucion: Texto(160),
    plan_id: z.int().positive().nullable(),
    codigo_convenio: CodigoEscrito.nullable(),
    acepta_terminos: z.literal(true),
  })
  .meta({ title: "RegistroNuevo" });
export type RegistroNuevo = z.infer<typeof RegistroNuevo>;

const camposConvenio = {
  codigo: Codigo,
  plan_id: z.int().positive(),
  /** Precio especial; 0 deja la cuenta activa sin pago. */
  precio_bs: Monto,
  cupos: z.int().min(1).max(100_000),
  vence: Fecha,
};

export const ConvenioCodigoNuevo = z
  .strictObject(camposConvenio)
  .meta({ title: "ConvenioCodigoNuevo" });
export type ConvenioCodigoNuevo = z.infer<typeof ConvenioCodigoNuevo>;

export const ConvenioCodigo = z
  .strictObject({
    id: z.int().positive(),
    ...camposConvenio,
    plan: z.string(),
    usados: z.int().min(0),
  })
  .meta({ title: "ConvenioCodigo" });
export type ConvenioCodigo = z.infer<typeof ConvenioCodigo>;

/** QR del adaptador vigente; el simulado no sirve para pagar y se muestra como tal. */
export const QrDePago = z
  .strictObject({
    id_transaccion: z.string(),
    simulado: z.boolean(),
    // Imagen PNG en base64 tal como la entregue el banco; null en el simulado.
    imagen_png: z.string().nullable(),
    vence_en: z.iso.datetime({ offset: true }),
  })
  .meta({ title: "QrDePago" });
export type QrDePago = z.infer<typeof QrDePago>;

/** Pantalla de pago de la cuenta: un monto null es "sin definir" (no se puede generar el QR). */
export const MiPago = z
  .strictObject({
    institucion: z.string(),
    plan: z.string(),
    periodo: Periodo,
    monto_bs: Monto.nullable(),
    codigo_convenio: z.string().nullable(),
    estado: EstadoSuscripcion,
    qr: QrDePago.nullable(),
  })
  .meta({ title: "MiPago" });
export type MiPago = z.infer<typeof MiPago>;

/** Cuenta registrada que espera la verificación del pago (solo la ve el superadministrador). */
export const CuentaPendiente = z
  .strictObject({
    suscripcion_id: z.int().positive(),
    institucion: z.string(),
    plan: z.string(),
    monto_bs: Monto.nullable(),
    codigo_convenio: z.string().nullable(),
    nombre: z.string(),
    usuario: z.string(),
    correo: z.string().nullable(),
    telefono: z.string().nullable(),
    creada_en: z.iso.datetime({ offset: true }),
    qr_generado: z.boolean(),
  })
  .meta({ title: "CuentaPendiente" });
export type CuentaPendiente = z.infer<typeof CuentaPendiente>;

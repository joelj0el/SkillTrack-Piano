import { z } from "zod";

/** Estado de una cifra: ninguna se presenta como definitiva sin serlo. */
const EstadoCifra = z
  .enum(["[PROVISIONAL]", "PENDIENTE", "[CAMPAÑA-A]"])
  .meta({ title: "EstadoCifra" });
const NombreRasgo = z.string().min(1).max(40);

const Percentiles = z
  .strictObject({
    inferior: z.number().min(0).max(100),
    superior: z.number().min(0).max(100),
    estado: EstadoCifra,
  })
  .refine((p) => p.inferior <= p.superior, "El percentil inferior supera al superior");

const ParametroRasgo = z.strictObject({
  /** null: no documentada; la retención de ese rasgo no se evalúa. */
  diferencia_buscada: z.number().positive().nullable(),
  /** PRM-xx de donde sale la cifra, o null. */
  fuente: z.string().min(1).nullable(),
  estado: EstadoCifra,
});

/** Parámetros con que se construye una referencia (los escribe el autor a partir de la plantilla). */
export const ParametrosBandas = z.strictObject({
  percentiles: Percentiles,
  factor_retencion: z.strictObject({
    valor: z.number().positive(),
    estado: EstadoCifra,
  }),
  rasgos: z.record(NombreRasgo, ParametroRasgo),
});
export type ParametrosBandas = z.infer<typeof ParametrosBandas>;

const BandaReferencia = z.strictObject({
  /** Evento ("e12"), compás ("c3") o la ejecución completa ("ejecucion"). */
  unidad: z.string().min(1).max(20),
  rasgo: NombreRasgo,
  centro: z.number(),
  inferior: z.number(),
  superior: z.number(),
  n_docentes: z.int().positive(),
  n_ejecuciones: z.int().positive(),
});

/** Artefacto `referencia vN`: inmutable una vez publicado. */
export const Referencia = z
  .strictObject({
    formato: z.literal(1),
    version: z.int().positive(),
    version_ejercicio: z.string().min(1),
    n_docentes: z.int().positive(),
    metodo: z.strictObject({
      unidad: z.enum(["evento", "compas"]),
      percentiles: Percentiles,
      factor_retencion: z.strictObject({
        valor: z.number().positive(),
        estado: EstadoCifra,
      }),
      parametros_rasgos: z.record(NombreRasgo, ParametroRasgo),
    }),
    bandas: z.array(BandaReferencia),
    rasgos_descartados: z.array(
      z.strictObject({
        rasgo: NombreRasgo,
        dispersion: z.number().nonnegative(),
        diferencia_buscada: z.number().positive(),
        factor: z.number().positive(),
        motivo: z.string().min(1),
      }),
    ),
    /** Rasgos cuya retención no se evaluó (sin diferencia buscada o con un solo docente). */
    rasgos_sin_evaluar: z.array(z.strictObject({ rasgo: NombreRasgo, motivo: z.string().min(1) })),
    /** De dónde sale la referencia (DP-05). */
    origen: z.strictObject({
      campana: z.literal("A"),
      rol: z.literal("docente_ref"),
      origen_tomas: z.literal("real"),
      tomas: z.array(z.string().min(1)).min(1),
      version_nucleo: z.string().min(1),
      versiones_reprocesamiento: z.array(z.string().min(1)).min(1),
      generada_en: z.iso.datetime(),
    }),
  })
  .meta({ title: "Referencia" });
export type Referencia = z.infer<typeof Referencia>;

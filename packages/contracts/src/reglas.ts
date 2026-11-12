import { z } from "zod";

export const CODIGOS_INDICADOR = [
  "IND-A1",
  "IND-B1",
  "IND-B2",
  "IND-B3",
  "IND-C1",
  "IND-D1",
  "IND-D2",
  "IND-E1",
  "IND-F1",
  "IND-F2",
  "IND-F3",
  "IND-F4",
] as const;
export const CodigoIndicador = z.enum(CODIGOS_INDICADOR).meta({ title: "CodigoIndicador" });
export type CodigoIndicador = z.infer<typeof CodigoIndicador>;
export const CodigoClase = z
  .enum(["ER-A", "ER-B", "ER-C", "ER-D", "ER-E", "ER-F"])
  .meta({ title: "CodigoClase" });
/** Qué datos necesita una regla: solo visión, solo audio o ambos. */
export const ModalidadRegla = z.enum(["V", "A", "VA"]).meta({ title: "ModalidadRegla" });

/** El valor medido queda fuera de la banda de la referencia (por encima, por debajo o a cualquier lado). */
const FueraDeBanda = z.strictObject({
  tipo: z.literal("fuera_de_banda"),
  rasgo: z.string().min(1).max(40),
  lado: z.enum(["encima", "debajo", "cualquiera"]),
});

/** El estado de un dato del evento es uno de los indicados. */
const EstadoDelEvento = z.strictObject({
  tipo: z.literal("estado"),
  dato: z.enum(["nota", "dedo", "desfase_manos"]),
  valores: z.array(z.string().min(1)).min(1),
});

const comunRegla = {
  id: z.string().regex(/^R-[A-Z0-9-]+$/),
  indicador: CodigoIndicador,
  modalidad: ModalidadRegla,
};

/** Por evento: dispara si al menos minimo_eventos eventos cumplen la condición. */
const ReglaDeEvento = z.strictObject({
  ...comunRegla,
  alcance: z.literal("evento"),
  condicion: z.discriminatedUnion("tipo", [FueraDeBanda, EstadoDelEvento]),
  minimo_eventos: z.int().min(1),
});

/** Por intento: compara una medida de toda la ejecución con su banda. */
const ReglaDeIntento = z.strictObject({
  ...comunRegla,
  alcance: z.literal("intento"),
  condicion: FueraDeBanda,
});

export const Regla = z
  .discriminatedUnion("alcance", [ReglaDeEvento, ReglaDeIntento])
  .meta({ title: "Regla" });
export type Regla = z.infer<typeof Regla>;

const IndicadorConfigurado = z.discriminatedUnion("evaluable", [
  z.strictObject({
    clase: CodigoClase,
    evaluable: z.literal(true),
    motivo_no_evaluable: z.null(),
    /** Texto para el estudiante; se reemplaza con las frases del panel publicando otra versión. */
    mensaje: z.string().min(1),
  }),
  z.strictObject({
    clase: CodigoClase,
    evaluable: z.literal(false),
    motivo_no_evaluable: z.string().min(1),
    mensaje: z.string().min(1),
  }),
]);

/**
 * `conjunto_reglas vN`: reglas declarativas versionadas, atadas a una versión de la taxonomía.
 * Declara los 12 indicadores; los que el núcleo no calcula quedan como no evaluables por diseño.
 */
export const ConjuntoReglas = z
  .strictObject({
    version: z.int().positive(),
    version_taxonomia: z.string().min(1).max(16),
    indicadores: z.record(CodigoIndicador, IndicadorConfigurado),
    reglas: z.array(Regla).min(1),
  })
  .superRefine((c, ctx) => {
    const problema = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });
    for (const [codigo, conf] of Object.entries(c.indicadores)) {
      if (conf.clase !== `ER-${codigo.charAt(4)}`) {
        problema(["indicadores", codigo, "clase"], `${codigo} no es de la clase ${conf.clase}`);
      }
      if (conf.evaluable && !c.reglas.some((r) => r.indicador === codigo)) {
        problema(["indicadores", codigo], `${codigo} es evaluable pero no tiene reglas`);
      }
    }
    const ids = new Set<string>();
    c.reglas.forEach((r, i) => {
      if (ids.has(r.id)) problema(["reglas", i, "id"], `${r.id} repetida`);
      ids.add(r.id);
      if (!c.indicadores[r.indicador].evaluable) {
        problema(["reglas", i, "indicador"], `${r.indicador} es no evaluable por diseño`);
      }
    });
  })
  .meta({ title: "ConjuntoReglas" });
export type ConjuntoReglas = z.infer<typeof ConjuntoReglas>;

export const ReglasPublicadas = z
  .strictObject({
    id: z.int().positive(),
    version: z.int().positive(),
    version_taxonomia: z.string(),
    publicada_en: z.iso.datetime({ offset: true }),
  })
  .meta({ title: "ReglasPublicadas" });
export type ReglasPublicadas = z.infer<typeof ReglasPublicadas>;

/** El conjunto vigente, como lo descarga el cliente. */
export const ReglasVigentes = z
  .strictObject({
    id: z.int().positive(),
    publicada_en: z.iso.datetime({ offset: true }),
    conjunto: ConjuntoReglas,
  })
  .meta({ title: "ReglasVigentes" });
export type ReglasVigentes = z.infer<typeof ReglasVigentes>;

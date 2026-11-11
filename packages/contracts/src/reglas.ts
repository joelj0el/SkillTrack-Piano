import { z } from "zod";

/**
 * `conjunto_reglas vN`: reglas declarativas versionadas, atadas a una versión de la taxonomía.
 * La forma de cada regla la fija el motor de reglas (HU-06); aquí solo se exige que sea un objeto.
 */
export const ConjuntoReglas = z
  .strictObject({
    version: z.int().positive(),
    version_taxonomia: z.string().min(1).max(16),
    reglas: z.array(z.record(z.string(), z.unknown())),
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

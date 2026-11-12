/** Lecturas de la base de investigación para V2, V3a y V3b (la ruta lleva al resultado.json). */
import type { Base } from "../ingesta/registro.ts";
import type { FilaEtiqueta } from "./etiquetas.ts";
import type { Origen } from "./concordancia.ts";

export interface TomaDeLaBase {
  codigo_toma: string;
  participante: string;
  rol: string;
  origen: Origen;
  ruta: string;
}

/** Tomas evaluables de un ejercicio, de todos los orígenes; el script las separa por origen. */
export async function tomasDelEjercicio(
  base: Base,
  versionEjercicio: string,
): Promise<TomaDeLaBase[]> {
  const { rows } = await base.consulta(
    `SELECT e.codigo_toma, e.participante, p.rol, e.origen, e.ruta
       FROM ejecucion e JOIN participante p ON p.seudonimo = e.participante
      WHERE e.evaluable AND e.version_ejercicio = $1
      ORDER BY e.codigo_toma`,
    [versionEjercicio],
  );
  return rows as unknown as TomaDeLaBase[];
}

/** Etiquetas evaluables de las tomas de un ejercicio. */
export async function etiquetasDelEjercicio(
  base: Base,
  versionEjercicio: string,
): Promise<FilaEtiqueta[]> {
  const { rows } = await base.consulta(
    `SELECT e.codigo_toma, t.etiquetador, t.clase_error, t.presente, t.ronda
       FROM etiqueta t JOIN ejecucion e ON e.id = t.ejecucion
      WHERE t.evaluable AND e.version_ejercicio = $1
      ORDER BY e.codigo_toma, t.clase_error, t.etiquetador`,
    [versionEjercicio],
  );
  return rows as unknown as FilaEtiqueta[];
}

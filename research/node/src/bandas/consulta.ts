import type { Base } from "../ingesta/registro.ts";
import type { TomaEjecucion } from "../ingesta/validar.ts";

/** El valor con que la ingesta registra a los docentes de referencia (columna participante.rol). */
export const ROL_DOCENTE = "docente_ref" satisfies TomaEjecucion["rol"];

export interface TomaDeReferencia {
  codigo_toma: string;
  docente: string;
  /** Carpeta del paquete: ahí deja el reprocesamiento su resultado.json. */
  ruta: string;
}

/** Tomas de la Campaña A de los docentes de referencia, reales y evaluables, de un ejercicio. */
export async function tomasDeReferencia(
  base: Base,
  versionEjercicio: string,
): Promise<TomaDeReferencia[]> {
  const { rows } = await base.consulta(
    `SELECT e.codigo_toma, e.participante AS docente, e.ruta
       FROM ejecucion e JOIN participante p ON p.seudonimo = e.participante
      WHERE p.rol = $1 AND e.campana = 'A' AND e.origen = 'real' AND e.evaluable
        AND e.version_ejercicio = $2
      ORDER BY e.codigo_toma`,
    [ROL_DOCENTE, versionEjercicio],
  );
  return rows as unknown as TomaDeReferencia[];
}

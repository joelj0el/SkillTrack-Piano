import type { Clase } from "../diagnostico/calificacion.ts";
import type { EventoDiagnosticable } from "../diagnostico/reglas.ts";

/**
 * HU-35: etiqueta del clasificador, opcional y detrás de una bandera apagada por defecto. Solo
 * complementa el diagnóstico de las reglas: nunca lo cambia ni lo reemplaza. El modelo se carga
 * de forma perezosa con el cargador inyectado (el núcleo no hace red); con la bandera apagada el
 * cargador ni siquiera se llama.
 */
export const BANDERA_CLASIFICADOR_POR_DEFECTO = false;

export interface Clasificador {
  /** Versión del modelo (se registra junto a la etiqueta). */
  version: string;
  /** Clases que el modelo marca en la ejecución. */
  etiquetar(eventos: readonly EventoDiagnosticable[]): Clase[];
}

export interface EtiquetaClasificador {
  version: string;
  clases: Clase[];
}

export type CargarClasificador = () => Promise<Clasificador | null>;

export async function etiquetaDelClasificador(
  bandera: boolean,
  cargar: CargarClasificador,
  eventos: readonly EventoDiagnosticable[],
): Promise<EtiquetaClasificador | null> {
  if (!bandera) return null;
  const modelo = await cargar();
  if (!modelo) return null;
  return { version: modelo.version, clases: modelo.etiquetar(eventos) };
}

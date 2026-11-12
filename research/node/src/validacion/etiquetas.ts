/** Etiquetas de la planilla (tabla etiqueta) llevadas a una decisión por ejecución y clase. */

export interface FilaEtiqueta {
  codigo_toma: string;
  etiquetador: string;
  clase_error: string;
  presente: boolean;
  ronda: "piloto" | "simple" | "doble" | "desempate";
}

export type Consenso =
  { tipo: "consenso"; presente: boolean } | { tipo: "sin-consenso" } | { tipo: "sin-etiqueta" };

const clave = (toma: string, clase: string) => `${toma}\u0000${clase}`;

/**
 * Consenso por ejecución y clase: manda el desempate; si no hay, todos los etiquetadores
 * (ronda simple o doble) deben coincidir. La ronda piloto no cuenta.
 */
export function consensos(filas: readonly FilaEtiqueta[]): Map<string, Consenso> {
  const grupos = new Map<string, FilaEtiqueta[]>();
  for (const f of filas) {
    if (f.ronda === "piloto") continue;
    const k = clave(f.codigo_toma, f.clase_error);
    grupos.set(k, [...(grupos.get(k) ?? []), f]);
  }
  const salida = new Map<string, Consenso>();
  for (const [k, g] of grupos) {
    const desempate = g.find((f) => f.ronda === "desempate");
    if (desempate) {
      salida.set(k, { tipo: "consenso", presente: desempate.presente });
      continue;
    }
    const valores = new Set(g.map((f) => f.presente));
    salida.set(
      k,
      valores.size === 1
        ? { tipo: "consenso", presente: g[0]!.presente }
        : { tipo: "sin-consenso" },
    );
  }
  return salida;
}

export function consensoDe(c: Map<string, Consenso>, toma: string, clase: string): Consenso {
  return c.get(clave(toma, clase)) ?? { tipo: "sin-etiqueta" };
}

/** Juicios de la ronda doble (etiquetas_1 y etiquetas_2) por clase, para κ entre etiquetadores. */
export function juiciosDobles(
  filas: readonly FilaEtiqueta[],
  clase: string,
  tomas: ReadonlySet<string>,
): boolean[][] {
  const porToma = new Map<string, boolean[]>();
  for (const f of filas) {
    if (f.ronda !== "doble" || f.clase_error !== clase || !tomas.has(f.codigo_toma)) continue;
    porToma.set(f.codigo_toma, [...(porToma.get(f.codigo_toma) ?? []), f.presente]);
  }
  return [...porToma.values()].filter((j) => j.length === 2);
}

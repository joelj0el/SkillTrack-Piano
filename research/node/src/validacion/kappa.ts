/** Concordancia para clases binarias (presente / ausente). */

export interface Concordancia {
  n: number;
  /** Proporción de acuerdo observada; null sin casos. */
  acuerdo: number | null;
  /** null sin casos o si el acuerdo esperado es 1 (todos dicen lo mismo: κ no está definido). */
  kappa: number | null;
}

/** κ de Cohen entre dos fuentes fijas (p. ej., reglas frente al consenso de los etiquetadores). */
export function kappaDeCohen(pares: readonly (readonly [boolean, boolean])[]): Concordancia {
  const n = pares.length;
  if (n === 0) return { n, acuerdo: null, kappa: null };
  const acuerdo = pares.filter(([a, b]) => a === b).length / n;
  const p1 = pares.filter(([a]) => a).length / n;
  const p2 = pares.filter(([, b]) => b).length / n;
  const esperado = p1 * p2 + (1 - p1) * (1 - p2);
  return {
    n,
    acuerdo,
    kappa: esperado === 1 ? null : (acuerdo - esperado) / (1 - esperado),
  };
}

/**
 * κ de Fleiss: cada ejecución con el mismo número de juicios (m ≥ 2), sin importar qué
 * etiquetador hizo cada uno. Cada elemento es la lista de juicios de una ejecución.
 */
export function kappaDeFleiss(juicios: readonly (readonly boolean[])[]): Concordancia {
  const items = juicios.filter((j) => j.length >= 2);
  const n = items.length;
  if (n === 0) return { n, acuerdo: null, kappa: null };
  const m = items[0]!.length;
  if (items.some((j) => j.length !== m)) {
    throw new Error("κ de Fleiss exige el mismo número de juicios por ejecución");
  }
  let acuerdoTotal = 0;
  let si = 0;
  for (const j of items) {
    const a = j.filter(Boolean).length;
    const b = m - a;
    acuerdoTotal += (a * (a - 1) + b * (b - 1)) / (m * (m - 1));
    si += a;
  }
  const acuerdo = acuerdoTotal / n;
  const pSi = si / (n * m);
  const esperado = pSi ** 2 + (1 - pSi) ** 2;
  return {
    n,
    acuerdo,
    kappa: esperado === 1 ? null : (acuerdo - esperado) / (1 - esperado),
  };
}

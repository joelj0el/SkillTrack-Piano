/**
 * Bandas por consenso de los docentes de referencia (se usan offline, sobre la Campaña A).
 *
 * Por unidad (evento o compás) y rasgo, la banda son percentiles ponderados de TODAS las
 * ejecuciones: cada ejecución pesa 1/(ejecuciones de su docente en esa celda), así cada docente
 * pesa lo mismo y la banda refleja la variación de una ejecución individual. El centro es la
 * mediana ponderada.
 */

export interface Observacion {
  docente: string;
  ejecucion: string;
  /** Evento ("e12") o compás ("c3"). */
  unidad: string;
  rasgo: string;
  valor: number;
}

export interface Percentiles {
  /** 0–100. */
  inferior: number;
  superior: number;
}

export interface Banda {
  unidad: string;
  rasgo: string;
  centro: number;
  inferior: number;
  superior: number;
  n_docentes: number;
  n_ejecuciones: number;
}

export interface ValorPonderado {
  valor: number;
  peso: number;
}

/**
 * Percentil ponderado con interpolación lineal entre los centros de masa de cada valor
 * (con pesos iguales coincide con el percentil habitual). Los valores repetidos se funden.
 */
export function percentilPonderado(valores: readonly ValorPonderado[], p: number): number {
  if (!valores.length) throw new Error("Sin valores");
  const fundidos = new Map<number, number>();
  for (const { valor, peso } of valores) fundidos.set(valor, (fundidos.get(valor) ?? 0) + peso);
  const orden = [...fundidos].sort((a, b) => a[0] - b[0]);
  const total = orden.reduce((s, [, w]) => s + w, 0);
  const objetivo = (p / 100) * total;
  let acumulado = 0;
  let anterior: [number, number] | null = null;
  for (const [valor, peso] of orden) {
    const centro = acumulado + peso / 2;
    if (objetivo <= centro) {
      if (!anterior) return valor;
      const [v0, c0] = anterior;
      const interpolado = v0 + ((objetivo - c0) / (centro - c0)) * (valor - v0);
      // El redondeo con valores muy desiguales no debe sacar el resultado del tramo.
      return Math.min(valor, Math.max(v0, interpolado));
    }
    anterior = [valor, centro];
    acumulado += peso;
  }
  return orden.at(-1)![0];
}

/** Pesos de una celda: cada docente reparte 1 entre sus valores (los repetidos se cuentan juntos). */
export function valoresPonderados(celda: readonly Observacion[]): ValorPonderado[] {
  const porDocente = new Map<string, number[]>();
  for (const o of celda) porDocente.set(o.docente, [...(porDocente.get(o.docente) ?? []), o.valor]);
  const salida: ValorPonderado[] = [];
  for (const docente of [...porDocente.keys()].sort()) {
    const valores = porDocente.get(docente)!;
    const cuenta = new Map<number, number>();
    for (const v of valores) cuenta.set(v, (cuenta.get(v) ?? 0) + 1);
    for (const [valor, n] of [...cuenta].sort((a, b) => a[0] - b[0])) {
      salida.push({ valor, peso: n / valores.length });
    }
  }
  return salida;
}

export function validarPercentiles({ inferior, superior }: Percentiles): void {
  if (!(inferior >= 0 && superior <= 100 && inferior <= superior)) {
    throw new Error(`Percentiles no válidos: ${inferior}–${superior}`);
  }
}

/** Agrupa por unidad y rasgo, en orden estable. */
export function celdas(observaciones: readonly Observacion[]): [string, string, Observacion[]][] {
  const mapa = new Map<string, Observacion[]>();
  for (const o of observaciones) {
    const clave = JSON.stringify([o.unidad, o.rasgo]);
    mapa.set(clave, [...(mapa.get(clave) ?? []), o]);
  }
  return [...mapa.keys()].sort().map((clave) => {
    const [unidad, rasgo] = JSON.parse(clave) as [string, string];
    return [unidad, rasgo, mapa.get(clave)!];
  });
}

export function construirBandas(
  observaciones: readonly Observacion[],
  percentiles: Percentiles,
): Banda[] {
  validarPercentiles(percentiles);
  return celdas(observaciones).map(([unidad, rasgo, celda]) => {
    const valores = valoresPonderados(celda);
    return {
      unidad,
      rasgo,
      centro: percentilPonderado(valores, 50),
      inferior: percentilPonderado(valores, percentiles.inferior),
      superior: percentilPonderado(valores, percentiles.superior),
      n_docentes: new Set(celda.map((o) => o.docente)).size,
      n_ejecuciones: new Set(celda.map((o) => `${o.docente}\u0000${o.ejecucion}`)).size,
    };
  });
}

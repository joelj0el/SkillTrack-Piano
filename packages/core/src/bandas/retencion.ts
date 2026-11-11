/**
 * Regla de retención (DM-12b): un rasgo cuya dispersión ENTRE docentes es comparable a la
 * diferencia que se busca detectar se descarta, dejando constancia del motivo.
 *
 * Dispersión de una celda (unidad × rasgo): rango intercuartil de las medianas de cada docente.
 * Dispersión del rasgo: mediana de la de sus celdas con 2 o más docentes.
 * "Comparable": dispersión ≥ factor × diferencia buscada.
 */
import { celdas, percentilPonderado, type Observacion } from "./bandas.ts";

export interface ParametroRasgo {
  /** null: no documentada (PENDIENTE); la retención de ese rasgo no se evalúa. */
  diferencia_buscada: number | null;
}

export interface RasgoDescartado {
  rasgo: string;
  dispersion: number;
  diferencia_buscada: number;
  factor: number;
  motivo: string;
}

export interface RasgoSinEvaluar {
  rasgo: string;
  motivo: string;
}

export interface Retencion {
  retenidos: string[];
  descartados: RasgoDescartado[];
  sin_evaluar: RasgoSinEvaluar[];
}

const mediana = (valores: number[]) =>
  percentilPonderado(
    valores.map((valor) => ({ valor, peso: 1 })),
    50,
  );

/** null si ninguna unidad del rasgo tiene 2 o más docentes. */
export function dispersionEntreDocentes(
  observaciones: readonly Observacion[],
  rasgo: string,
): number | null {
  const porCelda: number[] = [];
  for (const [, r, celda] of celdas(observaciones)) {
    if (r !== rasgo) continue;
    const porDocente = new Map<string, number[]>();
    for (const o of celda)
      porDocente.set(o.docente, [...(porDocente.get(o.docente) ?? []), o.valor]);
    if (porDocente.size < 2) continue;
    const medianas = [...porDocente.values()].map(mediana).map((valor) => ({ valor, peso: 1 }));
    porCelda.push(percentilPonderado(medianas, 75) - percentilPonderado(medianas, 25));
  }
  return porCelda.length ? mediana(porCelda) : null;
}

export function aplicarRetencion(
  observaciones: readonly Observacion[],
  parametros: Readonly<Record<string, ParametroRasgo>>,
  factor: number,
): Retencion {
  if (!(factor > 0)) throw new Error(`Factor no válido: ${factor}`);
  const rasgos = [...new Set(observaciones.map((o) => o.rasgo))].sort();
  const r: Retencion = { retenidos: [], descartados: [], sin_evaluar: [] };
  for (const rasgo of rasgos) {
    const diferencia = parametros[rasgo]?.diferencia_buscada ?? null;
    if (diferencia === null) {
      r.sin_evaluar.push({
        rasgo,
        motivo: "Diferencia buscada PENDIENTE: no se evalúa la retención",
      });
      continue;
    }
    const dispersion = dispersionEntreDocentes(observaciones, rasgo);
    if (dispersion === null) {
      r.sin_evaluar.push({
        rasgo,
        motivo: "Con un solo docente por unidad no se puede medir la dispersión entre docentes",
      });
      continue;
    }
    if (dispersion >= factor * diferencia) {
      r.descartados.push({
        rasgo,
        dispersion,
        diferencia_buscada: diferencia,
        factor,
        motivo: `La dispersión entre docentes (${redondear(dispersion)}) es comparable a la diferencia buscada (${factor} × ${diferencia})`,
      });
    } else {
      r.retenidos.push(rasgo);
    }
  }
  return r;
}

const redondear = (v: number) => Math.round(v * 1000) / 1000;

/**
 * Calificación por variable (PRM-22): cada clase de la taxonomía es una variable para el
 * estudiante. Su nivel sale del % de unidades evaluables (eventos o la ejecución completa) que
 * quedaron dentro de banda o sin error. Sin unidades evaluadas: "No evaluado", nunca "Logrado".
 */
import type { ReglasMotor, ResultadoDiagnostico } from "./reglas.ts";

export const CLASES = ["ER-A", "ER-B", "ER-C", "ER-D", "ER-E", "ER-F"] as const;
export type Clase = (typeof CLASES)[number];
export type Nivel = "logrado" | "en-desarrollo" | "por-mejorar" | "no-evaluado";

/** PRM-22: Logrado ≥ 90 % · En desarrollo 70–89 % · Por mejorar < 70 %. */
export const PRM_22 = { logrado: 90, enDesarrollo: 70 } as const;

export function nivelPrm22(pct: number): Exclude<Nivel, "no-evaluado"> {
  if (pct >= PRM_22.logrado) return "logrado";
  if (pct >= PRM_22.enDesarrollo) return "en-desarrollo";
  return "por-mejorar";
}

export interface CalificacionVariable {
  clase: Clase;
  nivel: Nivel;
  /** % de unidades evaluadas dentro de banda o sin error; null si no se evaluó. */
  pct: number | null;
  evaluadas: number;
  motivo: string | null;
}

export function calificarVariables(
  r: ResultadoDiagnostico,
  reglas: ReglasMotor,
): CalificacionVariable[] {
  return CLASES.map((clase) => {
    const codigos = Object.keys(reglas.indicadores)
      .filter((c) => reglas.indicadores[c]!.clase === clase)
      .sort();
    const evaluadas = new Set(codigos.flatMap((c) => r.cobertura[c]?.evaluadas ?? []));
    const fuera = new Set(codigos.flatMap((c) => r.cobertura[c]?.fuera ?? []));
    if (!evaluadas.size) {
      const motivo =
        codigos.map((c) => r.indicadores[c]?.motivo).find(Boolean) ??
        "El conjunto de reglas no evalúa esta variable";
      return { clase, nivel: "no-evaluado", pct: null, evaluadas: 0, motivo };
    }
    const pct = Math.round(((evaluadas.size - fuera.size) / evaluadas.size) * 1000) / 10;
    return { clase, nivel: nivelPrm22(pct), pct, evaluadas: evaluadas.size, motivo: null };
  });
}

/**
 * Validación V2 dejando un docente fuera: con las bandas de los demás docentes, qué porcentaje
 * de los valores (ejecución × unidad) del docente excluido cae dentro de la banda, por rasgo.
 */
import { construirBandas, type Observacion, type Percentiles } from "./bandas.ts";

export interface ValidacionRasgo {
  rasgo: string;
  dentro: number;
  total: number;
  /** null si el docente excluido no tiene valores comparables en ese rasgo. */
  porcentaje: number | null;
}

export interface ValidacionDocente {
  docente: string;
  por_rasgo: ValidacionRasgo[];
}

export function validarDejandoUnDocenteFuera(
  observaciones: readonly Observacion[],
  percentiles: Percentiles,
  rasgos: readonly string[],
): ValidacionDocente[] {
  const docentes = [...new Set(observaciones.map((o) => o.docente))].sort();
  const pedidos = [...new Set(rasgos)].sort();
  return docentes.map((docente) => {
    const bandas = new Map(
      construirBandas(
        observaciones.filter((o) => o.docente !== docente),
        percentiles,
      ).map((b) => [JSON.stringify([b.unidad, b.rasgo]), b]),
    );
    const propias = observaciones.filter((o) => o.docente === docente);
    return {
      docente,
      por_rasgo: pedidos.map((rasgo) => {
        let dentro = 0;
        let total = 0;
        for (const o of propias) {
          if (o.rasgo !== rasgo) continue;
          const b = bandas.get(JSON.stringify([o.unidad, o.rasgo]));
          if (!b) continue;
          total++;
          if (o.valor >= b.inferior && o.valor <= b.superior) dentro++;
        }
        return {
          rasgo,
          dentro,
          total,
          porcentaje: total ? (100 * dentro) / total : null,
        };
      }),
    };
  });
}

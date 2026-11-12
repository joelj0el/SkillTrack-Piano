import { EventoResultado, type ResultadoReproceso } from "@skilltrack/contracts";
import { valoresDelIntento, type Observacion } from "@skilltrack/core";

/**
 * Valores por unidad y rasgo de una toma reprocesada, con la misma función que usa el
 * diagnóstico (valoresDelIntento): rasgos visuales, zona de la tecla, desfase entre manos
 * (PRM-11) y desvío del ataque (PRM-10) por evento; cambio de tempo (PRM-09) por ejecución.
 */
export function observacionesDeToma(docente: string, resultado: ResultadoReproceso): Observacion[] {
  const eventos = EventoResultado.array().parse(resultado.analisis.eventos);
  const tempo = resultado.analisis.acustico?.tempo as { cambioPct?: unknown } | null | undefined;
  const cambio = typeof tempo?.cambioPct === "number" ? tempo.cambioPct : null;
  return valoresDelIntento(eventos, cambio).map(({ unidad, rasgo, valor }) => ({
    docente,
    ejecucion: resultado.codigo_toma,
    unidad,
    rasgo,
    valor,
  }));
}

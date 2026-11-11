import { EventoResultado, type ResultadoReproceso } from "@skilltrack/contracts";
import { desviosDelPulso, type Observacion } from "@skilltrack/core";

/**
 * Valores por unidad y rasgo de una toma reprocesada:
 * - por evento evaluado ("e<idx>"): sus rasgos visuales, el desfase entre manos (PRM-11) y el
 *   desvío del ataque respecto de sus vecinos de la misma mano (PRM-10);
 * - por ejecución ("ejecucion"): el cambio de tempo entre el inicio y el final (PRM-09).
 */
export function observacionesDeToma(docente: string, resultado: ResultadoReproceso): Observacion[] {
  const ejecucion = resultado.codigo_toma;
  const obs: Observacion[] = [];
  const agregar = (unidad: string, rasgo: string, valor: number) =>
    obs.push({ docente, ejecucion, unidad, rasgo, valor });

  const eventos = EventoResultado.array()
    .parse(resultado.analisis.eventos)
    .filter((e) => e.estado === "evaluado")
    .sort((a, b) => a.idx - b.idx);
  for (const e of eventos) {
    for (const [rasgo, valor] of Object.entries(e.rasgos)) agregar(`e${e.idx}`, rasgo, valor);
    if (e.desfase_manos?.ms != null) agregar(`e${e.idx}`, "desfase_manos.ms", e.desfase_manos.ms);
  }
  for (const mano of ["MI", "MD"] as const) {
    const conAtaque = eventos.filter((e) => e.mano === mano && e.ataque_ms !== null);
    desviosDelPulso(conAtaque.map((e) => e.ataque_ms!)).forEach((d, i) => {
      if (d !== null && Number.isFinite(d))
        agregar(`e${conAtaque[i]!.idx}`, "ataque.desvio_pct", d);
    });
  }
  const tempo = resultado.analisis.acustico?.tempo as { cambioPct?: unknown } | null | undefined;
  if (typeof tempo?.cambioPct === "number")
    agregar("ejecucion", "cambio_tempo.pct", tempo.cambioPct);
  return obs;
}

/** V2 separada por origen: cada docente contra las bandas de los demás docentes del mismo origen. */
import type { Referencia, ResultadoReproceso } from "@skilltrack/contracts";
import { validarDejandoUnDocenteFuera } from "@skilltrack/core";
import { observacionesDeToma } from "../bandas/observaciones.ts";
import { ORIGENES, type Origen } from "./concordancia.ts";
import type { V2PorOrigen } from "./informe.ts";

export interface TomaDeDocente {
  docente: string;
  origen: Origen;
  resultado: ResultadoReproceso;
}

export function v2PorOrigen(tomas: readonly TomaDeDocente[], ref: Referencia): V2PorOrigen[] {
  const rasgos = [...new Set(ref.bandas.map((b) => b.rasgo))];
  return ORIGENES.flatMap((origen) => {
    const delOrigen = tomas.filter((t) => t.origen === origen);
    if (!delOrigen.length) return [];
    const obs = delOrigen.flatMap((t) => observacionesDeToma(t.docente, t.resultado));
    return [
      {
        origen,
        n_tomas: delOrigen.length,
        informe: {
          version_ejercicio: ref.version_ejercicio,
          version_referencia: ref.version,
          n_docentes: new Set(delOrigen.map((t) => t.docente)).size,
          por_docente: validarDejandoUnDocenteFuera(obs, ref.metodo.percentiles, rasgos),
        },
      },
    ];
  });
}

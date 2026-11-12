import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Referencia, type ParametrosBandas, type ResultadoReproceso } from "@skilltrack/contracts";
import {
  aplicarRetencion,
  construirBandas,
  validarDejandoUnDocenteFuera,
  type ValidacionDocente,
} from "@skilltrack/core";
import { ROL_DOCENTE } from "./consulta.ts";
import { observacionesDeToma } from "./observaciones.ts";

export interface TomaReprocesada {
  docente: string;
  resultado: ResultadoReproceso;
}

export interface PedidoReferencia {
  tomas: readonly TomaReprocesada[];
  parametros: ParametrosBandas;
  version: number;
  versionEjercicio: string;
  /** ISO 8601; lo pone quien llama para que el cálculo no lea el reloj. */
  generadaEn: string;
}

export function construirReferencia(p: PedidoReferencia): Referencia {
  if (!p.tomas.length) throw new Error("No hay tomas de referencia para construir las bandas");
  const nucleos = [...new Set(p.tomas.map((t) => t.resultado.versiones.nucleo))];
  if (nucleos.length > 1) {
    throw new Error(
      `Tomas reprocesadas con núcleos distintos (${nucleos.join(", ")}): reprocesa todas`,
    );
  }
  const ajenas = p.tomas.filter((t) => t.resultado.versiones.ejercicio !== p.versionEjercicio);
  if (ajenas.length) {
    throw new Error(
      `Tomas de otro ejercicio: ${ajenas.map((t) => t.resultado.codigo_toma).join(", ")}`,
    );
  }

  const obs = p.tomas.flatMap((t) => observacionesDeToma(t.docente, t.resultado));
  const { percentiles, factor_retencion, rasgos } = p.parametros;
  const retencion = aplicarRetencion(obs, rasgos, factor_retencion.valor);
  const descartados = new Set(retencion.descartados.map((d) => d.rasgo));
  const bandas = construirBandas(
    obs.filter((o) => !descartados.has(o.rasgo)),
    percentiles,
  );

  return Referencia.parse({
    formato: 1,
    version: p.version,
    version_ejercicio: p.versionEjercicio,
    n_docentes: new Set(p.tomas.map((t) => t.docente)).size,
    metodo: { unidad: "evento", percentiles, factor_retencion, parametros_rasgos: rasgos },
    bandas,
    rasgos_descartados: retencion.descartados,
    rasgos_sin_evaluar: retencion.sin_evaluar,
    origen: {
      campana: "A",
      rol: ROL_DOCENTE,
      origen_tomas: "real",
      tomas: p.tomas.map((t) => t.resultado.codigo_toma).sort(),
      version_nucleo: nucleos[0],
      versiones_reprocesamiento: [
        ...new Set(p.tomas.map((t) => t.resultado.versiones.reprocesamiento)),
      ].sort(),
      generada_en: p.generadaEn,
    },
  });
}

export function nombreReferencia(r: Referencia): string {
  return `referencia-${r.version_ejercicio.replace(/[^\w.-]+/g, "_")}-v${r.version}.json`;
}

/** Una versión escrita no se reemplaza: la siguiente lleva otro número. */
export async function escribirReferencia(carpeta: string, r: Referencia): Promise<string> {
  const ruta = join(carpeta, nombreReferencia(r));
  if (existsSync(ruta)) throw new Error(`Ya existe ${ruta}: usa otra versión`);
  await writeFile(ruta, `${JSON.stringify(r, null, 2)}\n`, { flag: "wx" });
  return ruta;
}

export interface InformeV2 {
  version_ejercicio: string;
  version_referencia: number;
  n_docentes: number;
  /** Porcentaje de los valores del docente excluido dentro de la banda de los demás, por rasgo. */
  por_docente: ValidacionDocente[];
}

/** V2: cada docente contra las bandas de los demás, en los rasgos con banda de la referencia. */
export function validacionV2(tomas: readonly TomaReprocesada[], ref: Referencia): InformeV2 {
  const obs = tomas.flatMap((t) => observacionesDeToma(t.docente, t.resultado));
  const rasgos = [...new Set(ref.bandas.map((b) => b.rasgo))];
  return {
    version_ejercicio: ref.version_ejercicio,
    version_referencia: ref.version,
    n_docentes: ref.n_docentes,
    por_docente: validarDejandoUnDocenteFuera(obs, ref.metodo.percentiles, rasgos),
  };
}

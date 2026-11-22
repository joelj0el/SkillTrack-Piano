/** Tablas en Markdown de V1: cifras tal como salen, con su n y aviso si hay pocas tomas. */
import type { Origen } from "./concordancia.ts";
import { MINIMO_TOMAS_V1, type FilaV1Visual } from "./v1.ts";

export const TITULO_ORIGEN: Record<Origen, string> = {
  real: "Origen: real",
  actuado: "Origen: actuado (errores representados a propósito)",
  sintetico: "Origen: sintético (generado por script; no son grabaciones)",
};

export const pct = (a: number, n: number) => (n ? `${((100 * a) / n).toFixed(1)} %` : "—");
export const num = (x: number | null, dec = 1) => (x === null ? "—" : x.toFixed(dec));

export function avisoTomas(n: number, que = "tomas anotadas"): string {
  return n < MINIMO_TOMAS_V1 ? `> **Aviso: n chico: ${n} ${que} (< ${MINIMO_TOMAS_V1}).**` : "";
}

export function tablaV1Visual(filas: readonly FilaV1Visual[]): string {
  const p = ["# V1 visual · Análisis frente a la anotación manual", ""];
  for (const f of filas) {
    p.push(`## ${TITULO_ORIGEN[f.origen]}`, "");
    const aviso = avisoTomas(f.tomas_anotadas);
    if (aviso) p.push(aviso, "");
    p.push(
      "| Medida | Valor | n |",
      "| --- | --- | --- |",
      `| Tomas válidas | ${pct(f.validas, f.tomas)} | ${f.validas} de ${f.tomas} (sin reprocesar: ${f.sin_reprocesar}) |`,
      `| Notas sin evento visual | ${pct(f.sin_evento_visual, f.notas)} | ${f.sin_evento_visual} de ${f.notas} notas de tomas válidas |`,
      `| Exactitud dedo–tecla | ${pct(f.dedo_tecla.aciertos, f.dedo_tecla.n)} | ${f.dedo_tecla.n} notas anotadas con dedo y tecla |`,
      `| Exactitud de la tecla | ${pct(f.tecla.aciertos, f.tecla.n)} | ${f.tecla.n} notas con la tecla anotada |`,
      `| Exactitud del dedo | ${pct(f.dedo.aciertos, f.dedo.n)} | ${f.dedo.n} notas con el dedo anotado |`,
      `| Exactitud de la digitación (correcta / incorrecta) | ${pct(f.digitacion.aciertos, f.digitacion.n)} | ${f.digitacion.n} notas; ${f.digitacion.no_detectadas} sin dedo detectado |`,
      `| Tiempo de extracción por toma (mediana / máximo) | ${num(f.extraccion.mediana_s)} s / ${num(f.extraccion.maximo_s)} s | ${f.extraccion.n} tomas con tiempo |`,
      `| Segundos de proceso por segundo de video | ${num(f.extraccion.por_s_video, 2)} | ${f.extraccion.n} tomas |`,
      "",
      `Tomas anotadas: ${f.tomas_anotadas}. Anotaciones sin nota esperada: ${f.anotaciones_sin_evento}. Notas cuya mano anotada difiere de la esperada: ${f.manos_distintas}.`,
      "",
    );
  }
  return `${p.join("\n").trimEnd()}\n`;
}

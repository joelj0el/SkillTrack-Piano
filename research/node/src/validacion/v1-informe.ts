/** Tablas en Markdown de V1: cifras tal como salen, con su n y aviso si hay pocas tomas. */
import type { Origen } from "./concordancia.ts";
import { exhaustividad, f1, precision, type Conteo, type FilaV1Acustica } from "./v1-acustica.ts";
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

const pctDe = (x: number | null) => (x === null ? "—" : `${(100 * x).toFixed(1)} %`);

export function tablaV1Acustica(filas: readonly FilaV1Acustica[], toleranciaMs: number): string {
  const p = [
    "# V1 acústica · Ataques y notas frente a la anotación manual",
    "",
    `Un ataque detectado acierta si cae a ± ${toleranciaMs} ms de uno anotado (uno a uno). Una nota acierta si además la clase de altura coincide; las notas dudosas no cuentan como detectadas.`,
    "",
  ];
  for (const f of filas) {
    p.push(`## ${TITULO_ORIGEN[f.origen]} · instrumento: ${f.instrumento}`, "");
    const aviso = avisoTomas(f.tomas);
    if (aviso) p.push(aviso, "");
    const fila = (nombre: string, c: Conteo | null) =>
      c
        ? `| ${nombre} | ${pctDe(precision(c))} | ${pctDe(exhaustividad(c))} | ${pctDe(f1(c))} | VP ${c.vp} · FP ${c.fp} · FN ${c.fn} |`
        : `| ${nombre} | — | — | — | sin notas anotadas |`;
    p.push(
      "| Medida | Precisión | Exhaustividad | F1 | n |",
      "| --- | --- | --- | --- | --- |",
      fila("Ataques", f.ataques),
      fila("Notas", f.notas),
      "",
      `Error de ataque (detectado − anotado): media ${num(f.error_ms.media)} ms · mediana del valor absoluto ${num(f.error_ms.mediana_abs)} ms · máximo ${num(f.error_ms.maximo_abs)} ms (n = ${f.error_ms.n} ataques emparejados, ${f.tomas} tomas).`,
      "",
    );
  }
  return `${p.join("\n").trimEnd()}\n`;
}

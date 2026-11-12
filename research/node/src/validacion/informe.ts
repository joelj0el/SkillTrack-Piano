/** Tablas en Markdown de V2, V3a y V3b: separadas por origen, con n y avisos de n chico. */
import type { InformeV2 } from "../bandas/referencia.ts";
import type { FilaConcordancia, FilaEtiquetadores, Origen } from "./concordancia.ts";

/** Umbrales de G-2 (suficiencia de datos): ≥ 20 participantes y ≥ 8 casos por clase. */
export const G2_PARTICIPANTES = 20;
export const G2_POR_CLASE = 8;
/** HU-22: la referencia se construye con al menos 5 docentes. */
export const MINIMO_DOCENTES = 5;

const TITULO_ORIGEN: Record<Origen, string> = {
  real: "Origen: real",
  actuado: "Origen: actuado (errores representados a propósito)",
  sintetico: "Origen: sintético (generado por script; no son grabaciones)",
};

const pct = (x: number | null) => (x === null ? "—" : `${(100 * x).toFixed(1)} %`);
const k = (x: number | null) => (x === null ? "—" : x.toFixed(2));

function avisoConcordancia(f: { participantes?: number; positivos?: number; n: number }): string {
  const avisos: string[] = [];
  if (f.n === 0) return "Sin casos";
  if (f.participantes !== undefined && f.participantes < G2_PARTICIPANTES) {
    avisos.push(`n chico: ${f.participantes} participantes (< ${G2_PARTICIPANTES})`);
  }
  if (f.positivos !== undefined && f.positivos < G2_POR_CLASE) {
    avisos.push(`n chico: ${f.positivos} casos con la clase (< ${G2_POR_CLASE})`);
  }
  return avisos.join("; ");
}

const NOTA_KAPPA =
  "κ se calcula solo con etiquetas reales; en los demás orígenes se informa el acuerdo.";

export function tablaReglas(titulo: string, filas: readonly FilaConcordancia[]): string {
  const partes = [`# ${titulo}`, "", NOTA_KAPPA, ""];
  const modos = [...new Set(filas.map((f) => f.modo))];
  for (const origen of [...new Set(filas.map((f) => f.origen))]) {
    partes.push(`## ${TITULO_ORIGEN[origen]}`, "");
    partes.push(
      `| ${modos.length > 1 ? "Modo | " : ""}Clase | n | Participantes | Con la clase (etiquetas) | Detectadas (reglas) | Sin consenso | Acuerdo | κ de Cohen | Aviso |`,
      `|${modos.length > 1 ? " --- |" : ""} --- | --- | --- | --- | --- | --- | --- | --- | --- |`,
    );
    for (const f of filas.filter((x) => x.origen === origen)) {
      const modo = modos.length > 1 ? `${f.modo} | ` : "";
      if (!f.evaluable) {
        partes.push(
          `| ${modo}${f.clase} | 0 | — | — | — | — | — | — | No evaluable: ${f.motivo} |`,
        );
        continue;
      }
      partes.push(
        `| ${modo}${f.clase} | ${f.n} | ${f.participantes} | ${f.positivos} | ${f.detectados} | ${f.sin_consenso} | ${pct(f.concordancia.acuerdo)} | ${origen === "real" ? k(f.concordancia.kappa) : "no aplica"} | ${avisoConcordancia(f)} |`,
      );
    }
    partes.push("");
  }
  return `${partes.join("\n").trimEnd()}\n`;
}

export function tablaEtiquetadores(filas: readonly FilaEtiquetadores[]): string {
  const partes = [
    "# V3a · Concordancia entre etiquetadores (etiquetas_1 y etiquetas_2)",
    "",
    "κ de Fleiss sobre la ronda doble. " + NOTA_KAPPA,
    "",
  ];
  for (const origen of [...new Set(filas.map((f) => f.origen))]) {
    partes.push(`## ${TITULO_ORIGEN[origen]}`, "");
    partes.push(
      "| Clase | n (ejecuciones con doble etiqueta) | Acuerdo | κ de Fleiss | Aviso |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const f of filas.filter((x) => x.origen === origen)) {
      const aviso =
        f.n === 0 ? "Sin casos" : f.n < G2_POR_CLASE ? `n chico (< ${G2_POR_CLASE})` : "";
      partes.push(
        `| ${f.clase} | ${f.n} | ${pct(f.concordancia.acuerdo)} | ${origen === "real" ? k(f.concordancia.kappa) : "no aplica"} | ${aviso} |`,
      );
    }
    partes.push("");
  }
  return `${partes.join("\n").trimEnd()}\n`;
}

export interface V2PorOrigen {
  origen: Origen;
  n_tomas: number;
  informe: InformeV2;
}

export function tablaV2(grupos: readonly V2PorOrigen[]): string {
  const partes = [
    "# V2 · Especificidad de las bandas dejando un docente fuera",
    "",
    "Porcentaje de los valores de cada docente que cae dentro de las bandas construidas con los demás docentes del mismo origen.",
    "",
  ];
  for (const g of grupos) {
    partes.push(`## ${TITULO_ORIGEN[g.origen]}`, "");
    partes.push(`Docentes: ${g.informe.n_docentes} · tomas: ${g.n_tomas}`, "");
    if (g.informe.n_docentes < MINIMO_DOCENTES) {
      partes.push(
        `> Aviso: n chico, ${g.informe.n_docentes} docentes (la referencia pide al menos ${MINIMO_DOCENTES}).`,
        "",
      );
    }
    partes.push(
      "| Docente fuera | Rasgo | Dentro / total | Especificidad | Aviso |",
      "| --- | --- | --- | --- | --- |",
    );
    for (const d of g.informe.por_docente) {
      for (const r of d.por_rasgo) {
        const esp = r.porcentaje === null ? "—" : `${r.porcentaje.toFixed(1)} %`;
        const aviso = r.total === 0 ? "Sin valores comparables" : "";
        partes.push(`| ${d.docente} | ${r.rasgo} | ${r.dentro} / ${r.total} | ${esp} | ${aviso} |`);
      }
    }
    partes.push("");
  }
  return `${partes.join("\n").trimEnd()}\n`;
}

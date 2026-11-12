/**
 * V3a y V3b: el diagnóstico por reglas de cada toma etiquetada frente al consenso de los
 * etiquetadores, por origen (real, actuado, sintetico) y por clase. κ solo con etiquetas reales.
 */
import { EventoResultado, type ResultadoReproceso } from "@skilltrack/contracts";
import { diagnosticar, type BandaDeReferencia, type ReglasMotor } from "@skilltrack/core";
import { consensoDe, consensos, juiciosDobles, type FilaEtiqueta } from "./etiquetas.ts";
import { kappaDeCohen, kappaDeFleiss, type Concordancia } from "./kappa.ts";

export const ORIGENES = ["real", "actuado", "sintetico"] as const;
export type Origen = (typeof ORIGENES)[number];
export type Modo = "V" | "A" | "VA";

export interface TomaEtiquetada {
  codigo_toma: string;
  participante: string;
  origen: Origen;
  resultado: ResultadoReproceso;
}

export interface FilaConcordancia {
  origen: Origen;
  modo: Modo;
  clase: string;
  /** false si ninguna toma pudo evaluar la clase (por diseño o por el modo). */
  evaluable: boolean;
  motivo: string | null;
  n: number;
  participantes: number;
  /** Casos con la clase presente según el consenso de los etiquetadores. */
  positivos: number;
  detectados: number;
  sin_consenso: number;
  concordancia: Concordancia;
}

export interface FilaEtiquetadores {
  origen: Origen;
  clase: string;
  n: number;
  concordancia: Concordancia;
}

const soloReal = (origen: Origen, c: Concordancia): Concordancia =>
  origen === "real" ? c : { ...c, kappa: null };

function cambioTempo(r: ResultadoReproceso): number | null {
  const tempo = r.analisis.acustico?.tempo as { cambioPct?: unknown } | null | undefined;
  return typeof tempo?.cambioPct === "number" ? tempo.cambioPct : null;
}

export function concordanciaReglas(
  tomas: readonly TomaEtiquetada[],
  etiquetas: readonly FilaEtiqueta[],
  referencia: { version: number; bandas: readonly BandaDeReferencia[] },
  reglas: ReglasMotor,
  modo: Modo,
  clases: readonly string[],
): FilaConcordancia[] {
  const consenso = consensos(etiquetas);
  const diagnosticos = tomas.map((t) => ({
    toma: t,
    r: diagnosticar({
      eventos: EventoResultado.array().parse(t.resultado.analisis.eventos),
      cambioTempoPct: cambioTempo(t.resultado),
      referencia,
      reglas,
      modo,
    }),
  }));
  const filas: FilaConcordancia[] = [];
  for (const origen of ORIGENES) {
    const delOrigen = diagnosticos.filter((d) => d.toma.origen === origen);
    if (!delOrigen.length) continue;
    for (const clase of clases) {
      const indicadores = Object.entries(reglas.indicadores).filter(([, i]) => i.clase === clase);
      const pares: [boolean, boolean][] = [];
      const participantes = new Set<string>();
      let sinConsenso = 0;
      let motivo: string | null = null;
      for (const { toma, r } of delOrigen) {
        const estados = indicadores.map(([codigo]) => r.indicadores[codigo]);
        const comparable = estados.some((e) => e && e.estado !== "no-evaluable");
        if (!comparable) {
          motivo ??= estados.find((e) => e?.motivo)?.motivo ?? "Sin reglas para esta clase";
          continue;
        }
        const c = consensoDe(consenso, toma.codigo_toma, clase);
        if (c.tipo === "sin-consenso") sinConsenso++;
        if (c.tipo !== "consenso") continue;
        const detectada = r.diagnosticos.some((d) => d.clase === clase);
        pares.push([detectada, c.presente]);
        participantes.add(toma.participante);
      }
      filas.push({
        origen,
        modo,
        clase,
        evaluable: motivo === null || pares.length > 0,
        motivo: pares.length > 0 ? null : motivo,
        n: pares.length,
        participantes: participantes.size,
        positivos: pares.filter(([, e]) => e).length,
        detectados: pares.filter(([d]) => d).length,
        sin_consenso: sinConsenso,
        concordancia: soloReal(origen, kappaDeCohen(pares)),
      });
    }
  }
  return filas;
}

/** κ entre etiquetadores (ronda doble: etiquetas_1 y etiquetas_2), por origen y clase. */
export function concordanciaEtiquetadores(
  tomas: readonly TomaEtiquetada[],
  etiquetas: readonly FilaEtiqueta[],
  clases: readonly string[],
): FilaEtiquetadores[] {
  const filas: FilaEtiquetadores[] = [];
  for (const origen of ORIGENES) {
    const codigos = new Set(tomas.filter((t) => t.origen === origen).map((t) => t.codigo_toma));
    if (!codigos.size) continue;
    for (const clase of clases) {
      const juicios = juiciosDobles(etiquetas, clase, codigos);
      const c = kappaDeFleiss(juicios);
      filas.push({ origen, clase, n: c.n, concordancia: soloReal(origen, c) });
    }
  }
  return filas;
}

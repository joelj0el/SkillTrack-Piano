/**
 * HU-33: exportación por ejecución para el dataset del clasificador (research/python).
 * Solo lleva seudónimos, estados por evento, desviaciones respecto de la referencia, el
 * diagnóstico de las reglas congeladas y las etiquetas: nada de video, audio ni rutas.
 */
import { EventoResultado, type ResultadoReproceso } from "@skilltrack/contracts";
import {
  desviaciones,
  diagnosticar,
  valoresDelIntento,
  type BandaDeReferencia,
  type ReglasMotor,
} from "@skilltrack/core";
import type { Origen } from "../validacion/concordancia.ts";
import { consensoDe, consensos, type FilaEtiqueta } from "../validacion/etiquetas.ts";

export interface EjecucionExportada {
  codigo_toma: string;
  sujeto: string;
  origen: Origen;
  version_ejercicio: string;
  /** Solo las filas sintéticas la llenan (en research/python). */
  fila_origen: string | null;
  eventos: {
    idx: number;
    mano: "MI" | "MD" | null;
    estado: string;
    nota: string;
    nota_midi: number | null;
    tecla_midi: number | null;
    dedo: string;
    desfase: string | null;
  }[];
  desviaciones: {
    rasgo: string;
    unidad: string;
    valor: number;
    posicion: string;
    modalidad: string;
    inferior: number | null;
    superior: number | null;
  }[];
  cambio_tempo_pct: number | null;
  reglas: { version: number; referencia: number; modo: "VA"; clases: string[] };
  /** Consenso por clase: true/false; null sin consenso. Las clases sin etiqueta no aparecen. */
  etiquetas: Record<string, boolean | null>;
  /** Juicios de la ronda doble por clase (etiquetas_1 y etiquetas_2), para κ entre etiquetadores. */
  juicios_dobles: Record<string, boolean[]>;
}

export interface PedidoExportacion {
  codigo_toma: string;
  sujeto: string;
  origen: Origen;
  version_ejercicio: string;
  resultado: ResultadoReproceso;
}

function cambioTempo(r: ResultadoReproceso): number | null {
  const tempo = r.analisis.acustico?.tempo as { cambioPct?: unknown } | null | undefined;
  return typeof tempo?.cambioPct === "number" ? tempo.cambioPct : null;
}

export function exportarEjecuciones(
  tomas: readonly PedidoExportacion[],
  etiquetas: readonly FilaEtiqueta[],
  referencia: { version: number; bandas: readonly BandaDeReferencia[] },
  reglas: ReglasMotor,
  clases: readonly string[],
): EjecucionExportada[] {
  const consenso = consensos(etiquetas);
  return tomas.map((t) => {
    const eventos = EventoResultado.array().parse(t.resultado.analisis.eventos);
    const cambio = cambioTempo(t.resultado);
    const r = diagnosticar({
      eventos,
      cambioTempoPct: cambio,
      referencia,
      reglas,
      modo: "VA",
    });
    const etiquetasDeToma: Record<string, boolean | null> = {};
    const juicios: Record<string, boolean[]> = {};
    for (const clase of clases) {
      const c = consensoDe(consenso, t.codigo_toma, clase);
      if (c.tipo !== "sin-etiqueta")
        etiquetasDeToma[clase] = c.tipo === "consenso" ? c.presente : null;
      const dobles = etiquetas
        .filter(
          (e) => e.codigo_toma === t.codigo_toma && e.clase_error === clase && e.ronda === "doble",
        )
        .map((e) => e.presente);
      if (dobles.length === 2) juicios[clase] = dobles;
    }
    return {
      codigo_toma: t.codigo_toma,
      sujeto: t.sujeto,
      origen: t.origen,
      version_ejercicio: t.version_ejercicio,
      fila_origen: null,
      eventos: eventos.map((e) => ({
        idx: e.idx,
        mano: e.mano,
        estado: e.estado,
        nota: e.nota.estado,
        nota_midi: e.nota.midi,
        tecla_midi: e.tecla.midi,
        dedo: e.dedo.estado,
        desfase: e.desfase_manos?.estado ?? null,
      })),
      desviaciones: desviaciones(valoresDelIntento(eventos, cambio), referencia.bandas).map(
        (d) => ({
          rasgo: d.rasgo,
          unidad: d.unidad,
          valor: d.valor,
          posicion: d.posicion,
          modalidad: d.modalidad,
          inferior: d.banda?.inferior ?? null,
          superior: d.banda?.superior ?? null,
        }),
      ),
      cambio_tempo_pct: cambio,
      reglas: {
        version: reglas.version,
        referencia: referencia.version,
        modo: "VA",
        clases: [...new Set(r.diagnosticos.map((d) => d.clase))].sort(),
      },
      etiquetas: etiquetasDeToma,
      juicios_dobles: juicios,
    };
  });
}

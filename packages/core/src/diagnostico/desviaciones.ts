/**
 * E12: valores medidos del intento y su alejamiento de la banda de la referencia. Los mismos
 * valores sirven para construir las bandas (research/node) y para diagnosticar (reglas).
 */
import type { Modalidad } from "../alineacion/manos.ts";
import { desviosDelPulso } from "../audio/tempo.ts";

/** Lo que el diagnóstico necesita de cada evento registrado (EventoResultado v2). */
export interface EventoMedible {
  idx: number;
  mano: "MI" | "MD" | null;
  estado: "evaluado" | "no-evaluable";
  ataque_ms: number | null;
  modalidad: Modalidad | null;
  desfase_manos: { ms: number | null; modalidad: Modalidad | null } | null;
  tecla: { zona: number | null };
  rasgos: Record<string, number>;
}

export interface ValorMedido {
  /** "e<idx>" por evento; "ejecucion" para las medidas de todo el intento. */
  unidad: string;
  idx: number | null;
  rasgo: string;
  valor: number;
  /** De dónde sale el dato: visión, audio o ambos. */
  modalidad: Modalidad;
}

export const UNIDAD_EJECUCION = "ejecucion";
export const unidadDeEvento = (idx: number) => `e${idx}`;

export function valoresDelIntento(
  eventos: readonly EventoMedible[],
  cambioTempoPct: number | null,
): ValorMedido[] {
  const valores: ValorMedido[] = [];
  const evaluados = eventos.filter((e) => e.estado === "evaluado").sort((a, b) => a.idx - b.idx);
  const agregar = (e: EventoMedible, rasgo: string, valor: number, modalidad: Modalidad) =>
    valores.push({ unidad: unidadDeEvento(e.idx), idx: e.idx, rasgo, valor, modalidad });

  for (const e of evaluados) {
    for (const [rasgo, valor] of Object.entries(e.rasgos)) agregar(e, rasgo, valor, "V");
    if (e.tecla.zona !== null) agregar(e, "tecla.zona", e.tecla.zona, "V");
    if (e.desfase_manos?.ms != null) {
      agregar(e, "desfase_manos.ms", e.desfase_manos.ms, e.desfase_manos.modalidad ?? "VA");
    }
  }
  // PRM-10: desvío de cada ataque respecto de sus vecinos de la misma mano.
  for (const mano of ["MI", "MD"] as const) {
    const conAtaque = evaluados.filter((e) => e.mano === mano && e.ataque_ms !== null);
    desviosDelPulso(conAtaque.map((e) => e.ataque_ms!)).forEach((d, i) => {
      const e = conAtaque[i]!;
      if (d !== null && Number.isFinite(d)) agregar(e, "ataque.desvio_pct", d, e.modalidad ?? "A");
    });
  }
  if (cambioTempoPct !== null) {
    valores.push({
      unidad: UNIDAD_EJECUCION,
      idx: null,
      rasgo: "cambio_tempo.pct",
      valor: cambioTempoPct,
      modalidad: "A",
    });
  }
  return valores;
}

export interface BandaDeReferencia {
  unidad: string;
  rasgo: string;
  inferior: number;
  superior: number;
  centro: number;
}

export interface Desviacion extends ValorMedido {
  posicion: "dentro" | "encima" | "debajo" | "sin-banda";
  banda: BandaDeReferencia | null;
  /** Distancia fuera de la banda en anchos de banda; null sin banda o con ancho cero. */
  magnitud: number | null;
}

export function desviaciones(
  valores: readonly ValorMedido[],
  bandas: readonly BandaDeReferencia[],
): Desviacion[] {
  const porClave = new Map(bandas.map((b) => [`${b.unidad}\u0000${b.rasgo}`, b]));
  return valores.map((v) => {
    const banda = porClave.get(`${v.unidad}\u0000${v.rasgo}`) ?? null;
    if (!banda) return { ...v, posicion: "sin-banda", banda: null, magnitud: null };
    const ancho = banda.superior - banda.inferior;
    const fuera =
      v.valor > banda.superior
        ? { posicion: "encima" as const, distancia: v.valor - banda.superior }
        : v.valor < banda.inferior
          ? { posicion: "debajo" as const, distancia: banda.inferior - v.valor }
          : null;
    if (!fuera) return { ...v, posicion: "dentro", banda, magnitud: 0 };
    return {
      ...v,
      posicion: fuera.posicion,
      banda,
      magnitud: ancho > 0 ? fuera.distancia / ancho : null,
    };
  });
}

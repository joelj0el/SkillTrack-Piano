/**
 * E9b (IND-B3) y E11. Siempre sobre los tiempos crudos de los ataques, nunca sobre la predicción
 * reanclada del alineamiento.
 *
 * Desfase entre manos: en cada instante en que las dos manos deben tocar juntas, el audio mide
 * los ms entre sus ataques. La mano que llega tarde sale de la banda de registro del segundo
 * ataque (la izquierda suena más grave), con la visión como confirmación; si no coinciden, queda
 * sin identificar. Si una mano toca cada nota cuando la otra ya va por la siguiente, va "una nota
 * atrás". La visión, a 15–30 fotogramas por segundo, no mide asincronías: sin audio solo se
 * reconoce "una nota atrás".
 */
import type { AlineamientoPorMano, EventoAlineado, Modalidad } from "../alineacion/manos.ts";
import { VENTANA_ATRIBUCION } from "../alineacion/manos.ts";
import type { NotaEsperada } from "../ejercicio/escala.ts";
import type { EventoVisual } from "../rasgos/dedos.ts";
import type { Dedo } from "../rasgos/rasgos.ts";
import type { IdMano } from "../rasgos/manos.ts";

/** PRM-11, PROPUESTA provisional hasta la It-4: más de 50 ms entre manos es desfase. */
export const UMBRAL_MANOS_DESFASADAS = 0.05;

export type EstadoDesfase = "a-tiempo" | "tarde" | "una-nota-atras" | "no-medible";

export interface DesfaseManos {
  estado: EstadoDesfase;
  ms: number | null;
  /** Mano que llega tarde; null si no se pudo identificar o no aplica. */
  manoTarde: IdMano | null;
  modalidad: Modalidad | null;
}

/** Banda de registro del ataque `ataque` respecto del par esperado (lo calcula el audio). */
export type BandaDeAtaque = (
  ataque: number,
  midiGrave: number,
  midiAgudo: number,
) => "grave" | "aguda" | null;

const NO_MEDIBLE: DesfaseManos = {
  estado: "no-medible",
  ms: null,
  manoTarde: null,
  modalidad: null,
};

function manoTardePorAudio(
  tarde: EventoAlineado,
  midiGrave: number,
  midiAgudo: number,
  banda?: BandaDeAtaque,
): IdMano | null {
  const ataque = tarde.golpe?.ataque;
  if (!banda || ataque === null || ataque === undefined) return null;
  const b = banda(ataque, midiGrave, midiAgudo);
  return b === "grave" ? "MI" : b === "aguda" ? "MD" : null;
}

function manoTardePorVision(
  mi: EventoAlineado,
  md: EventoAlineado,
  visuales: readonly EventoVisual[],
): IdMano | null {
  const t = (e: EventoAlineado) =>
    e.golpe?.visual === null || e.golpe?.visual === undefined ? null : visuales[e.golpe.visual]!.t;
  const tMi = t(mi);
  const tMd = t(md);
  if (tMi === null || tMd === null || tMi === tMd) return null;
  return tMi > tMd ? "MI" : "MD";
}

/** Desfase de cada evento que se toca a manos juntas, por su idx. */
export function desfaseEntreManos(
  esperadas: readonly NotaEsperada[],
  alineado: AlineamientoPorMano,
  visuales: readonly EventoVisual[],
  banda?: BandaDeAtaque,
  umbral = UMBRAL_MANOS_DESFASADAS,
): Map<number, DesfaseManos> {
  const resultado = new Map<number, DesfaseManos>();
  const evento = new Map(alineado.eventos.map((e) => [e.idx, e]));
  const porMano = (mano: IdMano) => esperadas.filter((n) => n.mano === mano);
  const mi = porMano("MI");
  const md = porMano("MD");
  const siguiente = (lista: NotaEsperada[], k: number) => {
    const n = lista[k + 1];
    return n ? evento.get(n.idx) : undefined;
  };

  mi.forEach((nMi, k) => {
    const kMd = md.findIndex((n) => n.tiempoBeats === nMi.tiempoBeats);
    if (kMd < 0) return;
    const nMd = md[kMd]!;
    const eMi = evento.get(nMi.idx);
    const eMd = evento.get(nMd.idx);
    const asignar = (d: DesfaseManos) => {
      resultado.set(nMi.idx, d);
      resultado.set(nMd.idx, d);
    };
    if (!eMi?.golpe || !eMd?.golpe) return asignar(NO_MEDIBLE);
    const delta = eMi.golpe.t - eMd.golpe.t;

    // Una nota atrás: la mano que llega tarde coincide con la nota siguiente de la otra.
    if (Math.abs(delta) > umbral) {
      const [tarde, otra, kOtra, listaOtra] = delta > 0 ? [eMi, "MD", kMd, md] : [eMd, "MI", k, mi];
      const proxima = siguiente(listaOtra as NotaEsperada[], kOtra as number);
      if (proxima?.golpe && Math.abs(tarde.golpe!.t - proxima.golpe.t) <= umbral) {
        return asignar({
          estado: "una-nota-atras",
          ms: Math.abs(delta) * 1000,
          manoTarde: otra === "MD" ? "MI" : "MD",
          modalidad: "V",
        });
      }
    }

    const conAudio = eMi.golpe.ataque !== null && eMd.golpe.ataque !== null;
    if (!conAudio) return asignar(NO_MEDIBLE);
    const ms = Math.abs(delta) * 1000;
    if (eMi.golpe.ataque === eMd.golpe.ataque || Math.abs(delta) <= umbral) {
      return asignar({ estado: "a-tiempo", ms, manoTarde: null, modalidad: "A" });
    }
    const tarde = delta > 0 ? eMi : eMd;
    const grave = Math.min(nMi.midi, nMd.midi);
    const agudo = Math.max(nMi.midi, nMd.midi);
    const porAudio = manoTardePorAudio(tarde, grave, agudo, banda);
    const porVision = manoTardePorVision(eMi, eMd, visuales);
    if (porAudio && porVision) {
      return asignar({
        estado: "tarde",
        ms,
        manoTarde: porAudio === porVision ? porAudio : null,
        modalidad: "VA",
      });
    }
    asignar({
      estado: "tarde",
      ms,
      manoTarde: porAudio ?? porVision,
      modalidad: porAudio ? "A" : porVision ? "V" : "A",
    });
  });
  return resultado;
}

export interface DedoAtribuido {
  dedo: Dedo | null;
  tecla: number | null;
  /** Posición del contacto a lo largo de la tecla (0 = borde frontal). */
  zona: number | null;
  /** Índice del evento visual elegido. */
  visual: number | null;
}

/**
 * E11: el dedo atribuido es el que más bajó sobre la tecla esperada en la ventana del ataque,
 * buscado solo en la mano que el alineamiento asignó al evento. Si ningún dedo cayó sobre esa
 * tecla, se usa el evento visual del golpe (el dedo tocó otra tecla).
 */
export function atribuirDedo(
  evento: EventoAlineado,
  esperada: NotaEsperada,
  visuales: readonly EventoVisual[],
  ventana = VENTANA_ATRIBUCION,
): DedoAtribuido {
  const golpe = evento.golpe;
  if (!golpe) return { dedo: null, tecla: null, zona: null, visual: null };
  let elegido: number | null = null;
  visuales.forEach((v, i) => {
    if (v.mano !== evento.mano || v.midi !== esperada.midi) return;
    if (Math.abs(v.t - golpe.t) > ventana + 1e-9) return;
    if (elegido === null || (v.profundidad ?? 0) > (visuales[elegido]!.profundidad ?? 0)) {
      elegido = i;
    }
  });
  elegido ??= golpe.visual;
  if (elegido === null) return { dedo: null, tecla: null, zona: null, visual: null };
  const v = visuales[elegido]!;
  return { dedo: v.dedo, tecla: v.midi, zona: v.zona ?? null, visual: elegido };
}

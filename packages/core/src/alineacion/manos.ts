/**
 * E9 — Alineamiento por mano. A manos juntas cada mano se empareja con su propia secuencia
 * esperada; cada ataque se atribuye a una mano por la tecla bajo el dedo (visión). Así, una mano
 * que va una nota atrás no se confunde con notas incorrectas (H4-09).
 *
 * El emparejamiento es por ventana alrededor de cada nota esperada, con reanclaje local del tempo:
 * cada nota emparejada corrige la predicción de la siguiente. El reanclaje solo sirve para
 * emparejar: los tiempos de cada golpe son los crudos y las medidas temporales (E9b) se hacen
 * sobre ellos.
 */
import type { NotaEsperada } from "../ejercicio/escala.ts";
import type { EventoVisual } from "../rasgos/dedos.ts";
import type { IdMano } from "../rasgos/manos.ts";

export type Modalidad = "A" | "V" | "VA";

export interface AtaqueAudio {
  t: number;
  /** Clase de altura oída, o null si quedó dudosa. */
  clase: number | null;
}

/** Un ataque candidato para una mano. */
export interface Golpe {
  /** Tiempo crudo del ataque (s): el del audio si lo hay; si no, el de la visión. */
  t: number;
  /** Tecla bajo el dedo (visión), o null. */
  midi: number | null;
  /** Clase de altura oída (audio), o null. */
  clase: number | null;
  modalidad: Modalidad;
  /** Índice del ataque de audio y del evento visual de los que sale. */
  ataque: number | null;
  visual: number | null;
}

export type EstadoNota = "correcta" | "incorrecta" | "dudosa" | "faltante";

export interface EventoAlineado {
  idx: number;
  mano: IdMano;
  golpe: Golpe | null;
  estado: EstadoNota;
}

export interface AlineamientoPorMano {
  eventos: EventoAlineado[];
  /** Golpes que no correspondieron a ninguna nota esperada. */
  extras: Record<IdMano, Golpe[]>;
}

/** PROPUESTA provisional: ventana para atribuir un evento visual a un ataque (s), como la fusión. */
export const VENTANA_ATRIBUCION = 0.08;
/** PROPUESTA provisional: media ventana de emparejamiento, en intervalos esperados entre notas. */
export const VENTANA_NOTAS = 1.5;

const MANOS_DE: Record<"MI" | "MD" | "juntas", IdMano[]> = {
  MI: ["MI"],
  MD: ["MD"],
  juntas: ["MI", "MD"],
};

/**
 * Golpes de cada mano. Cada evento visual se asigna al ataque de audio más cercano; un ataque
 * recibe la mano de los eventos visuales que le tocaron. Un ataque en octava (las dos manos a la
 * vez) sirve a las dos. A una mano que la cámara no vio en ese ataque se le ofrece solo el audio;
 * si la otra mano sí se vio, sin clase de altura, porque el sonido puede ser de la otra. Sin
 * audio, los golpes son los eventos visuales.
 */
export function golpesPorMano(
  ataques: readonly AtaqueAudio[],
  visuales: readonly EventoVisual[],
  manos: "MI" | "MD" | "juntas",
  ventana = VENTANA_ATRIBUCION,
): Record<IdMano, Golpe[]> {
  const deLaTarea = MANOS_DE[manos];
  const golpes: Record<IdMano, Golpe[]> = { MI: [], MD: [] };
  if (ataques.length === 0) {
    visuales.forEach((v, i) => {
      if (!deLaTarea.includes(v.mano)) return;
      const clase = v.midi === null ? null : v.midi % 12;
      golpes[v.mano].push({ t: v.t, midi: v.midi, clase, modalidad: "V", ataque: null, visual: i });
    });
  } else {
    const visualesDe = new Map<number, number[]>();
    visuales.forEach((v, i) => {
      if (!deLaTarea.includes(v.mano)) return;
      let mejor = -1;
      ataques.forEach((a, j) => {
        const d = Math.abs(a.t - v.t);
        if (d <= ventana + 1e-9 && (mejor < 0 || d < Math.abs(ataques[mejor]!.t - v.t))) mejor = j;
      });
      if (mejor >= 0) visualesDe.set(mejor, [...(visualesDe.get(mejor) ?? []), i]);
    });
    ataques.forEach((a, j) => {
      const propios = visualesDe.get(j) ?? [];
      const atribuidas = deLaTarea.filter((m) => propios.some((i) => visuales[i]!.mano === m));
      for (const mano of atribuidas) {
        const i = propios
          .filter((k) => visuales[k]!.mano === mano)
          .reduce((x, y) =>
            Math.abs(visuales[y]!.t - a.t) < Math.abs(visuales[x]!.t - a.t) ? y : x,
          );
        const midi = visuales[i]!.midi;
        golpes[mano].push({ t: a.t, midi, clase: a.clase, modalidad: "VA", ataque: j, visual: i });
      }
      // Las manos de la tarea que la cámara no vio en este ataque reciben solo el audio. Si la
      // vio otra mano, el sonido puede ser de esa: la clase no se atribuye y la nota queda dudosa.
      for (const mano of deLaTarea.filter((m) => !atribuidas.includes(m))) {
        golpes[mano].push({
          t: a.t,
          midi: null,
          clase: atribuidas.length === 0 ? a.clase : null,
          modalidad: "A",
          ataque: j,
          visual: null,
        });
      }
    });
  }
  for (const mano of ["MI", "MD"] as const) golpes[mano].sort((a, b) => a.t - b.t);
  return golpes;
}

/** true si el golpe es la nota esperada, false si es otra, null si no se puede saber. */
function coincide(g: Golpe, n: NotaEsperada): boolean | null {
  if (g.midi !== null) return g.midi === n.midi;
  if (g.clase !== null) return g.clase === n.claseAltura;
  return null;
}

function alinearUnaMano(
  esperadas: readonly NotaEsperada[],
  golpes: readonly Golpe[],
  periodo: number,
): { eventos: EventoAlineado[]; extras: Golpe[] } {
  const eventos: EventoAlineado[] = [];
  const usados = new Set<number>();
  let desde = 0;
  let ancla: { t: number; beats: number } | null = null;

  esperadas.forEach((n, k) => {
    const vecino = esperadas[k + 1] ?? esperadas[k - 1];
    const paso = Math.max(
      Math.abs((vecino?.tiempoBeats ?? n.tiempoBeats + 1) - n.tiempoBeats),
      1e-3,
    );
    const ventana = VENTANA_NOTAS * paso * periodo;
    const prediccion: number | null = ancla
      ? ancla.t + (n.tiempoBeats - ancla.beats) * periodo
      : (golpes[desde]?.t ?? null);
    const candidatos: number[] = [];
    for (let i = desde; i < golpes.length; i++) {
      if (prediccion !== null && golpes[i]!.t > prediccion + ventana) break;
      if (prediccion === null || Math.abs(golpes[i]!.t - prediccion) <= ventana) candidatos.push(i);
    }
    const cercania = (i: number) => Math.abs(golpes[i]!.t - (prediccion ?? golpes[i]!.t));
    const masCercano = (lista: number[]) =>
      lista.reduce((a, b) => (cercania(b) < cercania(a) ? b : a));
    const exactos = candidatos.filter((i) => coincide(golpes[i]!, n) === true);
    let elegido: number | null = exactos.length ? masCercano(exactos) : null;
    if (elegido === null && candidatos.length) {
      // Entre golpes que no coinciden, primero los que vio la cámara: su tecla es un dato.
      const vistos = candidatos.filter((i) => golpes[i]!.visual !== null);
      const cerca = masCercano(vistos.length ? vistos : candidatos);
      const siguiente = esperadas[k + 1];
      // Es una omisión solo si el golpe es la nota que viene y está más cerca de su momento.
      const prediccionSiguiente =
        prediccion !== null && siguiente
          ? prediccion + (siguiente.tiempoBeats - n.tiempoBeats) * periodo
          : null;
      const esLaSiguiente =
        siguiente !== undefined &&
        prediccionSiguiente !== null &&
        coincide(golpes[cerca]!, siguiente) === true &&
        Math.abs(golpes[cerca]!.t - prediccionSiguiente) < cercania(cerca);
      if (!esLaSiguiente) elegido = cerca;
    }
    if (elegido === null) {
      eventos.push({ idx: n.idx, mano: n.mano, golpe: null, estado: "faltante" });
      return;
    }
    const golpe = golpes[elegido]!;
    const igual = coincide(golpe, n);
    usados.add(elegido);
    desde = elegido + 1;
    ancla = { t: golpe.t, beats: n.tiempoBeats };
    const estado: EstadoNota =
      igual === true ? "correcta" : igual === false ? "incorrecta" : "dudosa";
    eventos.push({ idx: n.idx, mano: n.mano, golpe, estado });
  });
  return { eventos, extras: golpes.filter((_, i) => !usados.has(i)) };
}

/** Cada mano con su secuencia esperada; un golpe sirve a lo sumo a un evento de su mano. */
export function alinearPorMano(
  esperadas: readonly NotaEsperada[],
  golpes: Record<IdMano, readonly Golpe[]>,
  periodo: number,
): AlineamientoPorMano {
  const eventos: EventoAlineado[] = [];
  const extras: Record<IdMano, Golpe[]> = { MI: [], MD: [] };
  for (const mano of ["MI", "MD"] as const) {
    const propias = esperadas.filter((n) => n.mano === mano);
    if (propias.length === 0) continue;
    const r = alinearUnaMano(propias, golpes[mano], periodo);
    eventos.push(...r.eventos);
    extras[mano] = r.extras;
  }
  eventos.sort((a, b) => a.idx - b.idx);
  return { eventos, extras };
}

/** Periodo del pulso (s): el del tempo elegido o, sin él, el estimado de los propios golpes. */
export function periodoDelPulso(
  tempoElegido: number | null,
  esperadas: readonly NotaEsperada[],
  golpes: readonly Golpe[],
): number | null {
  if (tempoElegido) return 60 / tempoElegido;
  const mediana = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
  const tiempos = [...new Set(golpes.map((g) => g.t))].sort((a, b) => a - b);
  const pasos = [...new Set(esperadas.map((n) => n.tiempoBeats))].sort((a, b) => a - b);
  const intervalo = mediana(tiempos.slice(1).map((t, i) => t - tiempos[i]!));
  const beats = mediana(pasos.slice(1).map((b, i) => b - pasos[i]!));
  return intervalo && beats ? intervalo / beats : null;
}

import { alinearNotas, type AlineamientoNotas } from "../alineacion/notas.ts";
import { fusionar, type AtaqueFusionado } from "../alineacion/fusion.ts";
import { detectarAtaques } from "../audio/ataques.ts";
import { ENERGIA_MINIMA, cromaEnAtaque } from "../audio/croma.ts";
import { analizarTempo, type AnalisisTempo } from "../audio/tempo.ts";
import type { NotaEsperada } from "../ejercicio/escala.ts";
import { resultadoVisual, type ResultadoNotaVisual } from "../ejercicio/resultado.ts";
import { aplicar, type Homografia } from "../geometria/homografia.ts";
import { modeloTeclado } from "../geometria/teclado.ts";
import {
  detectarDescensos,
  eventosVisuales,
  type EventoVisual,
  type MuestraAltura,
} from "../rasgos/dedos.ts";
import { SeguidorManos, type Asignacion, type IdMano } from "../rasgos/manos.ts";
import { DEDOS, PUNTA, type Dedo, type Punto3 } from "../rasgos/rasgos.ts";

/** Muestra de una mano en un fotograma: altura de cada punta y su posición en la imagen (px). */
export interface MuestraMano {
  t: number;
  alturas: Partial<Record<Dedo, number>>;
  puntas: Partial<Record<Dedo, { x: number; y: number }>>;
}

export interface AudioGrabado {
  muestras: Float32Array;
  tasa: number;
  /** Instante de la primera muestra en el mismo reloj que las series visuales (s). */
  t0: number;
}

export interface PedidoAnalisis {
  series: Partial<Record<"MI" | "MD", MuestraMano[]>>;
  audio?: AudioGrabado;
  metronomo?: "con" | "sin";
  tempoElegido?: number;
  calibracion: Homografia;
  rango: { min: number; max: number };
  esperadas: NotaEsperada[];
}

/** Ataque oído: instante en el reloj de las series, croma y clase dominante (null si es dudosa). */
export interface AtaqueOido {
  t: number;
  clase: number | null;
  energia: number;
  croma: number[];
}

export interface ResultadoAcustico {
  ataques: number[];
  oidas: AtaqueOido[];
  /** Una entrada por instante esperado (a manos juntas, ambas manos en octava). */
  notas: AlineamientoNotas;
  tempo: AnalisisTempo | null;
  fusion: AtaqueFusionado[];
}

export interface RespuestaAnalisis {
  notas: ResultadoNotaVisual[];
  visuales: EventoVisual[];
  acustico: ResultadoAcustico | null;
  duracionAnalisisMs: number;
}

/**
 * Identidad de cada mano en la imagen, con el seguidor del núcleo. Con la vista de referencia
 * (cámara detrás del pianista) la izquierda de la imagen es la mano izquierda; con la cámara
 * frontal la imagen está en espejo y se invierte x antes de asignar.
 */
export function crearAsignador<M extends readonly Punto3[]>(frontal: () => boolean) {
  const seguidor = new SeguidorManos<M>(0.5);
  return (manos: readonly M[]): Asignacion<M> =>
    seguidor.asignar(
      manos.map((m) => {
        const muneca = m[0]!;
        return { muneca: { x: frontal() ? 1 - muneca.x : muneca.x, y: muneca.y }, datos: m };
      }),
    );
}

/** Muestra de cada mano del fotograma: altura de cada punta (profundidad relativa) y posición. */
export function muestrasDelFotograma(
  asignacion: Partial<Record<IdMano, { datos: readonly Punto3[] }>>,
  ancho: number,
  alto: number,
  t: number,
): Partial<Record<IdMano, MuestraMano>> {
  const salida: Partial<Record<IdMano, MuestraMano>> = {};
  for (const id of ["MI", "MD"] as const) {
    const m = asignacion[id]?.datos;
    if (!m) continue;
    const palma = Math.hypot(m[5]!.x - m[17]!.x, ((m[5]!.y - m[17]!.y) * alto) / ancho) || 1;
    const alturas: MuestraMano["alturas"] = {};
    const puntas: MuestraMano["puntas"] = {};
    for (const dedo of DEDOS) {
      const p = m[PUNTA[dedo]]!;
      // Profundidad relativa a la muñeca: el dedo que baja se aleja de la cámara (versión simple;
      // la estimación de la altura con la vista de referencia la decide S1).
      alturas[dedo] = -p.z / palma;
      puntas[dedo] = { x: p.x * ancho, y: p.y * alto };
    }
    salida[id] = { t, alturas, puntas };
  }
  return salida;
}

/** Fracción de notas que se pudieron evaluar: las oídas si hay audio; si no, las vistas. */
export function fraccionEvaluable(r: RespuestaAnalisis): number {
  return r.acustico
    ? r.acustico.notas.esperadas.filter((n) => n.estado !== "dudosa" && n.estado !== "faltante")
        .length / Math.max(1, r.acustico.notas.esperadas.length)
    : r.notas.filter((n) => n.resultado.estado === "detectada").length /
        Math.max(1, r.notas.length);
}

/** Análisis con el núcleo (en la app se ejecuta dentro del Web Worker). */
export function analizar(p: PedidoAnalisis, reloj: () => number): RespuestaAnalisis {
  const inicio = reloj();
  const modelo = modeloTeclado(p.rango.min, p.rango.max);
  const visuales: EventoVisual[] = [];
  for (const mano of ["MI", "MD"] as const) {
    const serie = p.series[mano];
    if (!serie?.length) continue;
    const muestras: MuestraAltura[] = serie.map((m) => ({ t: m.t, alturas: m.alturas }));
    const punta = (dedo: Dedo, t: number) => {
      const cercana = serie.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
      const p2 = cercana.puntas[dedo];
      return p2 ? aplicar(p.calibracion, p2) : null;
    };
    visuales.push(...eventosVisuales(mano, detectarDescensos(muestras, DEDOS), punta, modelo));
  }
  return {
    notas: resultadoVisual(p.esperadas, visuales),
    visuales,
    acustico: p.audio ? analizarAudio(p, p.audio, visuales) : null,
    duracionAnalisisMs: reloj() - inicio,
  };
}

/** Promedio por bloques hasta ~22 kHz: los parámetros del núcleo de audio están a esa tasa. */
export function reducirTasa(
  muestras: Float32Array,
  tasa: number,
): { muestras: Float32Array; tasa: number } {
  const k = Math.max(1, Math.round(tasa / 22050));
  if (k === 1) return { muestras, tasa };
  const salida = new Float32Array(Math.floor(muestras.length / k));
  for (let i = 0; i < salida.length; i++) {
    let suma = 0;
    for (let j = 0; j < k; j++) suma += muestras[i * k + j]!;
    salida[i] = suma / k;
  }
  return { muestras: salida, tasa: tasa / k };
}

function analizarAudio(
  p: PedidoAnalisis,
  audio: AudioGrabado,
  visuales: EventoVisual[],
): ResultadoAcustico {
  const { muestras, tasa } = reducirTasa(audio.muestras, audio.tasa);
  const relativos = detectarAtaques(muestras, tasa);
  const oidas = relativos.map((t) => {
    const croma = cromaEnAtaque(muestras, tasa, t);
    const clase =
      croma.energia < ENERGIA_MINIMA ? null : croma.clases.indexOf(Math.max(...croma.clases));
    return { t: t + audio.t0, clase, energia: croma.energia, croma: [...croma.clases] };
  });
  const ataques = oidas.map((o) => o.t);
  const mano = p.esperadas.some((n) => n.mano === "MD") ? "MD" : "MI";
  const esperadasPorInstante = p.esperadas.filter((n) => n.mano === mano).map((n) => n.claseAltura);
  // Con muy pocos ataques no se puede estimar el tempo: queda en null.
  let tempo: AnalisisTempo | null;
  try {
    tempo = analizarTempo(ataques, {
      metronomo: p.metronomo ?? "sin",
      tempoElegido: p.tempoElegido ?? null,
    });
  } catch {
    tempo = null;
  }
  return {
    ataques,
    oidas,
    notas: alinearNotas(esperadasPorInstante, oidas),
    tempo,
    fusion: fusionar(ataques, visuales),
  };
}

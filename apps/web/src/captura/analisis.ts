import {
  ENERGIA_MINIMA,
  DEDOS,
  alinearNotas,
  analizarTempo,
  cromaEnAtaque,
  detectarAtaques,
  fusionar,
  type AlineamientoNotas,
  type AnalisisTempo,
  type AtaqueFusionado,
  aplicar,
  detectarDescensos,
  eventosVisuales,
  modeloTeclado,
  resultadoVisual,
  type Dedo,
  type EventoVisual,
  type Homografia,
  type MuestraAltura,
  type NotaEsperada,
  type ResultadoNotaVisual,
} from "@skilltrack/core";

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

export interface ResultadoAcustico {
  ataques: number[];
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

/** Análisis con el núcleo (se ejecuta dentro del Web Worker). */
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
    return { t: t + audio.t0, clase };
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
    notas: alinearNotas(esperadasPorInstante, oidas),
    tempo,
    fusion: fusionar(ataques, visuales),
  };
}

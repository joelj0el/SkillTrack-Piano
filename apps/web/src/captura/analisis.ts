import {
  DEDOS,
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

export interface PedidoAnalisis {
  series: Partial<Record<"MI" | "MD", MuestraMano[]>>;
  calibracion: Homografia;
  rango: { min: number; max: number };
  esperadas: NotaEsperada[];
}

export interface RespuestaAnalisis {
  notas: ResultadoNotaVisual[];
  visuales: EventoVisual[];
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
    duracionAnalisisMs: reloj() - inicio,
  };
}

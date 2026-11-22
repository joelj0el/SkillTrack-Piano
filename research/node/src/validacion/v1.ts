/**
 * V1 (OE2 y OE3): el análisis contra la anotación manual de unos pocos clips. Las cifras salen
 * tal como dan, separadas por origen (y por instrumento en la acústica), con su n.
 */
import { EventoResultado, type ResultadoReproceso } from "@skilltrack/contracts";
import type { Origen } from "./concordancia.ts";

/** Con menos tomas anotadas que esto, la tabla avisa que el n es chico. */
export const MINIMO_TOMAS_V1 = 10;

const NOTAS: Record<string, number> = { do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
const INGLES: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

/** "Do4", "Fa#3", "Sib2", "C4" o un número MIDI → MIDI (Do4 = 60); null si está vacío. */
export function midiDe(texto: string): number | null {
  const t = texto.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) return Number(t);
  const m = /^(do|re|mi|fa|sol|la|si|[a-g])([#♯]|b|♭)?(-?\d)$/i.exec(t);
  if (!m) throw new Error(`Tecla ilegible: "${texto}" (usa Do4, Fa#3, Sib2 o el número MIDI)`);
  const base = NOTAS[m[1]!.toLowerCase()] ?? INGLES[m[1]!.toLowerCase()]!;
  const alteracion = m[2] ? (/[#♯]/.test(m[2]) ? 1 : -1) : 0;
  return (Number(m[3]) + 1) * 12 + base + alteracion;
}

/** Clase de altura (0 = Do) de un nombre de nota sin octava o con ella; null si está vacío. */
export function claseDe(texto: string): number | null {
  const t = texto.trim();
  if (!t) return null;
  const conOctava = /-?\d$/.test(t) ? t : `${t}4`;
  return (((midiDe(conOctava) ?? 0) % 12) + 12) % 12;
}

/** CSV simple: separa por coma o punto y coma, quita comillas y salta líneas vacías o con #. */
export function leerCsv(texto: string): string[][] {
  return texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split(/[,;]/).map((c) => c.trim().replace(/^"|"$/g, "")));
}

export function agrupar<T>(xs: readonly T[], clave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) m.set(clave(x), [...(m.get(clave(x)) ?? []), x]);
  return m;
}

// ---------------------------------------------------------------- V1 visual

export interface NotaAnotada {
  codigo_toma: string;
  /** Número de la nota esperada tal como la muestra la app (1 = primera). */
  nota: number;
  mano: "MI" | "MD";
  /** Dedo que tocó (1 = pulgar); null si no se ve. */
  dedo: number | null;
  /** Tecla que se tocó (MIDI); null si no se ve. */
  tecla: number | null;
}

const COLUMNAS_VISUAL = ["codigo_toma", "nota", "mano", "dedo", "tecla"];

export function leerAnotacionVisual(texto: string): NotaAnotada[] {
  const [cabecera, ...filas] = leerCsv(texto);
  const col = (n: string) => cabecera!.indexOf(n);
  const faltan = COLUMNAS_VISUAL.filter((c) => col(c) < 0);
  if (!cabecera || faltan.length) throw new Error(`Faltan columnas: ${faltan.join(", ")}`);
  return filas.map((f, i) => {
    const celda = (n: string) => f[col(n)] ?? "";
    const mano = celda("mano").toUpperCase();
    if (mano !== "MI" && mano !== "MD") throw new Error(`Fila ${i + 2}: mano debe ser MI o MD`);
    const dedo = celda("dedo") ? Number(celda("dedo")) : null;
    if (dedo !== null && !(Number.isInteger(dedo) && dedo >= 1 && dedo <= 5)) {
      throw new Error(`Fila ${i + 2}: dedo debe ser 1 a 5 o quedar vacío`);
    }
    return {
      codigo_toma: celda("codigo_toma"),
      nota: Number(celda("nota")),
      mano,
      dedo,
      tecla: midiDe(celda("tecla")),
    };
  });
}

export interface TomaV1 {
  codigo_toma: string;
  origen: Origen;
  instrumento: string;
  /** null si la toma no se reprocesó todavía. */
  resultado: ResultadoReproceso | null;
  /** Segundos de proceso y de video, del reporte del reprocesamiento (si se pasó). */
  tiempo: { proceso_s: number; video_s: number } | null;
}

export interface FilaV1Visual {
  origen: Origen;
  tomas: number;
  validas: number;
  sin_reprocesar: number;
  tomas_anotadas: number;
  /** Notas de las tomas válidas. */
  notas: number;
  sin_evento_visual: number;
  /** Notas anotadas con dedo y tecla visibles, y cuántas coinciden en ambos. */
  dedo_tecla: { n: number; aciertos: number };
  tecla: { n: number; aciertos: number };
  dedo: { n: number; aciertos: number };
  /** Correcto / incorrecto frente a la digitación esperada, contra el mismo juicio anotado. */
  digitacion: { n: number; aciertos: number; no_detectadas: number };
  anotaciones_sin_evento: number;
  manos_distintas: number;
  extraccion: {
    n: number;
    mediana_s: number | null;
    maximo_s: number | null;
    por_s_video: number | null;
  };
}

export const mediana = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const o = [...xs].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m]! : (o[m - 1]! + o[m]!) / 2;
};

export function eventosDe(r: ResultadoReproceso): EventoResultado[] {
  return r.analisis.eventos.map((e) => EventoResultado.parse(e));
}

export function v1Visual(
  tomas: readonly TomaV1[],
  anotadas: readonly NotaAnotada[],
): FilaV1Visual[] {
  const porToma = agrupar(anotadas, (a) => a.codigo_toma);
  const origenes = [...new Set(tomas.map((t) => t.origen))].sort();
  return origenes.map((origen) => {
    const delOrigen = tomas.filter((t) => t.origen === origen);
    const validas = delOrigen.filter((t) => t.resultado?.evaluable.final);
    const fila: FilaV1Visual = {
      origen,
      tomas: delOrigen.length,
      validas: validas.length,
      sin_reprocesar: delOrigen.filter((t) => !t.resultado).length,
      tomas_anotadas: 0,
      notas: 0,
      sin_evento_visual: 0,
      dedo_tecla: { n: 0, aciertos: 0 },
      tecla: { n: 0, aciertos: 0 },
      dedo: { n: 0, aciertos: 0 },
      digitacion: { n: 0, aciertos: 0, no_detectadas: 0 },
      anotaciones_sin_evento: 0,
      manos_distintas: 0,
      extraccion: { n: 0, mediana_s: null, maximo_s: null, por_s_video: null },
    };
    for (const t of validas) {
      const eventos = eventosDe(t.resultado!);
      fila.notas += eventos.length;
      fila.sin_evento_visual += eventos.filter(
        (e) => e.dedo.valor === null && e.tecla.midi === null,
      ).length;
      const notas = porToma.get(t.codigo_toma) ?? [];
      if (notas.length) fila.tomas_anotadas++;
      const porIdx = new Map(eventos.map((e) => [e.idx, e]));
      for (const a of notas) {
        const e = porIdx.get(a.nota - 1);
        if (!e) {
          fila.anotaciones_sin_evento++;
          continue;
        }
        if (e.mano !== a.mano) fila.manos_distintas++;
        if (a.tecla !== null) {
          fila.tecla.n++;
          if (e.tecla.midi === a.tecla) fila.tecla.aciertos++;
        }
        if (a.dedo !== null) {
          fila.dedo.n++;
          if (e.dedo.valor === a.dedo) fila.dedo.aciertos++;
        }
        if (a.dedo !== null && a.tecla !== null) {
          fila.dedo_tecla.n++;
          if (e.dedo.valor === a.dedo && e.tecla.midi === a.tecla) fila.dedo_tecla.aciertos++;
        }
        if (a.dedo !== null && e.dedo_esperado !== null) {
          if (e.dedo.estado === "no-detectado") {
            fila.digitacion.no_detectadas++;
            continue;
          }
          fila.digitacion.n++;
          const anotadaCorrecta = a.dedo === e.dedo_esperado;
          if ((e.dedo.estado === "correcto") === anotadaCorrecta) fila.digitacion.aciertos++;
        }
      }
    }
    const tiempos = delOrigen.flatMap((t) => (t.tiempo ? [t.tiempo] : []));
    const video = tiempos.reduce((s, x) => s + x.video_s, 0);
    fila.extraccion = {
      n: tiempos.length,
      mediana_s: mediana(tiempos.map((x) => x.proceso_s)),
      maximo_s: tiempos.length ? Math.max(...tiempos.map((x) => x.proceso_s)) : null,
      por_s_video: video ? tiempos.reduce((s, x) => s + x.proceso_s, 0) / video : null,
    };
    return fila;
  });
}

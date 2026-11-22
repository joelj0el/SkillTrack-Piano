/** V1 acústica (OE3): ataques y notas contra la capa de instantes anotada en Sonic Visualiser. */
import type { Origen } from "./concordancia.ts";
import { agrupar, claseDe, leerCsv, mediana } from "./v1.ts";

/** Tolerancia habitual para dar por acertado un ataque (MIREX: ± 50 ms). */
export const TOLERANCIA_ATAQUE_MS = 50;

export interface AtaqueAnotado {
  t: number;
  /** Clase de altura anotada (0 = Do); null si el ataque no lleva nota. */
  clase: number | null;
}

/** Capa de instantes exportada de Sonic Visualiser: "tiempo,etiqueta" por línea (s). */
export function leerAnotacionAcustica(texto: string): AtaqueAnotado[] {
  return leerCsv(texto)
    .filter((f) => /^-?\d+(\.\d+)?$/.test(f[0] ?? ""))
    .map((f) => ({ t: Number(f[0]), clase: claseDe(f[1] ?? "") }))
    .sort((a, b) => a.t - b.t);
}

export interface AtaqueDetectado {
  t: number;
  clase: number | null;
}

/** Empareja uno a uno, del par más cercano al más lejano, dentro de la tolerancia. */
export function emparejar(
  anotados: readonly { t: number }[],
  detectados: readonly { t: number }[],
  toleranciaS: number,
): [number, number][] {
  const pares: [number, number, number][] = [];
  anotados.forEach((a, i) =>
    detectados.forEach((d, j) => {
      const dist = Math.abs(d.t - a.t);
      if (dist <= toleranciaS) pares.push([dist, i, j]);
    }),
  );
  pares.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  const usadosA = new Set<number>();
  const usadosD = new Set<number>();
  const salida: [number, number][] = [];
  for (const [, i, j] of pares) {
    if (usadosA.has(i) || usadosD.has(j)) continue;
    usadosA.add(i);
    usadosD.add(j);
    salida.push([i, j]);
  }
  return salida.sort((x, y) => x[0] - y[0]);
}

export interface Conteo {
  vp: number;
  fp: number;
  fn: number;
}

export const precision = (c: Conteo) => (c.vp + c.fp ? c.vp / (c.vp + c.fp) : null);
export const exhaustividad = (c: Conteo) => (c.vp + c.fn ? c.vp / (c.vp + c.fn) : null);
export function f1(c: Conteo): number | null {
  const d = 2 * c.vp + c.fp + c.fn;
  return d ? (2 * c.vp) / d : null;
}

export interface TomaAcustica {
  codigo_toma: string;
  origen: Origen;
  instrumento: string;
  anotados: AtaqueAnotado[];
  detectados: AtaqueDetectado[];
}

export interface FilaV1Acustica {
  origen: Origen;
  instrumento: string;
  tomas: number;
  ataques: Conteo;
  notas: Conteo | null;
  /** Detectado − anotado de los ataques emparejados (ms). */
  error_ms: {
    n: number;
    media: number | null;
    mediana_abs: number | null;
    maximo_abs: number | null;
  };
}

export function v1Acustica(
  tomas: readonly TomaAcustica[],
  toleranciaMs = TOLERANCIA_ATAQUE_MS,
): FilaV1Acustica[] {
  const grupos = agrupar(tomas, (t) => `${t.origen}\t${t.instrumento}`);
  return [...grupos.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([clave, grupo]) => {
      const [origen, instrumento] = clave.split("\t") as [Origen, string];
      const ataques: Conteo = { vp: 0, fp: 0, fn: 0 };
      const notas: Conteo = { vp: 0, fp: 0, fn: 0 };
      let conEtiqueta = false;
      const errores: number[] = [];
      for (const t of grupo) {
        const pares = emparejar(t.anotados, t.detectados, toleranciaMs / 1000);
        ataques.vp += pares.length;
        ataques.fp += t.detectados.length - pares.length;
        ataques.fn += t.anotados.length - pares.length;
        for (const [i, j] of pares) errores.push((t.detectados[j]!.t - t.anotados[i]!.t) * 1000);
        if (t.anotados.some((a) => a.clase !== null)) {
          conEtiqueta = true;
          const deA = new Map(pares.map(([i, j]) => [i, j]));
          const correctas = t.anotados.filter(
            (a, i) =>
              a.clase !== null && deA.has(i) && t.detectados[deA.get(i)!]!.clase === a.clase,
          ).length;
          notas.vp += correctas;
          notas.fp += t.detectados.filter((d) => d.clase !== null).length - correctas;
          notas.fn += t.anotados.filter((a) => a.clase !== null).length - correctas;
        }
      }
      const abs = errores.map(Math.abs);
      return {
        origen,
        instrumento,
        tomas: grupo.length,
        ataques,
        notas: conEtiqueta ? notas : null,
        error_ms: {
          n: errores.length,
          media: errores.length ? errores.reduce((s, x) => s + x, 0) / errores.length : null,
          mediana_abs: mediana(abs),
          maximo_abs: abs.length ? Math.max(...abs) : null,
        },
      };
    });
}

import { fft } from "./fft.ts";

/**
 * Croma por ataque: energía por clase de altura (0 = Do … 11 = Si) del espectro que aparece con
 * la nota. Se usa el aumento entre una ventana justo antes y otra justo después del ataque, así
 * la nota anterior, que todavía suena, no contamina la clase de la nueva.
 */
export const TAMANO_CROMA = 4096;
const FRECUENCIA_MIN = 60;
const FRECUENCIA_MAX = 2000;

/** PROPUESTA provisional: energía mínima del aumento para decidir (se ajusta en S2). */
export const ENERGIA_MINIMA = 1e-3;

function espectro(senal: ArrayLike<number>, inicio: number): Float64Array {
  const re = new Float64Array(TAMANO_CROMA);
  const im = new Float64Array(TAMANO_CROMA);
  for (let i = 0; i < TAMANO_CROMA; i++) {
    const v = senal[inicio + i] ?? 0;
    re[i] = v * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / TAMANO_CROMA));
  }
  fft(re, im);
  const potencia = new Float64Array(TAMANO_CROMA / 2);
  for (let b = 0; b < potencia.length; b++) potencia[b] = re[b]! ** 2 + im[b]! ** 2;
  return potencia;
}

export interface Croma {
  /** Energía por clase de altura, normalizada a suma 1 (ceros si no hay energía). */
  clases: number[];
  energia: number;
}

export function cromaEnAtaque(senal: ArrayLike<number>, tasa: number, ataque: number): Croma {
  const muestra = Math.round(ataque * tasa);
  const despues = espectro(senal, muestra);
  const antes = espectro(senal, Math.max(0, muestra - TAMANO_CROMA));
  const clases = new Array<number>(12).fill(0);
  for (let b = 1; b < despues.length; b++) {
    const f = (b * tasa) / TAMANO_CROMA;
    if (f < FRECUENCIA_MIN || f > FRECUENCIA_MAX) continue;
    const aumento = despues[b]! - antes[b]!;
    if (aumento <= 0) continue;
    const midi = Math.round(12 * Math.log2(f / 440) + 69);
    clases[((midi % 12) + 12) % 12]! += aumento;
  }
  const energia = clases.reduce((a, b) => a + b, 0) / TAMANO_CROMA ** 2;
  const suma = clases.reduce((a, b) => a + b, 0);
  return { clases: suma > 0 ? clases.map((c) => c / suma) : clases, energia };
}

export type VerificacionNota = "correcta" | "incorrecta" | "dudosa";

/**
 * Compara con la clase esperada (a manos juntas en octava, ambas manos tienen la misma clase).
 * Con energía insuficiente la respuesta es "dudosa" (no evaluable), nunca "incorrecta".
 */
export function verificarClase(croma: Croma, claseEsperada: number): VerificacionNota {
  if (croma.energia < ENERGIA_MINIMA) return "dudosa";
  const dominante = croma.clases.indexOf(Math.max(...croma.clases));
  return dominante === claseEsperada ? "correcta" : "incorrecta";
}

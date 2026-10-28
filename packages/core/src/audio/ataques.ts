import { stft } from "./fft.ts";

export interface ParametrosAtaques {
  tamano: number;
  salto: number;
  /** Cuadros a cada lado para la mediana del umbral adaptativo. */
  ventanaMediana: number;
  /** Margen sobre la mediana, como fracción del flujo máximo. */
  delta: number;
  /** Separación mínima entre ataques (s). */
  separacionMinima: number;
}

/** PROPUESTA provisional: se ajusta con los clips del autor (S2). */
export const PARAMETROS_ATAQUES: ParametrosAtaques = {
  tamano: 1024,
  salto: 128,
  ventanaMediana: 8,
  delta: 0.08,
  separacionMinima: 0.06,
};

/** Flujo espectral con rectificación de media onda (solo aumentos de energía). */
export function flujoEspectral(cuadros: readonly Float64Array[]): Float64Array {
  const flujo = new Float64Array(cuadros.length);
  for (let k = 1; k < cuadros.length; k++) {
    const actual = cuadros[k]!;
    const anterior = cuadros[k - 1]!;
    let suma = 0;
    for (let b = 0; b < actual.length; b++) {
      const d = Math.log1p(actual[b]!) - Math.log1p(anterior[b]!);
      if (d > 0) suma += d;
    }
    flujo[k] = suma;
  }
  return flujo;
}

function mediana(valores: number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[Math.floor(ordenados.length / 2)] ?? 0;
}

// Bloque de ~5,8 ms a 22 050 Hz: más largo que el periodo de las notas graves del repertorio.
const BLOQUE = 128;
const PASO = 8;

/**
 * El pico del flujo dice en qué cuadro entra la nota, no cuándo: dentro del cuadro se busca el
 * bloque corto donde más sube la energía. Devuelve la muestra del ataque.
 */
function refinar(senal: ArrayLike<number>, inicioCuadro: number, tamano: number): number {
  const desde = Math.max(BLOQUE, inicioCuadro);
  const hasta = Math.min(senal.length - BLOQUE, inicioCuadro + tamano);
  const energia = (i: number) => {
    let e = 0;
    for (let j = i; j < i + BLOQUE; j++) e += senal[j]! * senal[j]!;
    return e;
  };
  let mejor = desde;
  let mayorSubida = Number.NEGATIVE_INFINITY;
  for (let i = desde; i < hasta; i += PASO) {
    const subida = energia(i) - energia(i - BLOQUE);
    if (subida > mayorSubida) {
      mayorSubida = subida;
      mejor = i;
    }
  }
  return mejor;
}

/** Instantes de ataque (s): picos del flujo espectral, refinados en el dominio del tiempo. */
export function detectarAtaques(
  senal: ArrayLike<number>,
  tasa: number,
  p: ParametrosAtaques = PARAMETROS_ATAQUES,
): number[] {
  const { cuadros } = stft(senal, tasa, p.tamano, p.salto);
  const flujo = flujoEspectral(cuadros);
  const maximo = Math.max(...flujo, 1e-12);
  const ataques: number[] = [];
  for (let k = 1; k < flujo.length - 1; k++) {
    const v = flujo[k]!;
    if (v < flujo[k - 1]! || v < flujo[k + 1]!) continue;
    const vecinos = Array.from(
      flujo.subarray(Math.max(0, k - p.ventanaMediana), k + p.ventanaMediana + 1),
    );
    if (v < mediana(vecinos) + p.delta * maximo) continue;
    const t = refinar(senal, k * p.salto, p.tamano) / tasa;
    const ultimo = ataques.at(-1);
    if (ultimo !== undefined && t - ultimo < p.separacionMinima) continue;
    ataques.push(t);
  }
  return ataques;
}

/** Empareja detectados y anotados con tolerancia (s); F1 = 2PR/(P+R). */
export function f1Ataques(
  detectados: readonly number[],
  anotados: readonly number[],
  tolerancia = 0.05,
) {
  const usados = new Set<number>();
  let aciertos = 0;
  for (const a of anotados) {
    const i = detectados.findIndex((d, j) => !usados.has(j) && Math.abs(d - a) <= tolerancia);
    if (i >= 0) {
      usados.add(i);
      aciertos++;
    }
  }
  const precision = detectados.length ? aciertos / detectados.length : 0;
  const exhaustividad = anotados.length ? aciertos / anotados.length : 0;
  const f1 =
    precision + exhaustividad ? (2 * precision * exhaustividad) / (precision + exhaustividad) : 0;
  return { precision, exhaustividad, f1 };
}

import { homografia, type Homografia, type Punto } from "./homografia.ts";

/**
 * Plano del teclado: x en anchos de tecla blanca desde la primera blanca del tramo; y = 0 en el
 * borde frontal y y = 1 en la línea donde empiezan las teclas negras (más atrás, y > 1).
 */

// Proporción física habitual: una negra mide ~0,6 del ancho de una blanca.
const ANCHO_NEGRA = 0.6;
// Clases de altura con tecla negra a su derecha: Do, Re, Fa, Sol, La.
const BLANCAS_CON_NEGRA = new Set([0, 2, 5, 7, 9]);
const NEGRAS = new Set([1, 3, 6, 8, 10]);

export interface Tecla {
  midi: number;
  negra: boolean;
  x0: number;
  x1: number;
}

export interface ModeloTeclado {
  primeraBlanca: number;
  ultimaBlanca: number;
  blancas: number;
  teclas: Tecla[];
}

export interface TeclaTocada {
  midi: number;
  negra: boolean;
  /** Posición a lo largo de la tecla en el plano del teclado (0 = borde frontal). */
  aLoLargo: number;
}

export function esNegra(midi: number): boolean {
  return NEGRAS.has(((midi % 12) + 12) % 12);
}

/** Modelo de las teclas entre dos notas, extendido a las blancas que las encierran. */
export function modeloTeclado(notaMin: number, notaMax: number): ModeloTeclado {
  if (notaMin > notaMax) throw new Error("La nota mínima supera a la máxima");
  const primeraBlanca = esNegra(notaMin) ? notaMin - 1 : notaMin;
  const ultimaBlanca = esNegra(notaMax) ? notaMax + 1 : notaMax;
  const teclas: Tecla[] = [];
  let indice = 0;
  for (let midi = primeraBlanca; midi <= ultimaBlanca; midi++) {
    if (esNegra(midi)) continue;
    teclas.push({ midi, negra: false, x0: indice, x1: indice + 1 });
    const siguiente = midi + 1;
    if (BLANCAS_CON_NEGRA.has(midi % 12) && siguiente < ultimaBlanca) {
      const borde = indice + 1;
      teclas.push({
        midi: siguiente,
        negra: true,
        x0: borde - ANCHO_NEGRA / 2,
        x1: borde + ANCHO_NEGRA / 2,
      });
    }
    indice++;
  }
  return { primeraBlanca, ultimaBlanca, blancas: indice, teclas };
}

/** Tecla bajo un punto del plano del teclado, o null si cae fuera del tramo. */
export function teclaBajo(modelo: ModeloTeclado, p: Punto): TeclaTocada | null {
  if (p.x < 0 || p.x > modelo.blancas || p.y < 0) return null;
  if (p.y > 1) {
    const negra = modelo.teclas.find((t) => t.negra && p.x >= t.x0 && p.x <= t.x1);
    if (negra) return { midi: negra.midi, negra: true, aLoLargo: p.y };
  }
  const blanca = modelo.teclas.find((t) => !t.negra && p.x >= t.x0 && p.x < t.x1);
  const ultima = modelo.teclas.findLast((t) => !t.negra);
  const tecla = blanca ?? (p.x === modelo.blancas ? ultima : undefined);
  return tecla ? { midi: tecla.midi, negra: false, aLoLargo: p.y } : null;
}

export interface ToquesCalibracion {
  frenteIzquierda: Punto;
  frenteDerecha: Punto;
  negrasIzquierda: Punto;
  negrasDerecha: Punto;
}

/** Homografía imagen → plano del teclado a partir de los 4 toques guiados. */
export function calibracion(toques: ToquesCalibracion, modelo: ModeloTeclado): Homografia {
  const w = modelo.blancas;
  return homografia(
    [toques.frenteIzquierda, toques.frenteDerecha, toques.negrasIzquierda, toques.negrasDerecha],
    [
      { x: 0, y: 0 },
      { x: w, y: 0 },
      { x: 0, y: 1 },
      { x: w, y: 1 },
    ],
  );
}

export interface Cobertura {
  cubre: boolean;
  faltan: ("graves" | "agudas")[];
}

/** ¿El tramo calibrado contiene todas las teclas del ejercicio? (PA-HU09-04) */
export function coberturaDelRango(
  calibrado: ModeloTeclado,
  notaMin: number,
  notaMax: number,
): Cobertura {
  const faltan: Cobertura["faltan"] = [];
  if (notaMin < calibrado.primeraBlanca) faltan.push("graves");
  if (notaMax > calibrado.ultimaBlanca) faltan.push("agudas");
  return { cubre: faltan.length === 0, faltan };
}

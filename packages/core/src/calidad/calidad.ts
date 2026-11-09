/**
 * Puertas de calidad visual: funciones puras sobre medidas de cada fotograma.
 * Las medidas (luminancia, nitidez, movimiento) se calculan con las funciones de este módulo;
 * las manos detectadas vienen del detector de la mano.
 */

export interface UmbralesCalidad {
  /** Luminancia media mínima (0–255) para ámbar y para verde. */
  luzMinRojo: number;
  luzMinVerde: number;
  /** Varianza del laplaciano mínima para considerar la imagen nítida. */
  nitidezMin: number;
  /** Diferencia media entre fotogramas (0–255) a partir de la cual la cámara se mueve. */
  movimientoMax: number;
  /** PRM-17: desplazamiento del teclado que invalida la calibración (fracción del ancho). */
  desplazamientoMax: number;
}

/**
 * PROPUESTA provisional (sin medición): los valores de luz, nitidez y movimiento se ratifican
 * en S1 con la matriz de dispositivos. PRM-17 = 2 % viene de los parámetros del proyecto.
 */
export const UMBRALES_PROPUESTOS: UmbralesCalidad = {
  luzMinRojo: 40,
  luzMinVerde: 70,
  nitidezMin: 60,
  movimientoMax: 12,
  desplazamientoMax: 0.02,
};

export interface MedidasFotograma {
  luminancia: number;
  nitidez: number;
  movimiento: number;
  manosDetectadas: number;
  manosEsperadas: 1 | 2;
  /** ¿Se ven en la imagen las teclas de todo el rango del ejercicio? */
  rangoVisible: boolean;
}

export type CodigoMotivo =
  "poca-luz" | "borroso" | "sin-manos" | "camara-en-movimiento" | "rango-cortado";

export interface Motivo {
  codigo: CodigoMotivo;
  gravedad: "ambar" | "rojo";
  texto: string;
}

export interface Semaforo {
  nivel: "verde" | "ambar" | "rojo";
  motivos: Motivo[];
}

const TEXTOS: Record<CodigoMotivo, string> = {
  "poca-luz": "Hay poca luz: enciende una luz o acércate a una ventana.",
  borroso: "La imagen está borrosa: limpia la cámara y deja el teléfono quieto.",
  "sin-manos": "No se ven tus manos: colócalas sobre el teclado.",
  "camara-en-movimiento": "La cámara se mueve: apoya el teléfono en un soporte firme.",
  "rango-cortado": "No se ven todas las teclas del ejercicio: aleja o gira el teléfono.",
};

function motivo(codigo: CodigoMotivo, gravedad: Motivo["gravedad"]): Motivo {
  return { codigo, gravedad, texto: TEXTOS[codigo] };
}

export function evaluarCalidad(
  m: MedidasFotograma,
  u: UmbralesCalidad = UMBRALES_PROPUESTOS,
): Semaforo {
  const motivos: Motivo[] = [];
  if (m.luminancia < u.luzMinRojo) motivos.push(motivo("poca-luz", "rojo"));
  else if (m.luminancia < u.luzMinVerde) motivos.push(motivo("poca-luz", "ambar"));
  if (m.nitidez < u.nitidezMin) motivos.push(motivo("borroso", "ambar"));
  if (m.movimiento > u.movimientoMax) motivos.push(motivo("camara-en-movimiento", "rojo"));
  if (!m.rangoVisible) motivos.push(motivo("rango-cortado", "rojo"));
  if (m.manosDetectadas < m.manosEsperadas) motivos.push(motivo("sin-manos", "ambar"));
  const nivel = motivos.some((x) => x.gravedad === "rojo")
    ? "rojo"
    : motivos.length > 0
      ? "ambar"
      : "verde";
  return { nivel, motivos };
}

/** Luminancia media (Rec. 601) de una imagen RGBA. */
export function luminanciaMedia(rgba: ArrayLike<number>): number {
  let suma = 0;
  const pixeles = rgba.length / 4;
  for (let i = 0; i < rgba.length; i += 4) {
    suma += 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
  }
  return pixeles > 0 ? suma / pixeles : 0;
}

/** Imagen RGBA → luminancia por píxel. */
export function aGrises(rgba: ArrayLike<number>): Float64Array {
  const gris = new Float64Array(rgba.length / 4);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
    gris[j] = 0.299 * rgba[i]! + 0.587 * rgba[i + 1]! + 0.114 * rgba[i + 2]!;
  }
  return gris;
}

/** Nitidez: varianza del laplaciano (vecindad de 4) sobre la imagen en grises. */
export function nitidez(gris: ArrayLike<number>, ancho: number, alto: number): number {
  const valores: number[] = [];
  for (let y = 1; y < alto - 1; y++) {
    for (let x = 1; x < ancho - 1; x++) {
      const i = y * ancho + x;
      valores.push(
        gris[i - ancho]! + gris[i + ancho]! + gris[i - 1]! + gris[i + 1]! - 4 * gris[i]!,
      );
    }
  }
  if (valores.length === 0) return 0;
  const media = valores.reduce((a, b) => a + b, 0) / valores.length;
  return valores.reduce((a, v) => a + (v - media) ** 2, 0) / valores.length;
}

/** Movimiento: diferencia absoluta media entre dos fotogramas en grises del mismo tamaño. */
export function movimiento(anterior: ArrayLike<number>, actual: ArrayLike<number>): number {
  if (anterior.length !== actual.length || actual.length === 0) return 0;
  let suma = 0;
  for (let i = 0; i < actual.length; i++) suma += Math.abs(actual[i]! - anterior[i]!);
  return suma / actual.length;
}

interface PuntoImagen {
  x: number;
  y: number;
}

/**
 * Desplazamiento de las 4 esquinas calibradas respecto de su posición actual, como fracción del
 * ancho calibrado del frente del teclado (se usa el mayor desplazamiento).
 */
export function desplazamientoTeclado(
  calibradas: readonly PuntoImagen[],
  actuales: readonly PuntoImagen[],
): number {
  const [izquierda, derecha] = calibradas as [PuntoImagen, PuntoImagen];
  const ancho = Math.hypot(derecha.x - izquierda.x, derecha.y - izquierda.y);
  const mayor = Math.max(
    ...calibradas.map((p, i) => Math.hypot(p.x - actuales[i]!.x, p.y - actuales[i]!.y)),
  );
  return ancho > 0 ? mayor / ancho : Number.POSITIVE_INFINITY;
}

/** PRM-17: ¿la cámara se movió lo suficiente para invalidar la calibración? */
export function calibracionInvalida(
  desplazamiento: number,
  u: UmbralesCalidad = UMBRALES_PROPUESTOS,
): boolean {
  return desplazamiento > u.desplazamientoMax;
}

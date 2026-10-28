export interface Punto {
  x: number;
  y: number;
}

/** Matriz 3×3 por filas: [h11, h12, h13, h21, h22, h23, h31, h32, h33]. */
export type Homografia = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

const EPSILON = 1e-12;

/** Resuelve A·x = b por eliminación gaussiana con pivoteo parcial. */
function resolver(a: number[][], b: number[]): number[] {
  const n = b.length;
  const m = a.map((fila, i) => [...fila, b[i] as number]);
  for (let col = 0; col < n; col++) {
    let pivote = col;
    for (let f = col + 1; f < n; f++) {
      if (Math.abs(m[f]![col]!) > Math.abs(m[pivote]![col]!)) pivote = f;
    }
    if (Math.abs(m[pivote]![col]!) < EPSILON) {
      throw new Error("Configuración degenerada: los puntos no definen una homografía");
    }
    [m[col], m[pivote]] = [m[pivote]!, m[col]!];
    const filaPivote = m[col]!;
    for (let f = 0; f < n; f++) {
      if (f === col) continue;
      const fila = m[f]!;
      const factor = fila[col]! / filaPivote[col]!;
      for (let c = col; c <= n; c++) fila[c]! -= factor * filaPivote[c]!;
    }
  }
  return m.map((fila, i) => fila[n]! / fila[i]!);
}

function areaFirmada(a: Punto, b: Punto, c: Punto): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function hayTresAlineados(p: readonly Punto[]): boolean {
  const [a, b, c, d] = p as [Punto, Punto, Punto, Punto];
  return [
    [a, b, c],
    [a, b, d],
    [a, c, d],
    [b, c, d],
  ].some(([u, v, w]) => Math.abs(areaFirmada(u!, v!, w!)) < 1e-9);
}

function multiplicar(p: Homografia, q: Homografia): Homografia {
  const r: number[] = [];
  for (let f = 0; f < 3; f++) {
    for (let c = 0; c < 3; c++) {
      r.push(p[f * 3]! * q[c]! + p[f * 3 + 1]! * q[3 + c]! + p[f * 3 + 2]! * q[6 + c]!);
    }
  }
  return r as unknown as Homografia;
}

/** Normalización de Hartley: centroide en el origen y distancia media √2. */
function normalizacion(puntos: readonly Punto[]): Homografia {
  const cx = puntos.reduce((s, p) => s + p.x, 0) / puntos.length;
  const cy = puntos.reduce((s, p) => s + p.y, 0) / puntos.length;
  const media = puntos.reduce((s, p) => s + Math.hypot(p.x - cx, p.y - cy), 0) / puntos.length;
  const k = Math.SQRT2 / media;
  return [k, 0, -k * cx, 0, k, -k * cy, 0, 0, 1];
}

/**
 * Homografía que lleva cada punto de `origen` al de `destino` (DLT con 4 correspondencias).
 * Se resuelve sobre coordenadas normalizadas: fijar h33 = 1 en coordenadas crudas falla cuando
 * la línea de fuga de la perspectiva pasa por el origen de la imagen (h33 real = 0).
 */
export function homografia(origen: readonly Punto[], destino: readonly Punto[]): Homografia {
  if (origen.length !== 4 || destino.length !== 4) {
    throw new Error("La homografía necesita exactamente 4 correspondencias");
  }
  if (hayTresAlineados(origen) || hayTresAlineados(destino)) {
    throw new Error("Configuración degenerada: hay tres puntos alineados");
  }
  const to = normalizacion(origen);
  const td = normalizacion(destino);
  const a: number[][] = [];
  const b: number[] = [];
  origen.forEach((p, i) => {
    const { x, y } = aplicar(to, p);
    const { x: u, y: v } = aplicar(td, destino[i]!);
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  });
  const h = resolver(a, b);
  const normalizada: Homografia = [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
  const resultado = multiplicar(invertir(td), multiplicar(normalizada, to));
  return escalar(resultado);
}

/** Cualquier múltiplo representa la misma homografía: se fija la norma de Frobenius en 1. */
function escalar(h: Homografia): Homografia {
  const norma = Math.hypot(...h);
  return h.map((v) => v / norma) as unknown as Homografia;
}

export function aplicar(h: Homografia, p: Punto): Punto {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

export function invertir(h: Homografia): Homografia {
  const [a, b, c, d, e, f, g, i, j] = h;
  const det = a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g);
  if (Math.abs(det) < EPSILON) throw new Error("Configuración degenerada: matriz no invertible");
  const inv = [
    e * j - f * i,
    c * i - b * j,
    b * f - c * e,
    f * g - d * j,
    a * j - c * g,
    c * d - a * f,
    d * i - e * g,
    b * g - a * i,
    a * e - b * d,
  ].map((v) => v / det);
  return escalar(inv as unknown as Homografia);
}

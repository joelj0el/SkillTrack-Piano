/**
 * Rasgos invariantes de la mano a partir de los 21 puntos del detector (convención de MediaPipe:
 * 0 muñeca; pulgar 1–4; índice 5–8; medio 9–12; anular 13–16; meñique 17–20).
 * Los ángulos y las razones de distancias no cambian con la escala, la traslación ni la rotación
 * de la cámara, así que se pueden comparar entre personas y teléfonos.
 */

export interface Punto3 {
  x: number;
  y: number;
  z: number;
}

export type Mano = readonly Punto3[];

export const DEDOS = ["pulgar", "indice", "medio", "anular", "menique"] as const;
export type Dedo = (typeof DEDOS)[number];

/** Índices [base, articulación 1, articulación 2, punta] de cada dedo. */
const CADENAS: Record<Dedo, readonly [number, number, number, number]> = {
  pulgar: [1, 2, 3, 4],
  indice: [5, 6, 7, 8],
  medio: [9, 10, 11, 12],
  anular: [13, 14, 15, 16],
  menique: [17, 18, 19, 20],
};

export const PUNTA: Record<Dedo, number> = {
  pulgar: 4,
  indice: 8,
  medio: 12,
  anular: 16,
  menique: 20,
};

function resta(a: Punto3, b: Punto3): Punto3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function norma(v: Punto3): number {
  return Math.hypot(v.x, v.y, v.z);
}

function distancia(a: Punto3, b: Punto3): number {
  return norma(resta(a, b));
}

/** Ángulo de flexión en `b` (grados): 0 = recto; crece al doblar la articulación. */
export function flexion(a: Punto3, b: Punto3, c: Punto3): number {
  const u = resta(b, a);
  const v = resta(c, b);
  // atan2(|u×v|, u·v) es estable cerca de 0° y 180°, donde acos pierde precisión.
  const cruz = {
    x: u.y * v.z - u.z * v.y,
    y: u.z * v.x - u.x * v.z,
    z: u.x * v.y - u.y * v.x,
  };
  const punto = u.x * v.x + u.y * v.y + u.z * v.z;
  return (Math.atan2(norma(cruz), punto) * 180) / Math.PI;
}

export interface FlexionDedo {
  /** Articulación de la base (MCP; en el pulgar, la MCP del pulgar). */
  mcp: number;
  pip: number;
  dip: number;
}

export interface RasgosMano {
  flexion: Record<Dedo, FlexionDedo>;
  /** Distancia entre puntas vecinas dividida por el ancho de la palma (5–17). */
  apertura: {
    pulgarIndice: number;
    indiceMedio: number;
    medioAnular: number;
    anularMenique: number;
  };
}

export function rasgosDeLaMano(m: Mano): RasgosMano {
  if (m.length !== 21) throw new Error("Se esperan 21 puntos de la mano");
  const p = (i: number) => m[i]!;
  const flexiones = {} as Record<Dedo, FlexionDedo>;
  for (const dedo of DEDOS) {
    const [base, art1, art2, punta] = CADENAS[dedo];
    flexiones[dedo] = {
      mcp: flexion(p(0), p(base), p(art1)),
      pip: flexion(p(base), p(art1), p(art2)),
      dip: flexion(p(art1), p(art2), p(punta)),
    };
  }
  const palma = distancia(p(5), p(17));
  const abre = (a: Dedo, b: Dedo) => distancia(p(PUNTA[a]), p(PUNTA[b])) / palma;
  return {
    flexion: flexiones,
    apertura: {
      pulgarIndice: abre("pulgar", "indice"),
      indiceMedio: abre("indice", "medio"),
      medioAnular: abre("medio", "anular"),
      anularMenique: abre("anular", "menique"),
    },
  };
}

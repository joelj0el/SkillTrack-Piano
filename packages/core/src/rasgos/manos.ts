/**
 * Identidad de cada mano a manos juntas (versión simple).
 * - Sin historia: por geometría, la mano con la muñeca más a la izquierda del teclado es la MI.
 * - Con historia: se elige la asignación que menos desplaza a cada mano respecto del fotograma
 *   anterior, así un cruce breve o el orden en que el detector entrega las manos no las
 *   intercambia. La etiqueta de lateralidad del detector no se usa (es poco fiable desde atrás).
 */

export type IdMano = "MI" | "MD";

export interface ManoDetectada<T = unknown> {
  /** Muñeca en el plano del teclado (x en anchos de tecla blanca). */
  muneca: { x: number; y: number };
  datos: T;
}

export type Asignacion<T> = Partial<Record<IdMano, ManoDetectada<T>>>;

function distancia(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export class SeguidorManos<T = unknown> {
  private ultima: Partial<Record<IdMano, { x: number; y: number }>> = {};

  /** `centro`: x del centro del tramo; decide una mano sola cuando no hay historia. */
  constructor(private readonly centro: number) {}

  asignar(detecciones: readonly ManoDetectada<T>[]): Asignacion<T> {
    const asignacion = this.elegir(detecciones.slice(0, 2));
    for (const id of ["MI", "MD"] as const) {
      const mano = asignacion[id];
      if (mano) this.ultima[id] = mano.muneca;
    }
    return asignacion;
  }

  private elegir(d: readonly ManoDetectada<T>[]): Asignacion<T> {
    const { MI: mi, MD: md } = this.ultima;
    if (d.length === 0) return {};
    if (d.length === 1) {
      const [unica] = d as [ManoDetectada<T>];
      if (mi && md) {
        return distancia(unica.muneca, mi) <= distancia(unica.muneca, md)
          ? { MI: unica }
          : { MD: unica };
      }
      const referencia = mi ?? md;
      if (referencia) {
        const misma = distancia(unica.muneca, referencia) < 1.5;
        const id: IdMano = mi ? "MI" : "MD";
        const otra: IdMano = id === "MI" ? "MD" : "MI";
        return misma ? { [id]: unica } : { [otra]: unica };
      }
      return unica.muneca.x < this.centro ? { MI: unica } : { MD: unica };
    }
    const [a, b] = d as [ManoDetectada<T>, ManoDetectada<T>];
    if (mi && md) {
      const directa = distancia(a.muneca, mi) + distancia(b.muneca, md);
      const cruzada = distancia(a.muneca, md) + distancia(b.muneca, mi);
      return directa <= cruzada ? { MI: a, MD: b } : { MI: b, MD: a };
    }
    return a.muneca.x <= b.muneca.x ? { MI: a, MD: b } : { MI: b, MD: a };
  }
}

/** En una tarea de una sola mano, la otra no genera eventos (PA-HU12-03). */
export function manosDeLaTarea<T>(
  asignacion: Asignacion<T>,
  manos: "MI" | "MD" | "juntas",
): Asignacion<T> {
  if (manos === "juntas") return asignacion;
  const elegida = asignacion[manos];
  return elegida ? { [manos]: elegida } : {};
}

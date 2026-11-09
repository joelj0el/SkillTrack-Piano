/**
 * Alineamiento de las notas oídas con la secuencia esperada (Needleman–Wunsch): una nota omitida
 * o añadida no desplaza al resto. A manos juntas en octava, ambas manos tocan la misma clase de
 * altura a la vez, así que cada instante esperado es un solo evento acústico.
 */
export interface NotaOida {
  t: number;
  /** Clase de altura detectada, o null si quedó dudosa (energía insuficiente). */
  clase: number | null;
}

export type EstadoNotaAcustica =
  | { estado: "correcta"; t: number }
  | { estado: "incorrecta"; t: number; claseOida: number }
  | { estado: "dudosa"; t: number }
  | { estado: "faltante" };

export interface AlineamientoNotas {
  esperadas: EstadoNotaAcustica[];
  /** Índices (en `oidas`) de las notas que sobran. */
  extras: number[];
}

const COSTO_DISTINTA = 1;
const COSTO_HUECO = 1;

export function alinearNotas(
  esperadas: readonly number[],
  oidas: readonly NotaOida[],
): AlineamientoNotas {
  const n = esperadas.length;
  const m = oidas.length;
  const costo = (i: number, j: number) => {
    const clase = oidas[j]!.clase;
    // Una nota dudosa no se cuenta como distinta: no se puede afirmar que esté mal.
    return clase === null || clase === esperadas[i] ? 0 : COSTO_DISTINTA;
  };
  const d: number[][] = Array.from({ length: n + 1 }, (_, i) =>
    Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0) * COSTO_HUECO),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      d[i]![j] = Math.min(
        d[i - 1]![j - 1]! + costo(i - 1, j - 1),
        d[i - 1]![j]! + COSTO_HUECO,
        d[i]![j - 1]! + COSTO_HUECO,
      );
    }
  }
  const resultado: EstadoNotaAcustica[] = new Array(n);
  const extras: number[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i]![j] === d[i - 1]![j - 1]! + costo(i - 1, j - 1)) {
      const oida = oidas[j - 1]!;
      resultado[i - 1] =
        oida.clase === null
          ? { estado: "dudosa", t: oida.t }
          : oida.clase === esperadas[i - 1]
            ? { estado: "correcta", t: oida.t }
            : { estado: "incorrecta", t: oida.t, claseOida: oida.clase };
      i--;
      j--;
    } else if (i > 0 && d[i]![j] === d[i - 1]![j]! + COSTO_HUECO) {
      resultado[i - 1] = { estado: "faltante" };
      i--;
    } else {
      extras.unshift(j - 1);
      j--;
    }
  }
  return { esperadas: resultado, extras };
}

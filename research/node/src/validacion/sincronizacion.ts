/**
 * TI-HU11-05: error de sincronización audio–video con un clip de palmadas (golpe seco visible y
 * audible). El instante visual de cada palmada es el mínimo de la distancia entre las dos manos;
 * el acústico, el ataque detectado más cercano. Error = audio − video (ms): positivo si el audio
 * llega después. La precisión visual está limitada a un fotograma.
 */
import type { FotogramaReproceso } from "@skilltrack/contracts";
import type { Origen } from "./concordancia.ts";
import { emparejar } from "./v1-acustica.ts";
import { avisoTomas, num, TITULO_ORIGEN } from "./v1-informe.ts";
import { agrupar, mediana } from "./v1.ts";

/** Por debajo de esta fracción de la distancia mediana entre manos, las manos están juntas. */
const FRACCION_JUNTAS = 0.35;
/** Dos palmadas más cercanas que esto se toman como una sola (s). */
const SEPARACION_MINIMA_S = 0.3;
/** Un ataque a más de esto de la palmada no es su sonido (s). */
const VENTANA_S = 0.2;

const centro = (m: FotogramaReproceso["manos"][number]) => {
  const p = [m.puntos[0]!, m.puntos[5]!, m.puntos[17]!];
  return { x: (p[0]![0] + p[1]![0] + p[2]![0]) / 3, y: (p[0]![1] + p[1]![1] + p[2]![1]) / 3 };
};

/** Instantes (s) en que las dos manos se juntan: el mínimo de cada tramo con las manos juntas. */
export function golpesVisuales(fotogramas: readonly FotogramaReproceso[]): number[] {
  const serie = fotogramas.flatMap((f) => {
    const mi = f.manos.find((m) => m.mano === "MI");
    const md = f.manos.find((m) => m.mano === "MD");
    if (!mi || !md) return [];
    const a = centro(mi);
    const b = centro(md);
    return [{ t: f.t, d: Math.hypot(a.x - b.x, a.y - b.y) }];
  });
  const umbral = FRACCION_JUNTAS * (mediana(serie.map((s) => s.d)) ?? 0);
  const golpes: { t: number; d: number }[] = [];
  let tramo: { t: number; d: number } | null = null;
  const cerrar = () => {
    if (!tramo) return;
    const previo = golpes.at(-1);
    if (previo && tramo.t - previo.t < SEPARACION_MINIMA_S) {
      if (tramo.d < previo.d) golpes[golpes.length - 1] = tramo;
    } else golpes.push(tramo);
    tramo = null;
  };
  for (const s of serie) {
    if (s.d <= umbral) {
      if (!tramo || s.d < tramo.d) tramo = s;
    } else cerrar();
  }
  cerrar();
  return golpes.map((g) => g.t);
}

export interface TomaSincronizacion {
  codigo_toma: string;
  origen: Origen;
  fotogramas: FotogramaReproceso[];
  /** Instantes de los ataques oídos (s), en el mismo reloj que los fotogramas. */
  ataques: number[];
}

export interface FilaSincronizacion {
  origen: Origen;
  tomas: string[];
  golpes_visuales: number;
  emparejados: number;
  error_ms: {
    media: number | null;
    mediana: number | null;
    desvio: number | null;
    maximo_abs: number | null;
  };
  /** Duración mediana de un fotograma (ms): el error no puede medirse más fino. */
  resolucion_ms: number | null;
}

export function sincronizacion(tomas: readonly TomaSincronizacion[]): FilaSincronizacion[] {
  return [...agrupar(tomas, (t) => t.origen).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([origen, grupo]) => {
      const errores: number[] = [];
      const pasos: number[] = [];
      let golpes = 0;
      for (const t of grupo) {
        const visuales = golpesVisuales(t.fotogramas).map((g) => ({ t: g }));
        golpes += visuales.length;
        const audio = t.ataques.map((a) => ({ t: a }));
        for (const [i, j] of emparejar(visuales, audio, VENTANA_S)) {
          errores.push((audio[j]!.t - visuales[i]!.t) * 1000);
        }
        for (let i = 1; i < t.fotogramas.length; i++) {
          pasos.push((t.fotogramas[i]!.t - t.fotogramas[i - 1]!.t) * 1000);
        }
      }
      const media = errores.length ? errores.reduce((s, x) => s + x, 0) / errores.length : null;
      const desvio =
        media !== null && errores.length > 1
          ? Math.sqrt(errores.reduce((s, x) => s + (x - media) ** 2, 0) / (errores.length - 1))
          : null;
      return {
        origen: origen as Origen,
        tomas: grupo.map((t) => t.codigo_toma),
        golpes_visuales: golpes,
        emparejados: errores.length,
        error_ms: {
          media,
          mediana: mediana(errores),
          desvio,
          maximo_abs: errores.length ? Math.max(...errores.map(Math.abs)) : null,
        },
        resolucion_ms: mediana(pasos),
      };
    });
}

export function tablaSincronizacion(filas: readonly FilaSincronizacion[]): string {
  const p = [
    "# Sincronización audio–video (palmadas)",
    "",
    "Error = instante del ataque oído − instante visual de la palmada (mínimo de la distancia entre las manos). Positivo: el audio llega después del video.",
    "",
  ];
  for (const f of filas) {
    p.push(`## ${TITULO_ORIGEN[f.origen]}`, "");
    const aviso = avisoTomas(f.emparejados, "golpes emparejados");
    if (aviso) p.push(aviso, "");
    p.push(
      "| Medida | Valor |",
      "| --- | --- |",
      `| Tomas | ${f.tomas.join(", ")} |`,
      `| Palmadas vistas / con su ataque | ${f.golpes_visuales} / ${f.emparejados} |`,
      `| Error medio | ${num(f.error_ms.media)} ms |`,
      `| Error mediano | ${num(f.error_ms.mediana)} ms |`,
      `| Desvío | ${num(f.error_ms.desvio)} ms |`,
      `| Máximo (valor absoluto) | ${num(f.error_ms.maximo_abs)} ms |`,
      `| Resolución visual (un fotograma) | ${num(f.resolucion_ms)} ms |`,
      "",
    );
  }
  return `${p.join("\n").trimEnd()}\n`;
}

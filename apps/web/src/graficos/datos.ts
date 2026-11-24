import type {
  CalificacionVariable,
  IntentoGuardado,
  SemanaDeProgreso,
} from "@skilltrack/contracts";
import { CLASES, UMBRAL_TROPIEZO, type Clase } from "@skilltrack/core";

/**
 * Datos de los gráficos, calculados en el cliente con lo que ya devuelve la API. Ninguno compara
 * estudiantes entre sí ni da un puntaje global.
 */

const DIA_MS = 86_400_000;

/** Lunes 00:00 (hora local) de la semana de `fecha`. */
export function lunesDe(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const fechaIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const redondear1 = (x: number) => Math.round(x * 10) / 10;

export interface EventoConAtaque {
  idx: number;
  mano: "MI" | "MD" | null;
  estado: "evaluado" | "no-evaluable";
  ataque_ms: number | null;
}

export interface DesfaseDeAtaque {
  idx: number;
  mano: "MI" | "MD" | null;
  /** Adelanto (−) o retraso (+) respecto del pulso, en ms; null sin vecinas para medirlo. */
  ms: number | null;
  /** Mitad del ancho de la franja: PRM-10 (25 %) del intervalo local, en ms. */
  tolerancia: number | null;
  dentro: boolean | null;
}

/**
 * Desfase de cada ataque respecto del pulso local: el punto medio entre la nota anterior y la
 * siguiente de la misma mano, la misma medida con que el núcleo marca un tropiezo (PRM-10).
 */
export function desfasesDelPulso(eventos: readonly EventoConAtaque[]): DesfaseDeAtaque[] {
  const medidos = new Map<number, { ms: number; tolerancia: number }>();
  for (const mano of ["MI", "MD"] as const) {
    const serie = eventos
      .filter((e) => e.mano === mano && e.estado === "evaluado" && e.ataque_ms !== null)
      .sort((a, b) => a.idx - b.idx);
    for (let i = 1; i < serie.length - 1; i++) {
      const [antes, actual, despues] = [serie[i - 1]!, serie[i]!, serie[i + 1]!];
      const medio = (antes.ataque_ms! + despues.ataque_ms!) / 2;
      const intervalo = (despues.ataque_ms! - antes.ataque_ms!) / 2;
      medidos.set(actual.idx, {
        ms: redondear1(actual.ataque_ms! - medio),
        tolerancia: redondear1(UMBRAL_TROPIEZO * intervalo),
      });
    }
  }
  return [...eventos]
    .sort((a, b) => a.idx - b.idx)
    .map((e) => {
      const m = medidos.get(e.idx);
      return {
        idx: e.idx,
        mano: e.mano,
        ms: m?.ms ?? null,
        tolerancia: m?.tolerancia ?? null,
        dentro: m ? Math.abs(m.ms) <= m.tolerancia : null,
      };
    });
}

type IntentoCalificado = Pick<IntentoGuardado, "iniciado_en" | "estado"> & {
  calificacion: Pick<CalificacionVariable, "clase" | "pct">[] | null;
};

/** Promedio semanal del % de cada variable (lo mismo que la vista de Mi progreso, en el cliente). */
export function progresoSemanal(intentos: readonly IntentoCalificado[]): SemanaDeProgreso[] {
  const grupos = new Map<string, { semana: string; clase: Clase; suma: number; n: number }>();
  for (const i of intentos) {
    if (i.estado !== "evaluado" || !i.calificacion) continue;
    const semana = fechaIso(lunesDe(new Date(i.iniciado_en)));
    for (const c of i.calificacion) {
      if (c.pct === null) continue;
      const clave = `${semana}|${c.clase}`;
      const g = grupos.get(clave) ?? { semana, clase: c.clase, suma: 0, n: 0 };
      g.suma += c.pct;
      g.n++;
      grupos.set(clave, g);
    }
  }
  return [...grupos.values()]
    .sort((a, b) => a.semana.localeCompare(b.semana) || a.clase.localeCompare(b.clase))
    .map((g) => ({
      semana: g.semana,
      clase: g.clase,
      intentos: g.n,
      pct_promedio: redondear1(g.suma / g.n),
    }));
}

/** La clase de un indicador: "IND-B2" → "ER-B" (la misma regla que la vista de errores). */
export const claseDeIndicador = (indicador: string) => `ER-${indicador.charAt(4)}` as Clase;

/**
 * En cuántos de los últimos N intentos evaluados (con indicadores registrados) apareció cada
 * clase. Ordenado de la más frecuente a la menos: son errores del mismo estudiante.
 */
export function erroresRecurrentes(
  intentos: readonly (Pick<IntentoGuardado, "iniciado_en" | "estado"> & {
    indicadores_deficientes: string[] | null;
  })[],
  ultimos: number,
): { considerados: number; errores: { clase: Clase; intentos: number }[] } {
  const recientes = intentos
    .filter((i) => i.estado === "evaluado" && i.indicadores_deficientes !== null)
    .sort((a, b) => b.iniciado_en.localeCompare(a.iniciado_en))
    .slice(0, ultimos);
  const cuenta = new Map<Clase, number>();
  for (const i of recientes) {
    for (const c of new Set(i.indicadores_deficientes!.map(claseDeIndicador))) {
      cuenta.set(c, (cuenta.get(c) ?? 0) + 1);
    }
  }
  return {
    considerados: recientes.length,
    errores: CLASES.filter((c) => cuenta.has(c))
      .map((clase) => ({ clase, intentos: cuenta.get(clase)! }))
      .sort((a, b) => b.intentos - a.intentos),
  };
}

export interface PuntoSemanal {
  /** Lunes de la semana (YYYY-MM-DD). */
  desde: string;
  valor: number;
}

/** Intentos por semana en las últimas `semanas` semanas, de la más antigua a la actual. */
export function serieSemanal(
  intentos: readonly Pick<IntentoGuardado, "iniciado_en">[],
  ahora: Date,
  semanas: number,
): PuntoSemanal[] {
  const actual = lunesDe(ahora);
  const inicios = Array.from({ length: semanas }, (_, k) => {
    const d = new Date(actual);
    d.setDate(d.getDate() - 7 * (semanas - 1 - k));
    return d;
  });
  return inicios.map((d) => {
    const desde = d.getTime();
    const hasta = desde + 7 * DIA_MS + 2 * 3_600_000; // margen por cambio de horario
    const valor = intentos.filter((i) => {
      const t = new Date(i.iniciado_en).getTime();
      return t >= desde && t < hasta && lunesDe(new Date(t)).getTime() === desde;
    }).length;
    return { desde: fechaIso(d), valor };
  });
}

export interface PuntoDeIntento {
  fecha: string;
  valor: number | null;
}

/** % de una variable en cada intento calificado, del más antiguo al más reciente. */
export function serieDeVariable(
  intentos: readonly IntentoCalificado[],
  clase: Clase,
): PuntoDeIntento[] {
  return intentos
    .filter((i) => i.calificacion !== null)
    .sort((a, b) => a.iniciado_en.localeCompare(b.iniciado_en))
    .map((i) => ({
      fecha: i.iniciado_en,
      valor: i.calificacion!.find((c) => c.clase === clase)?.pct ?? null,
    }));
}

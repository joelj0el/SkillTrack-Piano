import { describe, expect, it } from "vitest";
import {
  desfasesDelPulso,
  erroresRecurrentes,
  progresoSemanal,
  serieDeVariable,
  serieSemanal,
} from "./datos.ts";

// Datos SINTÉTICOS.
const ev = (idx: number, ataque_ms: number | null, mano: "MI" | "MD" = "MD") => ({
  idx,
  mano,
  estado: "evaluado" as const,
  ataque_ms,
});

const intento = (
  iniciado_en: string,
  pcts: Partial<Record<string, number | null>>,
  indicadores: string[] | null = null,
  estado: "evaluado" | "no_evaluable" = "evaluado",
) => ({
  iniciado_en,
  estado,
  indicadores_deficientes: indicadores,
  calificacion: Object.entries(pcts).map(([clase, pct]) => ({
    clase: clase as "ER-A",
    nivel: pct === null ? ("no-evaluado" as const) : ("logrado" as const),
    pct: pct ?? null,
  })),
});

describe("desfasesDelPulso", () => {
  it("PU-web-39: mide cada ataque contra el punto medio de sus vecinas de la misma mano, con la franja de PRM-10", () => {
    const r = desfasesDelPulso([ev(0, 0), ev(1, 260), ev(2, 500), ev(3, 1000)]);
    expect(r.map((x) => x.ms)).toEqual([null, 10, -130, null]);
    // Tolerancia: 25 % del intervalo local ((500 − 0) / 2 = 250 → 62,5 ms).
    expect(r[1]).toMatchObject({ tolerancia: 62.5, dentro: true });
    expect(r[2]).toMatchObject({ tolerancia: 92.5, dentro: false });
    expect(r[0]).toMatchObject({ tolerancia: null, dentro: null });
  });

  it("PU-web-40: separa las manos y omite los eventos sin ataque o no evaluables", () => {
    const r = desfasesDelPulso([
      ev(0, 0, "MI"),
      ev(1, 0, "MD"),
      ev(2, 240, "MI"),
      ev(3, null, "MD"),
      { ...ev(4, 250, "MD"), estado: "no-evaluable" as const },
      ev(5, 500, "MI"),
    ]);
    expect(r.find((x) => x.idx === 2)?.ms).toBe(-10);
    expect(r.find((x) => x.idx === 3)?.ms).toBeNull();
    expect(r.find((x) => x.idx === 4)?.ms).toBeNull();
    expect(r).toHaveLength(6);
  });
});

describe("progresoSemanal", () => {
  it("PU-web-41: promedia el % de cada variable por semana (lunes) solo en intentos evaluados", () => {
    const s = progresoSemanal([
      intento("2026-11-03T15:00:00Z", { "ER-A": 80, "ER-E": null }),
      intento("2026-11-05T15:00:00Z", { "ER-A": 90 }),
      intento("2026-11-11T15:00:00Z", { "ER-A": 70 }),
      intento("2026-11-12T15:00:00Z", { "ER-A": 10 }, null, "no_evaluable"),
    ]);
    expect(s).toEqual([
      { semana: "2026-11-02", clase: "ER-A", intentos: 2, pct_promedio: 85 },
      { semana: "2026-11-09", clase: "ER-A", intentos: 1, pct_promedio: 70 },
    ]);
  });
});

describe("erroresRecurrentes", () => {
  it("PU-web-42: cuenta en cuántos de los últimos N intentos evaluados aparece cada clase", () => {
    const r = erroresRecurrentes(
      [
        intento("2026-11-12T10:00:00Z", {}, ["IND-A1", "IND-B1", "IND-B2"]),
        intento("2026-11-11T10:00:00Z", {}, ["IND-B1"]),
        intento("2026-11-10T10:00:00Z", {}, []),
        intento("2026-11-09T10:00:00Z", {}, ["IND-C1"]),
        intento("2026-11-08T10:00:00Z", {}, null),
      ],
      3,
    );
    expect(r.considerados).toBe(3);
    expect(r.errores).toEqual([
      { clase: "ER-B", intentos: 2 },
      { clase: "ER-A", intentos: 1 },
    ]);
  });
});

describe("series", () => {
  it("PU-web-43: cuenta intentos por semana en las últimas N semanas, de la más antigua a la actual", () => {
    const ahora = new Date(2026, 10, 18, 12);
    const serie = serieSemanal(
      [
        { iniciado_en: new Date(2026, 10, 17, 9).toISOString() },
        { iniciado_en: new Date(2026, 10, 16, 9).toISOString() },
        { iniciado_en: new Date(2026, 10, 4, 9).toISOString() },
        { iniciado_en: new Date(2026, 8, 1, 9).toISOString() },
      ],
      ahora,
      4,
    );
    expect(serie.map((s) => s.valor)).toEqual([0, 1, 0, 2]);
    expect(serie.at(-1)?.desde).toBe("2026-11-16");
  });

  it("PU-web-44: da el % de una variable por intento en orden cronológico, null si no se evaluó", () => {
    const serie = serieDeVariable(
      [
        intento("2026-11-12T10:00:00Z", { "ER-A": 95 }),
        intento("2026-11-10T10:00:00Z", { "ER-A": null }),
        intento("2026-11-09T10:00:00Z", { "ER-A": 60 }),
      ],
      "ER-A",
    );
    expect(serie.map((p) => p.valor)).toEqual([60, null, 95]);
  });
});

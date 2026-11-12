import { describe, expect, it } from "vitest";
import { ObservacionNueva, TareaNueva, ValoracionNueva } from "./index.ts";

const tarea = {
  estudiante_id: 1,
  ejercicio_id: 1,
  manos: "juntas",
  tempo_min_bpm: 60,
  tempo_max_bpm: 70,
  repeticiones_por_dia: 3,
  fecha_limite: "2026-11-17",
};

describe("contratos de pedagogía", () => {
  it("PU-contracts-12: la tarea exige tempo dentro de PRM-02 y repeticiones dentro de PRM-20", () => {
    expect(TareaNueva.safeParse(tarea).success).toBe(true);
    expect(TareaNueva.safeParse({ ...tarea, tempo_min_bpm: 59 }).success).toBe(false);
    expect(TareaNueva.safeParse({ ...tarea, tempo_max_bpm: 76 }).success).toBe(false);
    expect(TareaNueva.safeParse({ ...tarea, repeticiones_por_dia: 0 }).success).toBe(false);
    expect(TareaNueva.safeParse({ ...tarea, repeticiones_por_dia: 21 }).success).toBe(false);
  });

  it("PU-contracts-13: la observación acepta hasta 1000 caracteres y el aspecto es opcional", () => {
    expect(ObservacionNueva.safeParse({ tarea_id: 1, texto: "a".repeat(1000) }).success).toBe(true);
    expect(ObservacionNueva.safeParse({ tarea_id: 1, texto: "a".repeat(1001) }).success).toBe(
      false,
    );
    expect(ObservacionNueva.safeParse({ tarea_id: 1, texto: "  " }).success).toBe(false);
    expect(
      ObservacionNueva.safeParse({ tarea_id: 1, clase_error_id: 2, texto: "Mejora…" }).success,
    ).toBe(true);
  });

  it("PU-contracts-29: Por repetir exige observación con aspecto y solo Por repetir admite plazo nuevo", () => {
    const obs = { clase_error_id: 2, texto: "Repite la bajada" };
    const ok = (v: unknown) => ValoracionNueva.safeParse(v).success;
    expect(ok({ valor: "lograda" })).toBe(true);
    expect(ok({ valor: "por_repetir", observacion: obs, fecha_limite: "2026-11-20" })).toBe(true);
    expect(ok({ valor: "por_repetir" })).toBe(false);
    expect(ok({ valor: "por_repetir", observacion: { texto: "Repite" } })).toBe(false);
    expect(ok({ valor: "lograda", fecha_limite: "2026-11-20" })).toBe(false);
    expect(ok({ valor: "en_proceso" })).toBe(false);
  });
});

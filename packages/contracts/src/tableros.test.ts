import { describe, expect, it } from "vitest";
import { MiGrupo, MiProgreso } from "./tableros.ts";

describe("tableros (HU-15)", () => {
  it("PU-contracts-30: Mi progreso solo admite semanas con el % promedio de una variable", () => {
    const semana = { semana: "2026-11-09", clase: "ER-A", intentos: 3, pct_promedio: 81.5 };
    expect(MiProgreso.safeParse({ semanas: [semana] }).success).toBe(true);
    expect(MiProgreso.safeParse({ semanas: [{ ...semana, pct_promedio: 101 }] }).success).toBe(
      false,
    );
    // Sin puntaje global ni posición: un campo extra se rechaza.
    expect(MiProgreso.safeParse({ semanas: [], puntaje_global: 80 }).success).toBe(false);
  });

  it("PU-contracts-31: Mi grupo no admite rankings, posiciones ni puntajes por estudiante", () => {
    const estudiante = {
      estudiante_id: 7,
      nombre_visible: "Ana",
      intentos_considerados: 5,
      errores: [{ clase: "ER-B", intentos_con_error: 3, indicadores: ["IND-B2"] }],
    };
    expect(MiGrupo.safeParse({ ultimos: 10, estudiantes: [estudiante] }).success).toBe(true);
    for (const extra of [{ posicion: 1 }, { puntaje: 90 }, { estrellas: 3 }]) {
      const r = MiGrupo.safeParse({ ultimos: 10, estudiantes: [{ ...estudiante, ...extra }] });
      expect(r.success).toBe(false);
    }
    expect(MiGrupo.safeParse({ ultimos: 51, estudiantes: [] }).success).toBe(false);
  });
});

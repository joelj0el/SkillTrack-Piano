import { describe, expect, it } from "vitest";
import { etiquetaTempo, opcionesTempo, programa } from "./metronomo.ts";

describe("metrónomo y conteo previo", () => {
  it("PU-tempo-01: a ♩ = 60 el conteo son 4 clics de 1 s y la medición empieza en el quinto pulso", () => {
    const p = programa(60, "sin", 8);
    expect(p.conteo).toEqual([0, 1, 2, 3]);
    expect(p.inicioMedicion).toBe(4);
  });

  it("PU-tempo-02: con metrónomo el pulso visual sigue al tempo elegido; sin metrónomo, nada", () => {
    const con = programa(60, "con", 3);
    expect(con.pulsosVisuales).toEqual([4, 5, 6]);
    expect(programa(60, "sin", 3).pulsosVisuales).toEqual([]);
  });

  it("PU-tempo-03: a ♩ = 75 el pulso dura 0,8 s", () => {
    const p = programa(75, "con", 1.6);
    expect(p.conteo[1]).toBeCloseTo(0.8);
    expect(p.inicioMedicion).toBeCloseTo(3.2);
    expect(p.pulsosVisuales).toHaveLength(2);
  });

  it("PU-tempo-04: con tarea 60–70 el selector va de 40 a 70 y por debajo de 60 es práctica lenta", () => {
    const o = opcionesTempo({ tempoMin: 60, tempoMax: 70 });
    expect([o.min, o.max]).toEqual([40, 70]);
    expect(etiquetaTempo(59, o)).toBe("Práctica lenta: no cuenta para la tarea");
    expect(etiquetaTempo(60, o)).toBeNull();
  });

  it("PU-tempo-05: sin tarea el selector cubre todo el rango y no hay práctica lenta", () => {
    const o = opcionesTempo(null);
    expect([o.min, o.max]).toEqual([40, 75]);
    expect(etiquetaTempo(40, o)).toBeNull();
  });
});

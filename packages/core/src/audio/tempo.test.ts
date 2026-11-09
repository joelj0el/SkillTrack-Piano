import { describe, expect, it } from "vitest";
import { analizarTempo, tempoEnRango } from "./tempo.ts";

/** Ataques de semicorcheas a un tempo que puede variar linealmente de `desde` a `hasta`. */
function ataques(cantidad: number, desde: number, hasta = desde): number[] {
  const t = [0];
  for (let i = 1; i < cantidad; i++) {
    const tempo = desde + ((hasta - desde) * i) / (cantidad - 1);
    t.push(t[i - 1]! + 60 / (4 * tempo));
  }
  return t;
}

const SIN = { metronomo: "sin", tempoElegido: null } as const;

describe("tempo y regularidad sobre los ataques", () => {
  it("PU-audio-10: a ♩ = 60 constante el tempo es estable y no hay tropiezos", () => {
    const r = analizarTempo(ataques(29, 60), SIN);
    expect(r.estado).toBe("estable");
    expect(r.tempoInicial).toBeCloseTo(60);
    expect(r.tropiezos).toEqual([]);
  });

  it("PU-audio-11: de 60 a 66 se informa que aceleraste, y de 66 a 60 que frenaste", () => {
    const acelera = analizarTempo(ataques(58, 60, 66), SIN);
    expect(acelera.estado).toBe("aceleraste");
    expect(acelera.tempoFinal).toBeGreaterThan(acelera.tempoInicial);
    expect(acelera.cambioPct).toBeGreaterThan(5);

    expect(analizarTempo(ataques(58, 66, 60), SIN).estado).toBe("frenaste");
  });

  it("PU-audio-12: frontera de PRM-09: 5 % es estable, un poco más ya no", () => {
    const n = 40;
    const conCambio = (pct: number) => {
      const t = ataques(n, 60);
      // Mitad final a un tempo `pct` más rápido.
      for (let i = n / 2; i < n; i++) t[i] = t[i - 1]! + 60 / (4 * 60 * (1 + pct));
      return analizarTempo(t, SIN).estado;
    };
    expect(conCambio(0.0499)).toBe("estable");
    expect(conCambio(0.06)).toBe("aceleraste");
  });

  it("PU-audio-13: una nota retrasada 40 % con recuperación marca solo ese evento y el tempo sigue estable", () => {
    const t = ataques(29, 60);
    const intervalo = 0.25;
    t[10] = t[10]! + 0.4 * intervalo;
    const r = analizarTempo(t, SIN);

    expect(r.tropiezos).toEqual([10]);
    expect(r.estado).toBe("estable");
  });

  it("PU-audio-14: frontera de PRM-10: 24 % no es tropiezo, 26 % sí", () => {
    const con = (pct: number) => {
      const t = ataques(29, 60);
      t[10] = t[10]! + pct * 0.25;
      return analizarTempo(t, SIN).tropiezos;
    };
    expect(con(0.24)).toEqual([]);
    expect(con(0.26)).toEqual([10]);
  });

  it("PU-audio-15: la referencia es el tempo elegido con metrónomo y el inicial sin él", () => {
    const t = ataques(29, 63);
    const con = analizarTempo(t, { metronomo: "con", tempoElegido: 60 });
    expect(con.referencia).toBe("tempo_elegido");
    expect(con.tempoReferencia).toBe(60);
    const sin = analizarTempo(t, SIN);
    expect(sin.referencia).toBe("tempo_inicial");
    expect(sin.tempoReferencia).toBeCloseTo(63);
  });

  it("PU-audio-16: fuera del rango de la tarea se informa y no cuenta", () => {
    expect(tempoEnRango(55.2, 60, 70)).toEqual({
      cuenta: false,
      mensaje: "Tocaste a ♩≈55; tu tarea pide 60–70",
    });
    expect(tempoEnRango(60, 60, 70).cuenta).toBe(true);
    expect(tempoEnRango(70.4, 60, 70).cuenta).toBe(true);
  });
});

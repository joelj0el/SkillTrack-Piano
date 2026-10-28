import { describe, expect, it } from "vitest";
import { nombreNota, rangoDe, secuenciaEscala, tonicaDe } from "./escala.ts";
import { resultadoVisual } from "./resultado.ts";

describe("secuencia provisional de la escala", () => {
  it("PU-exercise-01: Do mayor a una mano: 29 notas, Do4 a Do6 y de vuelta", () => {
    const s = secuenciaEscala("Do mayor", "MD");
    expect(s).toHaveLength(29);
    expect(s.slice(0, 8).map((n) => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71, 72]);
    expect(s[14]!.midi).toBe(84);
    expect(s.at(-1)!.midi).toBe(60);
    expect(s[1]!.tiempoBeats).toBe(0.25);
  });

  it("PU-exercise-02: a manos juntas la izquierda va una octava abajo, en paralelo", () => {
    const s = secuenciaEscala("Fa mayor", "juntas");
    const mi = s.filter((n) => n.mano === "MI");
    const md = s.filter((n) => n.mano === "MD");
    expect(mi).toHaveLength(29);
    md.forEach((n, i) => expect(n.midi - mi[i]!.midi).toBe(12));
    expect(rangoDe(s)).toEqual({ min: 53, max: 89 });
  });

  it("PU-exercise-03: tónicas del repertorio y alteraciones de Si♭ y Mi♭", () => {
    expect(["Do mayor", "Fa mayor", "Si♭ mayor", "Mi♭ mayor"].map(tonicaDe)).toEqual([0, 5, 10, 3]);
    const sib = secuenciaEscala("Si♭ mayor", "MD")
      .slice(0, 8)
      .map((n) => nombreNota(n.midi));
    expect(sib).toEqual(["Si♭3", "Do4", "Re4", "Mi♭4", "Fa4", "Sol4", "La4", "Si♭4"]);
    expect(() => tonicaDe("Re menor")).toThrow(/no reconocida/);
  });
});

describe("resultado visual por nota", () => {
  it("PU-exercise-04: empareja en orden por mano y tecla; lo que falta queda no evaluable", () => {
    const esperadas = secuenciaEscala("Do mayor", "MD").slice(0, 3);
    const r = resultadoVisual(esperadas, [
      { mano: "MD", dedo: "pulgar", t: 0.1, midi: 60 },
      { mano: "MD", dedo: "medio", t: 0.6, midi: 64 },
      { mano: "MI", dedo: "indice", t: 0.3, midi: 62 },
    ]);
    expect(r.map((x) => x.resultado.estado)).toEqual(["detectada", "no-evaluable", "detectada"]);
    expect(r[1]!.resultado).toEqual({ estado: "no-evaluable", motivo: "sin evento visual" });
  });
});

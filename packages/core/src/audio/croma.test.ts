import { describe, expect, it } from "vitest";
import { cromaEnAtaque, verificarClase } from "./croma.ts";
import { secuencia } from "./sintesis.ts";

const TASA = 22050;
const clase = (midi: number) => midi % 12;

describe("croma por ataque", () => {
  it("PU-audio-17: cada nota de las escalas del repertorio se verifica como correcta", () => {
    // Escalas de Do, Fa, Si♭ y Mi♭ mayor, una octava ascendente a ♩ = 60.
    const escalas = [
      [60, 62, 64, 65, 67, 69, 71, 72],
      [53, 55, 57, 58, 60, 62, 64, 65],
      [58, 60, 62, 63, 65, 67, 69, 70],
      [51, 53, 55, 56, 58, 60, 62, 63],
    ];
    for (const escala of escalas) {
      const tiempos = escala.map((_, i) => 0.3 + i * 0.25);
      const senal = secuencia(
        escala.map((midi, i) => ({ midi, t: tiempos[i]! })),
        2.8,
        TASA,
      );
      escala.forEach((midi, i) => {
        const croma = cromaEnAtaque(senal, TASA, tiempos[i]!);
        expect(verificarClase(croma, clase(midi)), `midi ${midi}`).toBe("correcta");
      });
    }
  });

  it("PU-audio-18: una nota equivocada se marca incorrecta", () => {
    const senal = secuencia([{ midi: 61, t: 0.3 }], 1, TASA);
    expect(verificarClase(cromaEnAtaque(senal, TASA, 0.3), clase(62))).toBe("incorrecta");
  });

  it("PU-audio-19: dos manos en octava paralela dan la misma clase", () => {
    const senal = secuencia(
      [
        { midi: 48, t: 0.3 },
        { midi: 60, t: 0.3 },
      ],
      1,
      TASA,
    );
    expect(verificarClase(cromaEnAtaque(senal, TASA, 0.3), 0)).toBe("correcta");
  });

  it("PU-audio-20: con energía insuficiente queda dudosa, nunca incorrecta", () => {
    const debil = secuencia([{ midi: 61, t: 0.3, amplitud: 0.0005 }], 1, TASA);
    expect(verificarClase(cromaEnAtaque(debil, TASA, 0.3), clase(62))).toBe("dudosa");
    expect(verificarClase(cromaEnAtaque(new Float32Array(TASA), TASA, 0.3), 0)).toBe("dudosa");
  });
});

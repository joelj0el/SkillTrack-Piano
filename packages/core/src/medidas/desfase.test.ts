import { describe, expect, it } from "vitest";
import { alinearPorMano, golpesPorMano, type AtaqueAudio } from "../alineacion/manos.ts";
import { midiAHz, nota } from "../audio/sintesis.ts";
import { bandaEnAtaque } from "../audio/registro.ts";
import { secuenciaEscala } from "../ejercicio/escala.ts";
import type { EventoVisual } from "../rasgos/dedos.ts";
import { atribuirDedo, desfaseEntreManos, UMBRAL_MANOS_DESFASADAS } from "./desfase.ts";

// Datos SINTÉTICOS: Do mayor a manos juntas, ♩ = 60, una nota cada 0,25 s desde t = 1 s.
const esperadas = secuenciaEscala("Do mayor", "juntas");
const instante = (beats: number) => 1 + beats;

/** Cada mano toca su secuencia; la izquierda con un retraso fijo (s) o una nota atrás. */
function escena(retrasoMI: number, notaAtras = false) {
  const ataques: AtaqueAudio[] = [];
  const visuales: EventoVisual[] = [];
  const md = esperadas.filter((n) => n.mano === "MD");
  const mi = esperadas.filter((n) => n.mano === "MI");
  md.forEach((n) => {
    ataques.push({ t: instante(n.tiempoBeats), clase: n.claseAltura });
    visuales.push({ mano: "MD", dedo: "indice", t: instante(n.tiempoBeats), midi: n.midi });
  });
  mi.forEach((n, k) => {
    const atras = notaAtras && k >= 4 && k < 11 ? 0.25 : notaAtras && k === 11 ? 0.125 : 0;
    const t = instante(n.tiempoBeats) + retrasoMI + atras;
    if (!ataques.some((a) => Math.abs(a.t - t) < 1e-6)) ataques.push({ t, clase: n.claseAltura });
    visuales.push({ mano: "MI", dedo: "medio", t, midi: n.midi });
  });
  ataques.sort((a, b) => a.t - b.t);
  const alineado = alinearPorMano(esperadas, golpesPorMano(ataques, visuales, "juntas"), 1);
  return { ataques, visuales, alineado };
}

/** Banda de registro de cada ataque según quién lo tocó en la escena (simula el audio). */
const bandaPorTiempo = (ataques: AtaqueAudio[], tardeEsMI: boolean) => (i: number) => {
  const sincopado = ataques.some((a, j) => j !== i && Math.abs(a.t - ataques[i]!.t) < 0.2);
  if (!sincopado) return null;
  const primero = ataques.findIndex((a) => Math.abs(a.t - ataques[i]!.t) < 0.2);
  return primero === i ? (tardeEsMI ? "aguda" : "grave") : tardeEsMI ? "grave" : "aguda";
};

describe("desfase entre manos (IND-B3)", () => {
  it("PU-desfase-01: la izquierda 80 ms tarde se marca en cada evento, con el valor en ms", () => {
    const { ataques, visuales, alineado } = escena(0.08);
    const d = desfaseEntreManos(esperadas, alineado, visuales, bandaPorTiempo(ataques, true));
    const marcados = [...d.values()];
    expect(marcados).toHaveLength(esperadas.length);
    for (const x of marcados) {
      expect(x.estado).toBe("tarde");
      expect(x.manoTarde).toBe("MI");
      expect(x.ms).toBeCloseTo(80, 6);
      expect(x.modalidad).toBe("VA");
    }
  });

  it("PU-desfase-02: un retraso de 10 ms no supera el umbral y no se marca", () => {
    expect(0.01).toBeLessThan(UMBRAL_MANOS_DESFASADAS);
    const { ataques, visuales, alineado } = escena(0.01);
    const d = desfaseEntreManos(esperadas, alineado, visuales, bandaPorTiempo(ataques, true));
    expect([...d.values()].every((x) => x.estado === "a-tiempo")).toBe(true);
  });

  it("PU-desfase-03: si el registro y la visión no coinciden, la mano queda sin identificar", () => {
    const { ataques, visuales, alineado } = escena(0.08);
    const d = desfaseEntreManos(esperadas, alineado, visuales, bandaPorTiempo(ataques, false));
    expect([...d.values()].every((x) => x.estado === "tarde" && x.manoTarde === null)).toBe(true);
  });

  it("PU-desfase-04: una nota atrás se marca como tal y no como nota incorrecta", () => {
    const { ataques, visuales, alineado } = escena(0, true);
    const d = desfaseEntreManos(esperadas, alineado, visuales, bandaPorTiempo(ataques, true));
    const atras = esperadas.filter((n) => d.get(n.idx)?.estado === "una-nota-atras");
    const indices = esperadas.filter((n) => n.mano === "MI").slice(4, 11);
    expect(atras.filter((n) => n.mano === "MI").map((n) => n.idx)).toEqual(
      indices.map((n) => n.idx),
    );
    expect(atras.every((n) => d.get(n.idx)!.manoTarde === "MI")).toBe(true);
    expect(alineado.eventos.some((e) => e.estado === "incorrecta")).toBe(false);
  });

  it("PU-desfase-05: sin audio no se mide en ms, pero una nota atrás sí se ve", () => {
    const { visuales } = escena(0.08);
    const soloVision = alinearPorMano(esperadas, golpesPorMano([], visuales, "juntas"), 1);
    const d = desfaseEntreManos(esperadas, soloVision, visuales);
    expect([...d.values()].every((x) => x.estado === "no-medible" && x.ms === null)).toBe(true);
  });
});

describe("banda de registro del ataque", () => {
  const TASA = 22050;
  const mezcla = (primero: number, segundo: number) => {
    const s = new Float32Array(TASA * 2);
    nota(s, midiAHz(primero), 0.5, TASA);
    nota(s, midiAHz(segundo), 0.58, TASA);
    return s;
  };

  it("PU-registro-01: el segundo ataque una octava más grave es de la mano izquierda", () => {
    expect(bandaEnAtaque(mezcla(60, 48), TASA, 0.58, 48, 60)).toBe("grave");
  });

  it("PU-registro-02: el segundo ataque una octava más aguda es de la mano derecha", () => {
    expect(bandaEnAtaque(mezcla(48, 60), TASA, 0.58, 48, 60)).toBe("aguda");
  });

  it("PU-registro-03: en silencio no hay banda", () => {
    expect(bandaEnAtaque(new Float32Array(TASA), TASA, 0.5, 48, 60)).toBeNull();
  });
});

describe("dedo atribuido (E11)", () => {
  it("PU-fusion-04: se elige el dedo que más bajó sobre la tecla esperada, en la mano del evento", () => {
    const md = esperadas.filter((n) => n.mano === "MD");
    const visuales: EventoVisual[] = [
      { mano: "MD", dedo: "indice", t: 1, midi: 60, profundidad: 0.1, zona: 0.4 },
      { mano: "MD", dedo: "pulgar", t: 1.02, midi: 60, profundidad: 0.3, zona: 0.2 },
      { mano: "MD", dedo: "medio", t: 1.01, midi: 62, profundidad: 0.9, zona: 0.5 },
      { mano: "MI", dedo: "menique", t: 1, midi: 60, profundidad: 0.8, zona: 0.1 },
    ];
    const alineado = alinearPorMano(
      md.slice(0, 1),
      golpesPorMano([{ t: 1, clase: 0 }], visuales, "MD"),
      1,
    );
    const r = atribuirDedo(alineado.eventos[0]!, md[0]!, visuales);
    expect(r).toEqual({ dedo: "pulgar", tecla: 60, zona: 0.2, visual: 1 });
  });

  it("PU-fusion-05: sin evento en la tecla esperada se usa el del golpe; sin golpe, nada", () => {
    const md = esperadas.filter((n) => n.mano === "MD");
    const visuales: EventoVisual[] = [
      { mano: "MD", dedo: "medio", t: 1, midi: 62, profundidad: 0.5, zona: 0.3 },
    ];
    const alineado = alinearPorMano(
      md.slice(0, 1),
      golpesPorMano([{ t: 1, clase: 2 }], visuales, "MD"),
      1,
    );
    expect(atribuirDedo(alineado.eventos[0]!, md[0]!, visuales)).toEqual({
      dedo: "medio",
      tecla: 62,
      zona: 0.3,
      visual: 0,
    });
    const faltante = { idx: 0, mano: "MD" as const, golpe: null, estado: "faltante" as const };
    expect(atribuirDedo(faltante, md[0]!, visuales)).toEqual({
      dedo: null,
      tecla: null,
      zona: null,
      visual: null,
    });
  });
});

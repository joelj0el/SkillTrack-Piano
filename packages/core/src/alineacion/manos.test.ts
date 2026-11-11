import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { secuenciaEscala, type NotaEsperada } from "../ejercicio/escala.ts";
import type { EventoVisual } from "../rasgos/dedos.ts";
import { alinearPorMano, golpesPorMano, type AtaqueAudio } from "./manos.ts";

// Datos SINTÉTICOS: Do mayor a manos juntas, ♩ = 60, semicorcheas (0,25 s por nota), desde t = 1 s.
const PERIODO = 1;
const INICIO = 1;
const esperadas = secuenciaEscala("Do mayor", "juntas");
const deMano = (mano: "MI" | "MD") => esperadas.filter((n) => n.mano === mano);
const instante = (n: NotaEsperada) => INICIO + n.tiempoBeats * PERIODO;

function visual(mano: "MI" | "MD", t: number, midi: number | null): EventoVisual {
  return { mano, dedo: "indice", t, midi };
}

/** Escena sintética: cada mano toca su secuencia con un retraso por nota (s) y notas cambiadas. */
function escena(retrasoMI: (k: number) => number = () => 0, cambiar: Record<number, number> = {}) {
  const ataques: AtaqueAudio[] = [];
  const visuales: EventoVisual[] = [];
  deMano("MD").forEach((n) => {
    ataques.push({ t: instante(n), clase: n.claseAltura });
    visuales.push(visual("MD", instante(n), n.midi));
  });
  deMano("MI").forEach((n, k) => {
    const t = instante(n) + retrasoMI(k);
    const midi = cambiar[k] ?? n.midi;
    const juntas = ataques.find((a) => Math.abs(a.t - t) < 0.005);
    if (!juntas) ataques.push({ t, clase: midi % 12 });
    visuales.push(visual("MI", t, midi));
  });
  ataques.sort((a, b) => a.t - b.t);
  return { ataques, visuales };
}

describe("alineamiento por mano (E9)", () => {
  it("PU-alineacion-01: a manos juntas, un ataque en octava sirve a una nota de cada mano", () => {
    const { ataques, visuales } = escena();
    const golpes = golpesPorMano(ataques, visuales, "juntas");
    const r = alinearPorMano(esperadas, golpes, PERIODO);
    expect(r.eventos.every((e) => e.estado === "correcta")).toBe(true);
    expect(r.eventos.every((e) => e.golpe?.modalidad === "VA")).toBe(true);
    const primero = r.eventos.filter((e) => e.golpe?.t === INICIO);
    expect(primero.map((e) => e.mano).sort()).toEqual(["MD", "MI"]);
    expect(r.extras).toEqual({ MI: [], MD: [] });
  });

  it("PU-alineacion-02: una mano una nota atrás durante un compás no da notas incorrectas", () => {
    // La izquierda se atrasa una semicorchea desde la nota 4, durante un compás de 2/4.
    // Al final del compás se pone al día a mitad de camino: nunca toca dos notas a la vez.
    const { ataques, visuales } = escena((k) => (k >= 4 && k < 11 ? 0.25 : k === 11 ? 0.125 : 0));
    const r = alinearPorMano(esperadas, golpesPorMano(ataques, visuales, "juntas"), PERIODO);
    const izquierda = r.eventos.filter((e) => e.mano === "MI");
    expect(izquierda.every((e) => e.estado === "correcta")).toBe(true);
    expect(izquierda[4]!.golpe!.t).toBeCloseTo(instante(deMano("MI")[4]!) + 0.25, 6);
  });

  it("PU-alineacion-03: una nota cambiada es incorrecta y una omitida, faltante, sin arrastrar a las demás", () => {
    const md = deMano("MD");
    const ataques: AtaqueAudio[] = [];
    const visuales: EventoVisual[] = [];
    md.forEach((n, k) => {
      if (k === 5) return; // omitida
      const midi = k === 2 ? n.midi + 1 : n.midi; // cambiada
      ataques.push({ t: instante(n), clase: midi % 12 });
      visuales.push(visual("MD", instante(n), midi));
    });
    const r = alinearPorMano(md, golpesPorMano(ataques, visuales, "MD"), PERIODO);
    const estados = r.eventos.map((e) => e.estado);
    expect(estados[2]).toBe("incorrecta");
    expect(estados[5]).toBe("faltante");
    expect(estados.filter((e) => e === "correcta")).toHaveLength(md.length - 2);
  });

  it("PU-alineacion-04: el reanclaje empareja aunque el tempo se frene, sin tocar los tiempos crudos", () => {
    const md = deMano("MD");
    // Cada nota llega un 20 % más tarde de lo esperado: la deriva se acumula.
    const tiempos = md.map((n) => INICIO + n.tiempoBeats * PERIODO * 1.2);
    const ataques = tiempos.map((t, k) => ({ t, clase: md[k]!.claseAltura }));
    const visuales = tiempos.map((t, k) => visual("MD", t, md[k]!.midi));
    const r = alinearPorMano(md, golpesPorMano(ataques, visuales, "MD"), PERIODO);
    expect(r.eventos.every((e) => e.estado === "correcta")).toBe(true);
    expect(r.eventos.map((e) => e.golpe!.t)).toEqual(tiempos);
  });

  it("PU-alineacion-05: sin cámara, a una mano, los ataques de audio se emparejan por la clase oída", () => {
    const md = deMano("MD");
    const ataques = md.map((n) => ({ t: instante(n), clase: n.claseAltura }));
    const r = alinearPorMano(md, golpesPorMano(ataques, [], "MD"), PERIODO);
    expect(r.eventos.every((e) => e.estado === "correcta" && e.golpe?.modalidad === "A")).toBe(
      true,
    );
  });

  it("PP-alineacion-01: nunca dos ataques para el mismo evento ni un ataque para dos eventos de una mano", () => {
    const md = deMano("MD");
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            desvio: fc.double({ min: -0.1, max: 0.1, noNaN: true }),
            omitir: fc.boolean(),
            extra: fc.boolean(),
            cambiar: fc.boolean(),
          }),
          {
            minLength: md.length,
            maxLength: md.length,
          },
        ),
        (ruido) => {
          const ataques: AtaqueAudio[] = [];
          const visuales: EventoVisual[] = [];
          md.forEach((n, k) => {
            const r = ruido[k]!;
            if (r.omitir) return;
            const t = instante(n) + r.desvio;
            const midi = r.cambiar ? n.midi + 2 : n.midi;
            ataques.push({ t, clase: midi % 12 });
            visuales.push(visual("MD", t, midi));
            if (r.extra) ataques.push({ t: t + 0.12, clase: 3 });
          });
          ataques.sort((a, b) => a.t - b.t);
          const golpes = golpesPorMano(ataques, visuales, "MD");
          const r = alinearPorMano(md, golpes, PERIODO);
          const usados = r.eventos.flatMap((e) => (e.golpe ? [e.golpe] : []));
          expect(new Set(usados).size).toBe(usados.length);
          expect(r.eventos).toHaveLength(md.length);
          const tiempos = usados.map((g) => g.t);
          expect([...tiempos].sort((a, b) => a - b)).toEqual(tiempos);
          expect(usados.length + r.extras.MD.length).toBe(golpes.MD.length);
        },
      ),
      { numRuns: 200 },
    );
  });
});

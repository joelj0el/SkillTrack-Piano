import { describe, expect, it } from "vitest";
import { alinearPorMano, golpesPorMano } from "../alineacion/manos.ts";
import type { NotaEsperada } from "../ejercicio/escala.ts";
import { desfaseEntreManos } from "../medidas/desfase.ts";
import type { EventoVisual } from "../rasgos/dedos.ts";
import { registrarEventos } from "./registro.ts";

// Datos SINTÉTICOS: dos instantes a manos juntas (Do y Re), con dedo esperado de partitura.
const esperadas: NotaEsperada[] = [
  { idx: 0, mano: "MI", midi: 48, claseAltura: 0, tiempoBeats: 0, dedo: 5 },
  { idx: 1, mano: "MD", midi: 60, claseAltura: 0, tiempoBeats: 0, dedo: 1 },
  { idx: 2, mano: "MI", midi: 50, claseAltura: 2, tiempoBeats: 1, dedo: 4 },
  { idx: 3, mano: "MD", midi: 62, claseAltura: 2, tiempoBeats: 1, dedo: 2 },
];
const visuales: EventoVisual[] = [
  { mano: "MI", dedo: "menique", t: 1.08, midi: 48, profundidad: 0.4, zona: 0.3 },
  { mano: "MD", dedo: "pulgar", t: 1, midi: 60, profundidad: 0.4, zona: 0.2 },
  { mano: "MD", dedo: "medio", t: 2, midi: 62, profundidad: 0.4, zona: 0.6 },
];
const ataques = [
  { t: 1, clase: 0 },
  { t: 1.08, clase: 0 },
  { t: 2, clase: 2 },
];

function registro() {
  const alineado = alinearPorMano(esperadas, golpesPorMano(ataques, visuales, "juntas"), 1);
  const banda = (i: number) => (i === 1 ? ("grave" as const) : null);
  const desfases = desfaseEntreManos(esperadas, alineado, visuales, banda);
  return registrarEventos({ esperadas, alineado, desfases, visuales });
}

describe("registro por evento (ResultadoIntento v2)", () => {
  it("PU-eventos-01: un evento con audio y visión marca cada dato con su modalidad", () => {
    const [mi] = registro();
    expect(mi).toEqual({
      idx: 0,
      mano: "MI",
      midi_esperado: 48,
      dedo_esperado: 5,
      estado: "evaluado",
      motivo: null,
      ataque_ms: 1080,
      modalidad: "VA",
      nota: { estado: "correcta", midi: 48, clase_oida: 0, modalidad: "VA" },
      dedo: { valor: 5, estado: "correcto", modalidad: "V" },
      tecla: { midi: 48, zona: 0.3, modalidad: "V" },
      desfase_manos: { estado: "tarde", ms: 80, mano_tarde: "MI", modalidad: "VA" },
      rasgos: {},
      rasgos_modalidad: null,
    });
  });

  it("PU-eventos-02: el dedo distinto del esperado es incorrecto; sin visión, solo audio", () => {
    const eventos = registro();
    expect(eventos[3]!.dedo).toEqual({ valor: 3, estado: "incorrecto", modalidad: "V" });
    // La MI del segundo instante solo se oyó: no hay dedo ni tecla, y la nota es solo audio.
    expect(eventos[2]!.dedo).toEqual({ valor: null, estado: "no-detectado", modalidad: null });
    expect(eventos[2]!.tecla).toEqual({ midi: null, zona: null, modalidad: null });
    expect(eventos[2]!.nota.modalidad).toBe("A");
  });

  it("PU-eventos-03: un evento sin ataque es no evaluable y no lleva datos inventados", () => {
    const alineado = alinearPorMano(esperadas.slice(1, 2), { MI: [], MD: [] }, 1);
    const [e] = registrarEventos({
      esperadas: esperadas.slice(1, 2),
      alineado,
      desfases: new Map(),
      visuales: [],
    });
    expect(e).toMatchObject({
      estado: "no-evaluable",
      motivo: "sin ataque",
      ataque_ms: null,
      modalidad: null,
      nota: { estado: "faltante", midi: null, clase_oida: null, modalidad: null },
      desfase_manos: null,
    });
  });

  it("PU-eventos-04: un solo registro por evento esperado, en su orden", () => {
    expect(registro().map((e) => e.idx)).toEqual([0, 1, 2, 3]);
  });
});

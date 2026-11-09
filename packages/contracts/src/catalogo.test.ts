import { describe, expect, it } from "vitest";
import { EventoEsperado, TEMPO_DOCENTE_MAX, TEMPO_DOCENTE_MIN, TEMPO_SUGERIDO } from "./index.ts";

describe("contratos del catálogo", () => {
  it("PU-contracts-10: un evento esperado tiene mano, dedo 1–5, clase de altura 0–11 y MIDI", () => {
    const evento = { idx: 0, tiempo_beats: 0, mano: "MD", dedo: 1, clase_altura: 0, midi: 60 };
    expect(EventoEsperado.safeParse(evento).success).toBe(true);
    expect(EventoEsperado.safeParse({ ...evento, dedo: 6 }).success).toBe(false);
    expect(EventoEsperado.safeParse({ ...evento, clase_altura: 12 }).success).toBe(false);
    expect(EventoEsperado.safeParse({ ...evento, mano: "juntas" }).success).toBe(false);
  });

  it("PU-contracts-11: el tempo sugerido está dentro del rango que asigna el docente (PRM-02)", () => {
    expect(TEMPO_DOCENTE_MIN).toBeLessThanOrEqual(TEMPO_SUGERIDO.min);
    expect(TEMPO_SUGERIDO.max).toBeLessThanOrEqual(TEMPO_DOCENTE_MAX);
  });
});

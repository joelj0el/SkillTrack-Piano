import { describe, expect, it } from "vitest";
import { EventosAudio, FotogramaReproceso } from "./reproceso.ts";

describe("archivos del reprocesamiento", () => {
  it("PU-contracts-17: un fotograma sin manos es válido; una mano incompleta, no", () => {
    expect(FotogramaReproceso.safeParse({ t: 0.5, manos: [] }).success).toBe(true);
    const puntos = Array.from({ length: 20 }, () => [0, 0, 0]);
    const incompleta = { mano: "MI", puntos, mundo: puntos, rasgos: {} };
    expect(FotogramaReproceso.safeParse({ t: 0.5, manos: [incompleta] }).success).toBe(false);
  });

  it("PU-contracts-18: los eventos de audio exigen 12 clases de croma", () => {
    const base = {
      version: 1,
      codigo_toma: "E01",
      pista: true,
      motivo: null,
      tasa_hz: 24000,
    };
    const ataque = { t: 1, clase: 0, energia: 0.5 };
    const croma = new Array(12).fill(0);
    expect(EventosAudio.safeParse({ ...base, ataques: [{ ...ataque, croma }] }).success).toBe(true);
    expect(EventosAudio.safeParse({ ...base, ataques: [{ ...ataque, croma: [1] }] }).success).toBe(
      false,
    );
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  emparejar,
  exhaustividad,
  f1,
  leerAnotacionAcustica,
  precision,
  v1Acustica,
  type TomaAcustica,
} from "./v1-acustica.ts";
import { tablaV1Acustica } from "./v1-informe.ts";

// Datos SINTÉTICOS: instantes inventados (ninguna grabación).
const PLANTILLA = resolve(import.meta.dirname, "../../../plantillas/v1-acustica.csv");

describe("V1 acústica", () => {
  it("PU-research-84: la capa de instantes de Sonic Visualiser se lee con o sin etiqueta de nota", () => {
    expect(leerAnotacionAcustica(readFileSync(PLANTILLA, "utf8"))).toEqual([
      { t: 1.25, clase: 0 },
      { t: 2.031, clase: 2 },
      { t: 2.8, clase: null },
    ]);
    expect(leerAnotacionAcustica('"0.5","Fa#"\n0.25,Sol4')).toEqual([
      { t: 0.25, clase: 7 },
      { t: 0.5, clase: 6 },
    ]);
  });

  it("PU-research-85: cada ataque anotado se empareja con un solo detectado, el más cercano dentro de la tolerancia", () => {
    const anotados = [{ t: 1 }, { t: 1.04 }, { t: 2 }];
    const detectados = [{ t: 1.03 }, { t: 2.2 }];
    // 1,03 está más cerca de 1,04 que de 1: ese par gana; 2,2 queda fuera de ± 50 ms.
    expect(emparejar(anotados, detectados, 0.05)).toEqual([[1, 0]]);
    expect(f1({ vp: 0, fp: 0, fn: 0 })).toBeNull();
  });

  it("PU-research-86: precisión, exhaustividad y F1 de ataques y de notas y error en ms, por origen e instrumento", () => {
    const tomas: TomaAcustica[] = [
      {
        codigo_toma: "T1",
        origen: "real",
        instrumento: "digital",
        anotados: [
          { t: 1, clase: 0 },
          { t: 2, clase: 2 },
          { t: 3, clase: 4 },
          { t: 4, clase: 5 },
        ],
        // Uno tarde 20 ms, otro con la nota equivocada, uno de más y uno que falta.
        detectados: [
          { t: 1.02, clase: 0 },
          { t: 2, clase: 3 },
          { t: 3.01, clase: 4 },
          { t: 3.5, clase: 7 },
        ],
      },
      {
        codigo_toma: "T2",
        origen: "real",
        instrumento: "acustico",
        anotados: [{ t: 1, clase: null }],
        detectados: [{ t: 0.99, clase: null }],
      },
    ];
    const filas = v1Acustica(tomas);
    expect(filas.map((f) => f.instrumento)).toEqual(["acustico", "digital"]);
    const digital = filas.find((f) => f.instrumento === "digital")!;
    expect(digital.ataques).toEqual({ vp: 3, fp: 1, fn: 1 });
    expect([precision(digital.ataques), exhaustividad(digital.ataques)]).toEqual([0.75, 0.75]);
    expect(digital.notas).toEqual({ vp: 2, fp: 2, fn: 2 });
    expect(digital.error_ms.n).toBe(3);
    expect(digital.error_ms.media).toBeCloseTo(10, 6);
    expect(digital.error_ms.maximo_abs).toBeCloseTo(20, 6);
    // Sin etiquetas de nota no hay F1 de notas.
    expect(filas.find((f) => f.instrumento === "acustico")!.notas).toBeNull();
    const tabla = tablaV1Acustica(filas, 50);
    expect(tabla).toContain("## Origen: real · instrumento: digital");
    expect(tabla).toContain("75.0 %");
    expect(tabla).toMatch(/n chico: 1 tomas anotadas \(< 10\)/);
  });
});

import { describe, expect, it } from "vitest";
import { ParametrosBandas, Referencia } from "./referencia.ts";

// Datos SINTÉTICOS.
const percentiles = { inferior: 10, superior: 90, estado: "[PROVISIONAL]" } as const;
const factor = { valor: 1, estado: "[PROVISIONAL]" } as const;

const referenciaDeEjemplo = {
  formato: 1,
  version: 1,
  version_ejercicio: "EJ-01@1",
  n_docentes: 2,
  metodo: {
    unidad: "evento",
    percentiles,
    factor_retencion: factor,
    parametros_rasgos: {
      "desfase_manos.ms": { diferencia_buscada: 50, fuente: "PRM-11", estado: "[PROVISIONAL]" },
    },
  },
  bandas: [
    {
      unidad: "e0",
      rasgo: "desfase_manos.ms",
      centro: 10,
      inferior: 2,
      superior: 20,
      n_docentes: 2,
      n_ejecuciones: 4,
    },
  ],
  rasgos_descartados: [],
  rasgos_sin_evaluar: [],
  origen: {
    campana: "A",
    rol: "docente_ref",
    origen_tomas: "real",
    tomas: ["D01-EJ01-JUN-60-R1"],
    version_nucleo: "0.1.0",
    versiones_reprocesamiento: ["1.2.0"],
    generada_en: "2027-02-01T12:00:00Z",
  },
};

describe("referencia por consenso", () => {
  it("PU-contracts-22: una referencia registra versión, número de docentes, método y origen", () => {
    expect(Referencia.safeParse(referenciaDeEjemplo).success).toBe(true);
    const sinDocentes: Record<string, unknown> = { ...referenciaDeEjemplo };
    delete sinDocentes.n_docentes;
    expect(Referencia.safeParse(sinDocentes).success).toBe(false);
    const deEstudiantes = {
      ...referenciaDeEjemplo,
      origen: { ...referenciaDeEjemplo.origen, rol: "estudiante" },
    };
    expect(Referencia.safeParse(deEstudiantes).success).toBe(false);
  });

  it("PU-contracts-23: los parámetros marcan cada cifra como provisional o pendiente", () => {
    const base = { percentiles, factor_retencion: factor };
    const pendiente = { diferencia_buscada: null, fuente: null, estado: "PENDIENTE" };
    expect(
      ParametrosBandas.safeParse({ ...base, rasgos: { "altura.indice": pendiente } }).success,
    ).toBe(true);
    const sinEstado = { diferencia_buscada: 5, fuente: "PRM-09" };
    expect(
      ParametrosBandas.safeParse({ ...base, rasgos: { "cambio_tempo.pct": sinEstado } }).success,
    ).toBe(false);
    const invertidos = { ...base, percentiles: { ...percentiles, inferior: 95 }, rasgos: {} };
    expect(ParametrosBandas.safeParse(invertidos).success).toBe(false);
  });
});

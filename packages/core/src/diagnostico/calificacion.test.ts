import { describe, expect, it } from "vitest";
import { calificarVariables, nivelPrm22 } from "./calificacion.ts";
import { diagnosticar, type EventoDiagnosticable, type ReglasMotor } from "./reglas.ts";

// Datos SINTÉTICOS.
const PENDIENTE = "pendiente de aprobación del panel";
const REGLAS: ReglasMotor = {
  version: 1,
  indicadores: {
    "IND-A1": { clase: "ER-A", evaluable: true, motivo_no_evaluable: null, mensaje: PENDIENTE },
    "IND-B1": { clase: "ER-B", evaluable: true, motivo_no_evaluable: null, mensaje: PENDIENTE },
    "IND-B2": { clase: "ER-B", evaluable: true, motivo_no_evaluable: null, mensaje: PENDIENTE },
    "IND-E1": {
      clase: "ER-E",
      evaluable: false,
      motivo_no_evaluable: "No evaluable por diseño: sin rasgo",
      mensaje: PENDIENTE,
    },
  },
  reglas: [
    {
      id: "R-A1-01",
      indicador: "IND-A1",
      alcance: "evento",
      modalidad: "A",
      condicion: { tipo: "estado", dato: "nota", valores: ["incorrecta"] },
      minimo_eventos: 1,
    },
    {
      id: "R-B1-01",
      indicador: "IND-B1",
      alcance: "intento",
      modalidad: "A",
      condicion: { tipo: "fuera_de_banda", rasgo: "cambio_tempo.pct", lado: "cualquiera" },
    },
    {
      id: "R-B2-01",
      indicador: "IND-B2",
      alcance: "evento",
      modalidad: "A",
      condicion: { tipo: "fuera_de_banda", rasgo: "ataque.desvio_pct", lado: "cualquiera" },
      minimo_eventos: 3,
    },
  ],
};

/** n semicorcheas regulares de 250 ms; las de `incorrectas` con la tecla equivocada. */
function eventos(n: number, incorrectas: number[] = []): EventoDiagnosticable[] {
  return Array.from({ length: n }, (_, idx) => ({
    idx,
    mano: "MD" as const,
    estado: "evaluado" as const,
    ataque_ms: idx * 250,
    modalidad: "A" as const,
    nota: { estado: incorrectas.includes(idx) ? "incorrecta" : "correcta" },
    dedo: { estado: "sin-esperado" },
    desfase_manos: null,
    tecla: { zona: null },
    rasgos: {},
  }));
}

function calificar(evs: EventoDiagnosticable[], bandas = true, cambio = 0) {
  const n = evs.length;
  const referencia = bandas
    ? {
        version: 1,
        bandas: [
          ...Array.from({ length: n }, (_, i) => ({
            unidad: `e${i}`,
            rasgo: "ataque.desvio_pct",
            inferior: -10,
            superior: 10,
            centro: 0,
          })),
          { unidad: "ejecucion", rasgo: "cambio_tempo.pct", inferior: -3, superior: 3, centro: 0 },
        ],
      }
    : null;
  const r = diagnosticar({
    eventos: evs,
    cambioTempoPct: cambio,
    referencia,
    reglas: REGLAS,
    modo: "VA",
  });
  return { r, variables: calificarVariables(r, REGLAS) };
}

describe("calificación por variable (PRM-22)", () => {
  it("PU-diagnostico-15: niveles en sus fronteras: 90 % Logrado, 89,9 % y 70 % En desarrollo, 69,9 % Por mejorar", () => {
    expect(nivelPrm22(90)).toBe("logrado");
    expect(nivelPrm22(89.9)).toBe("en-desarrollo");
    expect(nivelPrm22(70)).toBe("en-desarrollo");
    expect(nivelPrm22(69.9)).toBe("por-mejorar");
  });

  it("PU-diagnostico-16: el % es de eventos evaluables dentro de banda, aunque la regla no llegue a dispararse", () => {
    // 1 de 10 notas incorrecta: 90 % → Logrado.
    const notas = calificar(eventos(10, [4])).variables.find((v) => v.clase === "ER-A")!;
    expect(notas).toEqual({
      clase: "ER-A",
      nivel: "logrado",
      pct: 90,
      evaluadas: 10,
      motivo: null,
    });
    // 3 de 10 incorrectas: 70 % → En desarrollo.
    expect(calificar(eventos(10, [1, 4, 7])).variables[0]).toMatchObject({
      nivel: "en-desarrollo",
      pct: 70,
    });
  });

  it("PU-diagnostico-17: una variable une sus indicadores: el ritmo cuenta los ataques y la ejecución completa", () => {
    // 10 eventos: 8 ataques con desvío medible (los extremos no tienen vecinos) + 1 de toda la ejecución.
    const { variables, r } = calificar(eventos(10), true, 9);
    expect(r.cobertura["IND-B1"]).toEqual({ evaluadas: ["ejecucion"], fuera: ["ejecucion"] });
    const ritmo = variables.find((v) => v.clase === "ER-B")!;
    expect(ritmo).toMatchObject({ evaluadas: 9, nivel: "en-desarrollo" });
    expect(ritmo.pct).toBeCloseTo((8 / 9) * 100, 1);
  });

  it("PU-diagnostico-18: sin datos o con indicadores no evaluables por diseño, la variable es No evaluado con su motivo, nunca Logrado", () => {
    const { variables } = calificar(eventos(10), false);
    expect(variables.find((v) => v.clase === "ER-B")).toEqual({
      clase: "ER-B",
      nivel: "no-evaluado",
      pct: null,
      evaluadas: 0,
      motivo: "Sin referencia publicada",
    });
    expect(variables.find((v) => v.clase === "ER-E")).toEqual({
      clase: "ER-E",
      nivel: "no-evaluado",
      pct: null,
      evaluadas: 0,
      motivo: "No evaluable por diseño: sin rasgo",
    });
    // Las clases sin ningún indicador en el conjunto también aparecen, como No evaluado.
    expect(variables.map((v) => v.clase)).toEqual(["ER-A", "ER-B", "ER-C", "ER-D", "ER-E", "ER-F"]);
    expect(variables.find((v) => v.clase === "ER-F")!.nivel).toBe("no-evaluado");
  });
});

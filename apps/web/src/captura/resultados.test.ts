import type { Diagnostico, EventoDiagnosticable } from "@skilltrack/core";
import { describe, expect, it } from "vitest";
import {
  accionSugerida,
  familiaDeEvento,
  ordenarPorCriticidad,
  NOMBRE_INDICADOR,
  NOMBRE_VARIABLE,
} from "./resultados.ts";

// Datos SINTÉTICOS.
const diag = (indicador: string, eventos: number[]): Diagnostico => ({
  indicador,
  clase: `ER-${indicador.charAt(4)}`,
  regla: `R-${indicador.slice(4)}-01`,
  eventos,
  mensaje: "pendiente de aprobación del panel",
});

function evento(idx: number, cambios: Partial<EventoDiagnosticable> = {}): EventoDiagnosticable {
  return {
    idx,
    mano: "MD",
    estado: "evaluado",
    ataque_ms: idx * 250,
    modalidad: "VA",
    nota: { estado: "correcta" },
    dedo: { estado: "correcto" },
    desfase_manos: null,
    tecla: { zona: 0.4 },
    rasgos: {},
    ...cambios,
  };
}

describe("pantalla de resultados", () => {
  it("PU-web-21: la corrección principal es la más crítica (§4.2: ritmo, notas, curvatura, digitación, tensión, posición)", () => {
    const orden = ordenarPorCriticidad([
      diag("IND-D2", [6]),
      diag("IND-C1", [5]),
      diag("IND-A1", [2]),
      diag("IND-B2", [4]),
      diag("IND-B3", [1, 3, 7]),
    ]);
    // Dentro de una clase, primero el que afecta a más eventos.
    expect(orden.map((d) => d.indicador)).toEqual([
      "IND-B3",
      "IND-B2",
      "IND-A1",
      "IND-C1",
      "IND-D2",
    ]);
  });

  it("PU-web-22: cada nota tiene su familia: nota, tiempo, mano/dedo, correcta o no evaluable", () => {
    const ds = [diag("IND-A1", [2]), diag("IND-B2", [2, 4]), diag("IND-C1", [5])];
    expect(familiaDeEvento(evento(2), ds)).toBe("nota");
    expect(familiaDeEvento(evento(4), ds)).toBe("tiempo");
    expect(familiaDeEvento(evento(5), ds)).toBe("mano");
    expect(familiaDeEvento(evento(0), ds)).toBe("correcto");
    expect(familiaDeEvento(evento(7, { estado: "no-evaluable" }), ds)).toBe("no-evaluable");
  });

  it("PU-web-23: el no evaluable sugiere una acción según su causa", () => {
    expect(accionSugerida("Ejecución incompleta", [])).toMatch(/completo/);
    const dudosas = [0, 1, 2].map((i) =>
      evento(i, { estado: "no-evaluable", nota: { estado: "dudosa" } }),
    );
    expect(accionSugerida("Menos del 70 % de las notas evaluables", dudosas)).toMatch(/silencioso/);
    const sinVer = [0, 1, 2].map((i) =>
      evento(i, { estado: "no-evaluable", nota: { estado: "faltante" } }),
    );
    expect(accionSugerida("Menos del 70 % de las notas evaluables", sinVer)).toMatch(/calibra/);
  });

  it("PU-web-24: los 12 indicadores y las 6 variables tienen el nombre de la taxonomía v0.1", () => {
    expect(Object.keys(NOMBRE_INDICADOR)).toHaveLength(12);
    expect(NOMBRE_INDICADOR["IND-B1"]).toBe("Cambio de tempo (aceleras o frenas)");
    expect(Object.values(NOMBRE_VARIABLE)).toEqual([
      "Notas",
      "Ritmo",
      "Digitación",
      "Lugar del dedo en la tecla",
      "Curvatura de los dedos",
      "Soltura de mano y muñeca",
    ]);
  });
});

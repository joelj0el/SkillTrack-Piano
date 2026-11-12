import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CODIGOS_INDICADOR, ConjuntoReglas } from "./reglas.ts";

const PLANTILLA = resolve(import.meta.dirname, "../../../tools/catalogo/conjunto_reglas.v1.json");
const plantilla = () => JSON.parse(readFileSync(PLANTILLA, "utf8"));

describe("conjunto de reglas", () => {
  it("PU-contracts-24: la plantilla v1 es válida y declara los 12 indicadores", () => {
    const c = ConjuntoReglas.parse(plantilla());
    expect(Object.keys(c.indicadores).sort()).toEqual([...CODIGOS_INDICADOR].sort());
    for (const conf of Object.values(c.indicadores)) {
      expect(conf.mensaje).toBe("pendiente de aprobación del panel");
    }
  });

  it("PU-contracts-25: cada regla tiene su forma completa: indicador, alcance, modalidad y condición", () => {
    const base = plantilla();
    const con = (cambio: Record<string, unknown>) => ({
      ...base,
      reglas: [{ ...base.reglas[0], ...cambio }, ...base.reglas.slice(1)],
    });
    expect(ConjuntoReglas.safeParse(con({ indicador: "IND-Z9" })).success).toBe(false);
    expect(ConjuntoReglas.safeParse(con({ modalidad: "X" })).success).toBe(false);
    expect(ConjuntoReglas.safeParse(con({ condicion: { tipo: "magia" } })).success).toBe(false);
    expect(ConjuntoReglas.safeParse(con({ minimo_eventos: 0 })).success).toBe(false);
    expect(ConjuntoReglas.safeParse(con({ extra: 1 })).success).toBe(false);
    // Una regla de intento solo compara con la banda: no lleva estados ni mínimo de eventos.
    const deIntento = {
      id: "R-X",
      indicador: "IND-B1",
      alcance: "intento",
      modalidad: "A",
      condicion: { tipo: "estado", dato: "nota", valores: ["incorrecta"] },
    };
    expect(ConjuntoReglas.safeParse({ ...base, reglas: [deIntento] }).success).toBe(false);
  });

  it("PU-contracts-26: un indicador no evaluable lleva su motivo y ninguna regla", () => {
    const base = plantilla();
    const sinMotivo = structuredClone(base);
    sinMotivo.indicadores["IND-E1"].motivo_no_evaluable = null;
    expect(ConjuntoReglas.safeParse(sinMotivo).success).toBe(false);

    const conRegla = structuredClone(base);
    conRegla.reglas.push({
      id: "R-E1-01",
      indicador: "IND-E1",
      alcance: "evento",
      modalidad: "V",
      condicion: { tipo: "fuera_de_banda", rasgo: "flexion.pip", lado: "debajo" },
      minimo_eventos: 1,
    });
    const r = ConjuntoReglas.safeParse(conRegla);
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toMatch(/no evaluable/);
  });

  it("PU-contracts-27: el indicador va con su clase, cada evaluable tiene regla y los ids no se repiten", () => {
    const otraClase = plantilla();
    otraClase.indicadores["IND-A1"].clase = "ER-B";
    expect(ConjuntoReglas.safeParse(otraClase).success).toBe(false);

    const sinRegla = plantilla();
    sinRegla.reglas = sinRegla.reglas.filter(
      (r: { indicador: string }) => r.indicador !== "IND-C1",
    );
    expect(ConjuntoReglas.safeParse(sinRegla).success).toBe(false);

    const repetida = plantilla();
    repetida.reglas.push(repetida.reglas[0]);
    expect(ConjuntoReglas.safeParse(repetida).success).toBe(false);
  });
});

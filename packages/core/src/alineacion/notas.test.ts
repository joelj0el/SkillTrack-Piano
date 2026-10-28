import { describe, expect, it } from "vitest";
import { alinearNotas, type NotaOida } from "./notas.ts";

const DO_MAYOR = [0, 2, 4, 5, 7, 9, 11, 0];
const oir = (clases: (number | null)[]): NotaOida[] =>
  clases.map((clase, i) => ({ t: i * 0.25, clase }));

describe("alineamiento de las notas oídas", () => {
  it("PU-align-04: la escala tocada sin errores queda toda correcta", () => {
    const r = alinearNotas(DO_MAYOR, oir(DO_MAYOR));
    expect(r.esperadas.every((e) => e.estado === "correcta")).toBe(true);
    expect(r.extras).toEqual([]);
  });

  it("PU-align-05: una nota equivocada es incorrecta y el resto sigue alineado", () => {
    const r = alinearNotas(DO_MAYOR, oir([0, 2, 3, 5, 7, 9, 11, 0]));
    expect(r.esperadas.map((e) => e.estado)).toEqual([
      "correcta",
      "correcta",
      "incorrecta",
      "correcta",
      "correcta",
      "correcta",
      "correcta",
      "correcta",
    ]);
    expect(r.esperadas[2]).toMatchObject({ claseOida: 3 });
  });

  it("PU-align-06: una nota omitida es faltante y una añadida es extra, sin desalinear el resto", () => {
    const omitida = alinearNotas(DO_MAYOR, oir([0, 2, 5, 7, 9, 11, 0]));
    expect(omitida.esperadas.map((e) => e.estado).filter((e) => e !== "correcta")).toEqual([
      "faltante",
    ]);
    expect(omitida.esperadas[2]!.estado).toBe("faltante");

    const anadida = alinearNotas(DO_MAYOR, oir([0, 2, 4, 6, 5, 7, 9, 11, 0]));
    expect(anadida.esperadas.every((e) => e.estado === "correcta")).toBe(true);
    expect(anadida.extras).toEqual([3]);
  });

  it("PU-align-07: una nota dudosa queda dudosa, nunca incorrecta", () => {
    const r = alinearNotas(DO_MAYOR, oir([0, 2, null, 5, 7, 9, 11, 0]));
    expect(r.esperadas[2]!.estado).toBe("dudosa");
  });
});

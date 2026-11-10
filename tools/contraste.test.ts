import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PARES, leerTemas, razon, verificar } from "./contraste.ts";

const TOKENS = readFileSync(
  resolve(import.meta.dirname, "../apps/web/src/design/tokens.css"),
  "utf8",
);

describe("contraste de los tokens", () => {
  it("PU-design-01: la razón de contraste sigue la fórmula de WCAG", () => {
    expect(razon("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(razon("#777777", "#ffffff")).toBeCloseTo(4.48, 2);
  });

  it("PU-design-02: todos los pares cumplen WCAG AA en claro y en oscuro", () => {
    expect(verificar(leerTemas(TOKENS))).toEqual([]);
  });

  it("PU-design-03: detecta un par insuficiente y dice en qué tema", () => {
    const css = TOKENS.replace(/--color-texto: #[0-9a-f]+;/, "--color-texto: #dddddd;");
    const fallos = verificar(leerTemas(css));
    expect(fallos.some((f) => f.tema === "claro" && f.texto === "--color-texto")).toBe(true);
  });

  it("PU-design-04: un color que falta en un tema es un fallo, no se omite", () => {
    const css = TOKENS.replace(/--color-acento: #[0-9a-f]+;/, "");
    expect(verificar(leerTemas(css)).some((f) => f.razon === 0)).toBe(true);
  });

  it("PU-design-05: las cinco familias semánticas están en la lista de pares", () => {
    for (const familia of ["correcto", "nota", "tiempo", "mano", "no-evaluable"]) {
      expect(PARES.some((p) => p.texto === `--color-${familia}`)).toBe(true);
      expect(PARES.some((p) => p.fondo === `--color-${familia}-fondo`)).toBe(true);
    }
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Salud } from "./index.ts";

describe("contrato Salud", () => {
  it("PU-contracts-01: acepta un estado ok con versión semver", () => {
    expect(Salud.safeParse({ estado: "ok", version: "0.1.0" }).success).toBe(true);
  });

  it("PU-contracts-02: rechaza un estado desconocido y los campos extra", () => {
    expect(Salud.safeParse({ estado: "caido", version: "0.1.0" }).success).toBe(false);
    expect(Salud.safeParse({ estado: "ok", version: "0.1.0", extra: 1 }).success).toBe(false);
  });

  it("PU-contracts-03: el JSON Schema exportado es cerrado y declara los campos obligatorios", () => {
    const esquema = z.toJSONSchema(Salud);
    expect(esquema.additionalProperties).toBe(false);
    expect(esquema.required).toEqual(["estado", "version"]);
  });
});

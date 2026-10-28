import { describe, expect, it } from "vitest";
import { UsuarioNuevo } from "./index.ts";

const base = { usuario: "ana.perez", nombre_visible: "Ana", es_menor: true, rol: "estudiante" };

describe("contratos de instituciones", () => {
  it("PU-contracts-08: un usuario nuevo puede no tener correo (menores)", () => {
    expect(UsuarioNuevo.safeParse(base).success).toBe(true);
    expect(UsuarioNuevo.safeParse({ ...base, email: null }).success).toBe(true);
  });

  it("PU-contracts-09: si hay correo, debe tener formato válido", () => {
    expect(UsuarioNuevo.safeParse({ ...base, email: "ana@uab.edu.bo" }).success).toBe(true);
    expect(UsuarioNuevo.safeParse({ ...base, email: "ana-sin-arroba" }).success).toBe(false);
  });
});

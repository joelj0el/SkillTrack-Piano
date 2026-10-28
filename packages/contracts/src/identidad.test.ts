import { describe, expect, it } from "vitest";
import { CambioClave, InicioSesion, UsuarioActual } from "./index.ts";

describe("contratos de identidad", () => {
  it("PU-contracts-05: el inicio de sesión exige usuario y clave, sin campos extra", () => {
    expect(InicioSesion.safeParse({ usuario: "ana", clave: "x" }).success).toBe(true);
    expect(InicioSesion.safeParse({ usuario: "", clave: "x" }).success).toBe(false);
    expect(InicioSesion.safeParse({ usuario: "ana", clave: "x", token: "t" }).success).toBe(false);
  });

  it("PU-contracts-06: la clave nueva tiene al menos 8 caracteres (PRM-25)", () => {
    expect(CambioClave.safeParse({ clave_actual: "a", clave_nueva: "1234567" }).success).toBe(
      false,
    );
    expect(CambioClave.safeParse({ clave_actual: "a", clave_nueva: "12345678" }).success).toBe(
      true,
    );
  });

  it("PU-contracts-07: el usuario actual lista sus membresías con un rol válido", () => {
    const base = {
      id: 1,
      usuario: "ana",
      nombre_visible: "Ana",
      superadmin: false,
      clave_temporal: false,
    };
    expect(
      UsuarioActual.safeParse({ ...base, membresias: [{ institucion_id: 1, rol: "docente" }] })
        .success,
    ).toBe(true);
    expect(
      UsuarioActual.safeParse({ ...base, membresias: [{ institucion_id: 1, rol: "rector" }] })
        .success,
    ).toBe(false);
  });
});

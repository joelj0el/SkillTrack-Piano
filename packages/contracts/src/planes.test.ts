import { describe, expect, it } from "vitest";
import { MiPlan, PlanNuevo, SolicitudAccesoNueva } from "./planes.ts";

const plan = {
  nombre: "Institución",
  descripcion: "Para escuelas",
  beneficios: ["Varios docentes"],
  precio_bs: null,
  periodo: "mensual",
  limite_docentes: null,
  limite_estudiantes: null,
  destacado: true,
  activo: true,
};

describe("planes (HU-39)", () => {
  it("PU-contracts-32: un precio o un límite sin definir es null, nunca un número inventado", () => {
    expect(PlanNuevo.parse(plan).precio_bs).toBeNull();
    expect(PlanNuevo.safeParse({ ...plan, precio_bs: 120.5 }).success).toBe(true);
    expect(PlanNuevo.safeParse({ ...plan, precio_bs: -1 }).success).toBe(false);
    expect(PlanNuevo.safeParse({ ...plan, limite_docentes: 0 }).success).toBe(false);
    expect(PlanNuevo.safeParse({ ...plan, periodo: "semanal" }).success).toBe(false);
    expect(PlanNuevo.safeParse({ ...plan, posicion: 1 }).success).toBe(false);
  });

  it("PU-contracts-33: la solicitud de acceso valida el correo y no admite campos extra", () => {
    const solicitud = {
      nombre: "Rosa",
      institucion: "Escuela",
      correo: "rosa@ejemplo.org",
      telefono: null,
      plan_id: null,
      mensaje: null,
    };
    expect(SolicitudAccesoNueva.safeParse(solicitud).success).toBe(true);
    expect(SolicitudAccesoNueva.safeParse({ ...solicitud, correo: "rosa" }).success).toBe(false);
    expect(SolicitudAccesoNueva.safeParse({ ...solicitud, estudiantes: [] }).success).toBe(false);
  });

  it("PU-contracts-34: Mi plan admite una institución sin suscripción", () => {
    expect(
      MiPlan.safeParse({
        institucion: "Instituto",
        suscripcion: null,
        limite_docentes: null,
        limite_estudiantes: null,
        docentes: 0,
        estudiantes: 0,
        pago_qr: false,
      }).success,
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { AvisoPagoQr, ConvenioCodigoNuevo, MiPago, RegistroNuevo } from "./registro.ts";

// Datos SINTÉTICOS.
const registro = {
  tipo: "independiente",
  nombre: "Rosa Mendoza",
  correo: "rosa@ejemplo.org",
  telefono: "+591 70000000",
  usuario: "rosa.mendoza",
  clave: "clave-segura-1",
  institucion: "Clases de piano Rosa",
  plan_id: 1,
  codigo_convenio: null,
  acepta_terminos: true,
};

describe("registro de compradores (HU-40)", () => {
  it("PU-contracts-35: el registro exige aceptar los términos, la clave mínima y no admite campos extra", () => {
    expect(RegistroNuevo.safeParse(registro).success).toBe(true);
    expect(RegistroNuevo.safeParse({ ...registro, acepta_terminos: false }).success).toBe(false);
    expect(RegistroNuevo.safeParse({ ...registro, clave: "1234567" }).success).toBe(false);
    expect(RegistroNuevo.safeParse({ ...registro, correo: "rosa" }).success).toBe(false);
    // Solo compradores: no hay tipo "estudiante" ni rol elegible.
    expect(RegistroNuevo.safeParse({ ...registro, tipo: "estudiante" }).success).toBe(false);
    expect(RegistroNuevo.safeParse({ ...registro, rol: "estudiante" }).success).toBe(false);
    // Ningún dato de tarjeta.
    expect(RegistroNuevo.safeParse({ ...registro, tarjeta: "4111111111111111" }).success).toBe(
      false,
    );
    expect(
      RegistroNuevo.safeParse({ ...registro, plan_id: null, codigo_convenio: "uab-2026" }).success,
    ).toBe(true);
  });

  it("PU-contracts-36: un convenio tiene código en mayúsculas, precio desde 0, cupos y vencimiento", () => {
    const convenio = {
      codigo: "UAB-2026",
      plan_id: 1,
      precio_bs: 0,
      cupos: 10,
      vence: "2026-12-31",
    };
    expect(ConvenioCodigoNuevo.safeParse(convenio).success).toBe(true);
    expect(ConvenioCodigoNuevo.safeParse({ ...convenio, codigo: "uab-2026" }).success).toBe(false);
    expect(ConvenioCodigoNuevo.safeParse({ ...convenio, precio_bs: -1 }).success).toBe(false);
    expect(ConvenioCodigoNuevo.safeParse({ ...convenio, cupos: 0 }).success).toBe(false);
  });

  it("PU-contracts-37: la pantalla de pago admite un monto sin definir y un QR simulado", () => {
    const pago = {
      institucion: "Clases de piano Rosa",
      plan: "Docente",
      periodo: "mensual",
      monto_bs: null,
      codigo_convenio: null,
      estado: "pendiente",
      vence_plan: null,
      proveedor: "simulado",
      qr: null,
    };
    expect(MiPago.safeParse(pago).success).toBe(true);
    expect(
      MiPago.safeParse({
        ...pago,
        monto_bs: 50,
        qr: {
          id_transaccion: "ST-000001",
          estado: "pendiente",
          simulado: true,
          imagen_png: null,
          vence_en: "2026-11-25T12:00:00Z",
        },
      }).success,
    ).toBe(true);
  });

  it("PU-contracts-38: el aviso del banco acepta campos extra y el QR tiene su estado", () => {
    expect(
      AvisoPagoQr.safeParse({ payment: { QRID: "q-1", amount: 50, extra: true } }).success,
    ).toBe(true);
    expect(AvisoPagoQr.safeParse({}).success).toBe(false);
    const qr = {
      id_transaccion: "ST-1",
      estado: "vencido",
      simulado: false,
      imagen_png: "iVBOR",
      vence_en: "2026-11-25T23:59:59-04:00",
    };
    const pago = {
      institucion: "I",
      plan: "P",
      periodo: "mensual",
      monto_bs: 1,
      codigo_convenio: null,
      estado: "activa",
      vence_plan: "2026-12-24",
      proveedor: "baneco",
      qr,
    };
    expect(MiPago.safeParse(pago).success).toBe(true);
    expect(MiPago.safeParse({ ...pago, qr: { ...qr, estado: "rechazado" } }).success).toBe(false);
  });
});

import type { ResultadoIntento } from "@skilltrack/contracts";
import { describe, expect, it, vi } from "vitest";
import { ErrorApi, SinConexion } from "../api.ts";
import { almacenEnMemoria, encolar, vaciar } from "./bandeja.ts";

const resultado = (uuid: string): ResultadoIntento => ({
  client_uuid: uuid,
  version_ejercicio_id: 1,
  tarea_id: null,
  version_nucleo: "0.1.0",
  version_modelo_mano: "prueba",
  instrumento: "digital",
  manos: "MD",
  clase_dispositivo: "Android/Chrome",
  modo: "V",
  modo_metronomo: null,
  tempo_elegido_bpm: 60,
  estado: "evaluado",
  motivo_no_evaluable: null,
  iniciado_en: "2026-11-10T16:00:00Z",
  duracion_ms: 1000,
  pct_eventos_evaluables: null,
  pct_digitacion_correcta: null,
  eventos: [],
});

const U1 = "0b6a3c3e-6f1e-4d8a-9a51-2f0f3d6f9c11";
const U2 = "1c7b4d4f-7a2f-4e9b-8b62-3a1a4e7a0d22";

describe("bandeja de salida", () => {
  it("PU-outbox-01: sin red el intento queda pendiente; con red pasa a guardado", async () => {
    const almacen = almacenEnMemoria();
    await encolar(almacen, resultado(U1));

    await vaciar(almacen, vi.fn().mockRejectedValue(new SinConexion()));
    expect(almacen.datos.get(U1)?.estado).toBe("pendiente");

    const enviar = vi.fn().mockResolvedValue(undefined);
    await vaciar(almacen, enviar);
    expect(almacen.datos.get(U1)?.estado).toBe("guardado");
    await vaciar(almacen, enviar);
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("PU-outbox-02: un rechazo del servidor (4xx) no se reintenta para siempre", async () => {
    const almacen = almacenEnMemoria();
    await encolar(almacen, resultado(U1));
    await encolar(almacen, resultado(U2));
    const enviar = vi
      .fn()
      .mockRejectedValueOnce(new ErrorApi(422, "Datos inválidos"))
      .mockResolvedValueOnce(undefined);

    await vaciar(almacen, enviar);

    expect(almacen.datos.get(U1)?.estado).toBe("rechazado");
    expect(almacen.datos.get(U2)?.estado).toBe("guardado");
  });

  it("PU-outbox-03: solo se encola un ResultadoIntento válido (sin campos de medios)", async () => {
    const almacen = almacenEnMemoria();
    const conVideo = { ...resultado(U1), video: "AAAA" } as unknown as ResultadoIntento;

    await expect(encolar(almacen, conVideo)).rejects.toThrow();
    expect(almacen.datos.size).toBe(0);
  });
});

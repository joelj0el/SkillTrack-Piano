import type { Series } from "@skilltrack/core";
import { describe, expect, it } from "vitest";
import {
  agregarFotograma,
  cadaFotograma,
  type FotogramaDetectado,
  type VideoConFotogramas,
} from "./fotogramas.ts";

// Video SIMULADO: entrega fotogramas cuando la prueba lo dice (ninguna cámara).
function videoSimulado() {
  let pendiente: ((ahora: number, datos: VideoFrameCallbackMetadata) => void) | null = null;
  let presentados = 0;
  const video: VideoConFotogramas = {
    requestVideoFrameCallback: (cb) => {
      pendiente = cb;
      return 1;
    },
    cancelVideoFrameCallback: () => {
      pendiente = null;
    },
  };
  const presentar = (captura: number, ahora: number) => {
    const cb = pendiente;
    pendiente = null;
    cb?.(ahora, {
      presentedFrames: ++presentados,
      captureTime: captura,
      presentationTime: ahora - 2,
      expectedDisplayTime: ahora + 16,
      mediaTime: 0,
      width: 640,
      height: 360,
    });
  };
  return { video, presentar };
}

const mano = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5, z: -0.1 }));
const fotograma = (tMs: number): FotogramaDetectado => ({
  deteccion: { t: tMs / 1000 },
  asignacion: { MD: { datos: mano } },
  ancho: 640,
  alto: 360,
});

describe("un fotograma de detección por fotograma de video", () => {
  it("PU-capture-19: detecta una vez por fotograma de video, con el instante de captura del fotograma", () => {
    const { video, presentar } = videoSimulado();
    const instantes: number[] = [];
    const parar = cadaFotograma(video, (t) => instantes.push(t));
    presentar(1000, 1030);
    presentar(1033, 1063);
    presentar(1033, 1080); // el mismo fotograma presentado otra vez: no se detecta de nuevo
    presentar(1066, 1096);
    parar();
    presentar(1100, 1130);
    expect(instantes).toEqual([1000, 1033, 1066]);
  });

  it("PU-capture-20: un mismo fotograma leído en varios cuadros de pantalla entra una sola vez al búfer, con su marca de tiempo", () => {
    const series: Series = {};
    const inicioMs = 500;
    const f = fotograma(1033);
    // La pantalla (60 Hz) lee el último fotograma más veces de las que la cámara (30 fps) lo renueva.
    expect(agregarFotograma(series, f, inicioMs)).toBe(1);
    expect(agregarFotograma(series, f, inicioMs)).toBe(0);
    expect(agregarFotograma(series, fotograma(1066), inicioMs)).toBe(1);
    expect(agregarFotograma(series, fotograma(1066), inicioMs)).toBe(0);
    expect(series.MD?.map((m) => m.t)).toEqual([0.533, 0.566]);
    expect(series.MI).toBeUndefined();
  });
});

import { copyFile, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import type { FotogramaReproceso } from "@skilltrack/contracts";
import type { RespuestaAnalisis } from "@skilltrack/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { PedidoProceso, Procesador, SalidaProceso } from "../reprocesar/reprocesar.ts";
import { tomaDeVideoSuelto } from "./sincronizacion-video.ts";

// Clip SINTÉTICO de las pruebas (640x400) y procesador falso: ningún navegador ni grabación real.
const CLIP = resolve(import.meta.dirname, "../../fixtures/calibracion/CAL-digital-1.mp4");

const mano = (id: "MI" | "MD", x: number) => {
  const puntos = Array.from({ length: 21 }, () => [x, 0.5, 0] as [number, number, number]);
  return {
    mano: id,
    puntos,
    mundo: puntos.map(() => [0, 0, 0] as [number, number, number]),
    rasgos: {},
  };
};
const fotogramas: FotogramaReproceso[] = [0, 1 / 30, 2 / 30].map((t) => ({
  t,
  manos: [mano("MI", 0.3), mano("MD", 0.7)],
}));

function procesadorFalso(dimensiones: Record<string, [number, number]>) {
  const pedidos: { ruta: string; pedido: PedidoProceso }[] = [];
  const procesador: Procesador = {
    version_modelo: "modelo@1",
    comprobar: async (ruta) => {
      const [ancho, alto] = dimensiones[ruta.split(/[\\/]/).at(-1)!] ?? [640, 400];
      return { decodificable: true, ancho, alto, duracion_s: 2 };
    },
    procesar: async (ruta, pedido) => {
      pedidos.push({ ruta, pedido });
      return {
        ancho: 640,
        alto: 400,
        duracion_s: 2,
        delegado: "CPU",
        perdidos: 0,
        fotogramas,
        analisis: {
          acustico: { oidas: [{ t: 1.03, clase: null, energia: 1, croma: [] }] },
        } as unknown as RespuestaAnalisis,
        audio: { pista: true, motivo: null, tasa_hz: 48000 },
      } satisfies SalidaProceso;
    },
    cerrar: async () => {},
  };
  return { procesador, pedidos };
}

let carpeta: string;
beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), "sync-"));
  await copyFile(CLIP, join(carpeta, "golpe-seco.mp4"));
  await copyFile(CLIP, join(carpeta, "CAL-autor.mp4"));
});
afterEach(() => rm(carpeta, { recursive: true, force: true }));

describe("sincronización con un video suelto (TI-HU11-05)", () => {
  it("PU-research-92: procesa el video suelto con el clip de calibración sin registrar ninguna toma ni escribir junto al video", async () => {
    const { procesador, pedidos } = procesadorFalso({});
    const antes = await readdir(carpeta);
    const toma = await tomaDeVideoSuelto({
      video: join(carpeta, "golpe-seco.mp4"),
      calibracion: join(carpeta, "CAL-autor.mp4"),
      procesador,
    });
    expect(toma.codigo_toma).toBe("golpe-seco.mp4");
    expect(toma.fotogramas).toEqual(fotogramas);
    expect(toma.ataques).toEqual([1.03]);
    expect(pedidos).toHaveLength(1);
    expect(pedidos[0]!.ruta).toBe(join(carpeta, "golpe-seco.mp4"));
    // No es una toma de ejercicio: no hay notas esperadas que alinear.
    expect(pedidos[0]!.pedido.esperadas).toEqual([]);
    expect(await readdir(carpeta)).toEqual(antes);
  });

  it("PU-research-93: rechaza un clip de calibración de otro encuadre y usa la homografía de un calibracion-*.json", async () => {
    const otro = procesadorFalso({ "CAL-autor.mp4": [1280, 720] });
    await expect(
      tomaDeVideoSuelto({
        video: join(carpeta, "golpe-seco.mp4"),
        calibracion: join(carpeta, "CAL-autor.mp4"),
        procesador: otro.procesador,
      }),
    ).rejects.toThrow(/1280x720.*640x400/);
    expect(otro.pedidos).toHaveLength(0);

    const homografia = [2, 0, 0, 0, 2, 0, 0, 0, 1];
    const json = join(carpeta, "calibracion-autor.json");
    await writeFile(
      json,
      JSON.stringify({
        version: 1,
        sesion: "autor",
        clip: "CAL-autor",
        instrumento: "digital",
        video: { archivo: "CAL-autor.mp4", sha256: "0".repeat(64), ancho: 640, alto: 400 },
        tiempo_fotograma_s: 0,
        rango: { min: 48, max: 72 },
        toques: {
          frenteIzquierda: { x: 0, y: 400 },
          frenteDerecha: { x: 640, y: 400 },
          negrasIzquierda: { x: 0, y: 300 },
          negrasDerecha: { x: 640, y: 300 },
        },
        homografia,
        version_nucleo: "0",
        guardada_en: "2026-11-23T00:00:00.000Z",
        tomas: [],
      }),
    );
    const { procesador, pedidos } = procesadorFalso({});
    await tomaDeVideoSuelto({
      video: join(carpeta, "golpe-seco.mp4"),
      calibracion: json,
      procesador,
    });
    expect(pedidos[0]!.pedido.homografia).toEqual(homografia);
    expect(pedidos[0]!.pedido.rango).toEqual({ min: 48, max: 72 });
  });
});

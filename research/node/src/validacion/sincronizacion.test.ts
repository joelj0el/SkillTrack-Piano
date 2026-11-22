import type { FotogramaReproceso } from "@skilltrack/contracts";
import { describe, expect, it } from "vitest";
import { golpesVisuales, sincronizacion, tablaSincronizacion } from "./sincronizacion.ts";

// Datos SINTÉTICOS: dos manos que se juntan en una palmada cada segundo (30 fps), sin video.
const FPS = 30;
const CERO = [0, 0, 0] as [number, number, number];

function mano(id: "MI" | "MD", x: number) {
  const puntos = Array.from({ length: 21 }, () => [x, 0.5, 0] as [number, number, number]);
  return { mano: id, puntos, mundo: puntos.map(() => CERO), rasgos: {} };
}

/** Separación entre manos: 0,4 lejos de las palmadas, 0,02 en cada palmada. */
function fotogramas(palmadas: number[], duracion = 4): FotogramaReproceso[] {
  return Array.from({ length: duracion * FPS }, (_, i) => {
    const t = i / FPS;
    const cerca = Math.min(...palmadas.map((p) => Math.abs(p - t)));
    const sep = 0.02 + Math.min(0.38, cerca * 1.5);
    return { t, manos: [mano("MI", 0.5 - sep / 2), mano("MD", 0.5 + sep / 2)] };
  });
}

describe("sincronización audio–video (TI-HU11-05)", () => {
  it("PU-research-87: cada palmada visible es el mínimo de la distancia entre las manos", () => {
    expect(golpesVisuales(fotogramas([1, 2, 3]))).toEqual([1, 2, 3]);
    // Un fotograma con una sola mano no corta la serie ni inventa un golpe.
    const conHueco = fotogramas([1, 2]).map((f, i) =>
      i === 45 ? { ...f, manos: [f.manos[0]!] } : f,
    );
    expect(golpesVisuales(conHueco)).toEqual([1, 2]);
  });

  it("PU-research-88: el error es audio − video en ms, con la resolución de un fotograma y aviso si hay pocos golpes", () => {
    const r = sincronizacion([
      {
        codigo_toma: "SYNC-1",
        origen: "real",
        fotogramas: fotogramas([1, 2, 3]),
        ataques: [1.03, 2.03, 3.03, 3.6],
      },
    ]);
    const [fila] = r;
    expect(fila!.golpes_visuales).toBe(3);
    expect(fila!.emparejados).toBe(3);
    expect(fila!.error_ms.media).toBeCloseTo(30, 6);
    expect(fila!.error_ms.maximo_abs).toBeCloseTo(30, 6);
    expect(fila!.resolucion_ms).toBeCloseTo(1000 / FPS, 6);
    const tabla = tablaSincronizacion(r);
    expect(tabla).toContain("## Origen: real");
    expect(tabla).toMatch(/n chico: 3 golpes emparejados \(< 10\)/);
  });
});

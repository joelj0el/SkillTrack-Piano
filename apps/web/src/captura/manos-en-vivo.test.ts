import { evaluarCalidad } from "@skilltrack/core";
import { describe, expect, it } from "vitest";
import { crearAsignador, crearContadorFps } from "./manos-en-vivo.ts";

const mano = (x: number) => Array.from({ length: 21 }, () => ({ x, y: 0.5, z: 0 }));

describe("manos en vivo", () => {
  it("PU-capture-08: en la vista de referencia la mano de la izquierda de la imagen es la izquierda", () => {
    const asignar = crearAsignador(() => false);
    const r = asignar([mano(0.8), mano(0.2)]);
    expect(r.MI?.datos[0]?.x).toBe(0.2);
    expect(r.MD?.datos[0]?.x).toBe(0.8);
  });

  it("PU-capture-09: con la cámara frontal (espejo) se invierte la asignación", () => {
    const asignar = crearAsignador(() => true);
    const r = asignar([mano(0.8), mano(0.2)]);
    expect(r.MI?.datos[0]?.x).toBe(0.8);
  });

  it("PU-capture-10: el semáforo llega a verde solo con las manos que pide la tarea", () => {
    const medidas = (manosDetectadas: number, manosEsperadas: 1 | 2) => ({
      luminancia: 120,
      nitidez: 200,
      movimiento: 1,
      manosDetectadas,
      manosEsperadas,
      rangoVisible: true,
    });
    expect(evaluarCalidad(medidas(2, 2)).nivel).toBe("verde");
    expect(evaluarCalidad(medidas(1, 2)).nivel).toBe("ambar");
    expect(evaluarCalidad(medidas(1, 1)).nivel).toBe("verde");
    expect(evaluarCalidad(medidas(0, 1)).nivel).toBe("ambar");
  });

  it("PU-capture-11: el contador de fps converge al ritmo de los fotogramas", () => {
    const fps = crearContadorFps(0.5);
    let valor = 0;
    for (let i = 0; i <= 40; i++) valor = fps(i * 50); // 20 fps
    expect(valor).toBeCloseTo(20, 1);
  });
});

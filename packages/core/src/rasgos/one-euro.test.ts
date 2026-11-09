import { describe, expect, it } from "vitest";
import { FiltroOneEuro } from "./one-euro.ts";

// Ruido determinista (sin Math.random): alterna ±1 con un patrón fijo.
const ruido = (i: number) => (((i * 7919) % 13) - 6) / 6;

describe("filtro One Euro", () => {
  it("PU-features-01: una señal constante sale igual", () => {
    const f = new FiltroOneEuro();
    for (let i = 0; i < 30; i++) expect(f.filtrar(i / 30, 5)).toBeCloseTo(5);
  });

  it("PU-features-02: con la mano quieta reduce el temblor", () => {
    const f = new FiltroOneEuro();
    const salida: number[] = [];
    for (let i = 0; i < 90; i++) salida.push(f.filtrar(i / 30, 10 + ruido(i)));
    const dispersion = (v: number[]) => Math.max(...v) - Math.min(...v);
    const entrada = Array.from({ length: 60 }, (_, i) => 10 + ruido(i + 30));
    expect(dispersion(salida.slice(30))).toBeLessThan(dispersion(entrada) / 3);
  });

  it("PU-features-03: en un movimiento rápido sigue a la señal con poco retardo", () => {
    const rapido = new FiltroOneEuro({ corteMinimo: 1, beta: 0.5, corteDerivada: 1 });
    const lento = new FiltroOneEuro({ corteMinimo: 1, beta: 0, corteDerivada: 1 });
    let r = 0;
    let l = 0;
    for (let i = 0; i <= 15; i++) {
      const x = i * 20; // 600 unidades por segundo a 30 fps
      r = rapido.filtrar(i / 30, x);
      l = lento.filtrar(i / 30, x);
    }
    expect(300 - r).toBeLessThan(300 - l);
  });

  it("PU-features-04: un tiempo repetido o hacia atrás reinicia el filtro sin dividir por cero", () => {
    const f = new FiltroOneEuro();
    f.filtrar(1, 3);
    expect(f.filtrar(1, 8)).toBe(8);
    expect(Number.isFinite(f.filtrar(0.5, 9))).toBe(true);
  });
});

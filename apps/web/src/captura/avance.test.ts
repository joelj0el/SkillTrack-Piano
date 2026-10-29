import { describe, expect, it } from "vitest";
import { ESPERA_AVANCE, cuentaAtras, type CuentaAtras } from "./avance.ts";

function correr(pasos: [listo: boolean, t: number][]): CuentaAtras {
  return pasos.reduce<CuentaAtras>((c, [listo, t]) => cuentaAtras(c, listo, t), {
    desde: null,
    restante: null,
    avanzar: false,
  });
}

describe("avance automático con las manos en el teclado", () => {
  it("PU-capture-16: en verde descuenta 3, 2, 1 y avanza a los 3 s", () => {
    expect(ESPERA_AVANCE).toBe(3);
    expect(correr([[true, 10]]).restante).toBe(3);
    expect(
      correr([
        [true, 10],
        [true, 11.2],
      ]).restante,
    ).toBe(2);
    expect(
      correr([
        [true, 10],
        [true, 12.5],
      ]).restante,
    ).toBe(1);
    const fin = correr([
      [true, 10],
      [true, 13],
    ]);
    expect(fin.avanzar).toBe(true);
    expect(fin.restante).toBe(0);
  });

  it("PU-capture-17: si el semáforo deja el verde, la cuenta se reinicia", () => {
    const cortada = correr([
      [true, 10],
      [true, 12.5],
      [false, 12.6],
    ]);
    expect(cortada).toEqual({ desde: null, restante: null, avanzar: false });
    const otraVez = correr([
      [true, 10],
      [true, 12.5],
      [false, 12.6],
      [true, 13],
      [true, 15.9],
    ]);
    expect(otraVez.avanzar).toBe(false);
    expect(otraVez.restante).toBe(1);
  });

  it("PU-capture-18: sin verde nunca avanza", () => {
    const nunca = correr([
      [false, 0],
      [false, 5],
      [false, 60],
    ]);
    expect(nunca.avanzar).toBe(false);
    expect(nunca.restante).toBeNull();
  });
});

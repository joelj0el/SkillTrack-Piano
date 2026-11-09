import { describe, expect, it } from "vitest";
import {
  INICIAL,
  duracionEsperada,
  puedeIniciar,
  transicion,
  type Estado,
  type Evento,
  type Plan,
} from "./estado.ts";

// EJ-01 a una mano: 29 eventos; a ♩ = 60 cada semicorchea dura 0,25 s.
const PLAN: Plan = { eventosEsperados: 29, duracionEsperada: duracionEsperada(29, 60) };

function correr(eventos: Evento[], desde: Estado = INICIAL): Estado {
  return eventos.reduce((e, ev) => transicion(e, ev, PLAN), desde);
}

const LISTO: Evento[] = [
  { tipo: "semaforo", nivel: "verde" },
  { tipo: "calibrado" },
  { tipo: "iniciar", t: 0 },
  { tipo: "fin-conteo", t: 4 },
];

describe("máquina de estados del intento", () => {
  it("PU-capture-01: duración esperada de semicorcheas a ♩ = 60 y 70", () => {
    expect(duracionEsperada(29, 60)).toBeCloseTo(7.25);
    expect(duracionEsperada(29, 70)).toBeCloseTo(6.214, 2);
  });

  it("PU-capture-02: no se puede iniciar sin verde o sin calibración", () => {
    const ambar = correr([{ tipo: "semaforo", nivel: "ambar" }, { tipo: "calibrado" }]);
    expect(puedeIniciar(ambar)).toBe(false);
    expect(correr([{ tipo: "iniciar", t: 0 }], ambar).fase).toBe("encuadre");
    const sinCalibrar = correr([{ tipo: "semaforo", nivel: "verde" }]);
    expect(puedeIniciar(sinCalibrar)).toBe(false);
  });

  it("PU-capture-03: tras el conteo pasa a Tocando sin tocar la pantalla", () => {
    expect(correr(LISTO).fase).toBe("tocando");
  });

  it("PU-capture-04: con los eventos cubiertos y 1,5 s de quietud pasa a Analizando (PRM-15)", () => {
    const tocando = correr([...LISTO, { tipo: "actividad", t: 11, eventos: 29 }]);
    expect(correr([{ tipo: "tick", t: 12.49 }], tocando).fase).toBe("tocando");
    expect(correr([{ tipo: "tick", t: 12.5 }], tocando)).toEqual({
      fase: "analizando",
      incompleta: false,
      eventos: 29,
    });
  });

  it("PU-capture-05: al superar 1,5 × la duración esperada termina sola como incompleta", () => {
    const limite = 4 + 1.5 * PLAN.duracionEsperada;
    const tocando = correr([...LISTO, { tipo: "actividad", t: 6, eventos: 10 }]);
    expect(correr([{ tipo: "tick", t: limite - 0.01 }], tocando).fase).toBe("tocando");
    expect(correr([{ tipo: "tick", t: limite }], tocando)).toEqual({
      fase: "analizando",
      incompleta: true,
      eventos: 10,
    });
  });

  it("PU-capture-06: cancelar en Tocando descarta el intento", () => {
    expect(correr([...LISTO, { tipo: "cancelar" }]).fase).toBe("cancelado");
  });

  it("PU-capture-07: si la cámara se mueve durante la ejecución, no evaluable", () => {
    expect(correr([...LISTO, { tipo: "camara-movida" }])).toEqual({
      fase: "no-evaluable",
      motivo: "Se movió la cámara",
    });
  });
});

import { describe, expect, it } from "vitest";
import { desviaciones, valoresDelIntento, type EventoMedible } from "./desviaciones.ts";

// Datos SINTÉTICOS: semicorcheas de 250 ms con la mano derecha.
function evento(idx: number, ataque_ms: number | null, cambios: Partial<EventoMedible> = {}) {
  return {
    idx,
    mano: "MD",
    estado: "evaluado",
    ataque_ms,
    modalidad: "A",
    desfase_manos: null,
    tecla: { zona: null },
    rasgos: {},
    ...cambios,
  } satisfies EventoMedible;
}

describe("valores medidos del intento", () => {
  it("PU-diagnostico-01: por evento, rasgos, zona, desfase y desvío del ataque, cada uno con su modalidad; por intento, el cambio de tempo", () => {
    const eventos = [
      evento(0, 0, { tecla: { zona: 0.4 }, rasgos: { "altura.indice": 0.01 } }),
      evento(1, 260, { desfase_manos: { ms: 30, modalidad: "VA" } }),
      evento(2, 500),
    ];
    const v = valoresDelIntento(eventos, 4.5);
    const de = (unidad: string, rasgo: string) =>
      v.find((x) => x.unidad === unidad && x.rasgo === rasgo);
    expect(de("e0", "tecla.zona")).toMatchObject({ valor: 0.4, modalidad: "V", idx: 0 });
    expect(de("e0", "altura.indice")).toMatchObject({ valor: 0.01, modalidad: "V" });
    expect(de("e1", "desfase_manos.ms")).toMatchObject({ valor: 30, modalidad: "VA" });
    // e1 llega 10 ms tarde respecto del punto medio entre 0 y 500 (intervalo local 250 ms): +4 %.
    expect(de("e1", "ataque.desvio_pct")!.valor).toBeCloseTo(4);
    expect(de("e1", "ataque.desvio_pct")!.modalidad).toBe("A");
    expect(de("ejecucion", "cambio_tempo.pct")).toMatchObject({
      valor: 4.5,
      modalidad: "A",
      idx: null,
    });
  });

  it("PU-diagnostico-02: los eventos no evaluables no aportan valores", () => {
    const v = valoresDelIntento(
      [
        evento(0, 0),
        evento(1, 250, { estado: "no-evaluable", tecla: { zona: 0.5 } }),
        evento(2, 500),
      ],
      null,
    );
    expect(v.filter((x) => x.idx === 1)).toEqual([]);
  });
});

describe("desviaciones respecto de la banda", () => {
  const banda = { unidad: "e0", rasgo: "r", inferior: 10, superior: 20, centro: 15 };
  const valor = (v: number) => ({
    unidad: "e0",
    idx: 0,
    rasgo: "r",
    valor: v,
    modalidad: "V" as const,
  });

  it("PU-diagnostico-03: fronteras: en el borde de la banda está dentro; apenas fuera, encima o debajo", () => {
    const d = desviaciones([valor(10), valor(20), valor(20.001), valor(9.999)], [banda]);
    expect(d.map((x) => x.posicion)).toEqual(["dentro", "dentro", "encima", "debajo"]);
    expect(d[2]!.magnitud).toBeCloseTo(0.0001);
    expect(d[0]!.magnitud).toBe(0);
  });

  it("PU-diagnostico-04: sin banda para la unidad o el rasgo, la posición es sin-banda (nunca un diagnóstico dudoso)", () => {
    const [d] = desviaciones([{ ...valor(50), rasgo: "otro" }], [banda]);
    expect(d).toMatchObject({ posicion: "sin-banda", banda: null, magnitud: null });
  });

  it("PU-diagnostico-05: una banda de ancho cero no inventa una magnitud", () => {
    const [d] = desviaciones([valor(16)], [{ ...banda, inferior: 15, superior: 15 }]);
    expect(d).toMatchObject({ posicion: "encima", magnitud: null });
  });
});

import { describe, expect, it, vi } from "vitest";
import {
  BANDERA_CLASIFICADOR_POR_DEFECTO,
  etiquetaDelClasificador,
  type Clasificador,
} from "./clasificador.ts";

const modelo: Clasificador = { version: "clasificador@prueba", etiquetar: () => ["ER-B"] };

describe("clasificador opcional (HU-35)", () => {
  it("PU-classifier-01: la bandera está apagada por defecto y apagada no carga ningún modelo", async () => {
    expect(BANDERA_CLASIFICADOR_POR_DEFECTO).toBe(false);
    const cargar = vi.fn(async () => modelo);
    expect(await etiquetaDelClasificador(false, cargar, [])).toBeNull();
    expect(cargar).not.toHaveBeenCalled();
  });

  it("PU-classifier-02: encendida, sin modelo publicado no hay etiqueta; con modelo, lleva su versión", async () => {
    expect(await etiquetaDelClasificador(true, async () => null, [])).toBeNull();
    const cargar = vi.fn(async () => modelo);
    expect(await etiquetaDelClasificador(true, cargar, [])).toEqual({
      version: "clasificador@prueba",
      clases: ["ER-B"],
    });
    expect(cargar).toHaveBeenCalledTimes(1);
  });
});

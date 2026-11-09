import { describe, expect, it } from "vitest";
import { toqueAVideo } from "./camara.ts";

describe("toque sobre el video escalado", () => {
  it("PU-capture-14: con franjas a los lados, el toque se lleva a píxeles del video", () => {
    // Pantalla 1000×400 con video 1280×720: se escala a 711×400, franjas de 144 px a cada lado.
    const caja = { ancho: 1000, alto: 400 };
    const video = { ancho: 1280, alto: 720 };
    const centro = toqueAVideo(500, 200, caja, video)!;
    expect(centro.x).toBeCloseTo(640);
    expect(centro.y).toBeCloseTo(360);
    expect(toqueAVideo(100, 200, caja, video)).toBeNull();
  });

  it("PU-capture-15: con franjas arriba y abajo (teléfono vertical) también", () => {
    const caja = { ancho: 400, alto: 800 };
    const video = { ancho: 1280, alto: 720 };
    const esquina = toqueAVideo(0, (800 - 225) / 2, caja, video)!;
    expect(esquina.x).toBeCloseTo(0);
    expect(esquina.y).toBeCloseTo(0);
    expect(toqueAVideo(200, 50, caja, video)).toBeNull();
  });
});

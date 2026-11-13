import type { ResultadoIntento } from "@skilltrack/contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PantallaResultados, type DatosResultados } from "./PantallaResultados.tsx";
import { banderaClasificador, CLASIFICADOR_ACTIVO, cargarClasificador } from "./clasificador.ts";

const datos: DatosResultados = {
  resultado: { estado: "evaluado", motivo_no_evaluable: null } as ResultadoIntento,
  eventos: [],
  diagnostico: null,
  variables: [
    { clase: "ER-A", nivel: "logrado", pct: 95, evaluadas: 20, motivo: null },
    { clase: "ER-B", nivel: "por-mejorar", pct: 40, evaluadas: 20, motivo: null },
  ],
  tarea: null,
  guardado: "Guardado",
  duracionAnalisisMs: 100,
  reintentar: () => {},
};

function pantalla(extra: Partial<DatosResultados> = {}): string {
  const { container, unmount } = render(<PantallaResultados {...datos} {...extra} />, {
    wrapper: MemoryRouter,
  });
  const html = container.innerHTML;
  unmount();
  return html;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("etiqueta del clasificador (HU-35)", () => {
  it("PU-web-29: la bandera está apagada por defecto y no hay modelo publicado", async () => {
    expect(banderaClasificador({})).toBe(false);
    expect(banderaClasificador({ VITE_CLASIFICADOR: "1" })).toBe(false);
    expect(banderaClasificador({ VITE_CLASIFICADOR: "activo" })).toBe(true);
    expect(CLASIFICADOR_ACTIVO).toBe(false);
    expect(await cargarClasificador()).toBeNull();
  });

  it("PU-web-30: sin etiqueta la pantalla es idéntica a la de las reglas; con etiqueta se marca como del clasificador", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("[]", { status: 200 })),
    );
    const reglas = pantalla();
    expect(pantalla({ clasificador: null })).toBe(reglas);

    render(
      <PantallaResultados
        {...datos}
        clasificador={{ version: "clasificador@prueba", clases: ["ER-B"] }}
      />,
      { wrapper: MemoryRouter },
    );
    const etiqueta = screen.getByText(/Clasificador experimental/).closest("[data-clasificador]")!;
    expect(etiqueta.getAttribute("data-clasificador")).toBe("clasificador@prueba");
    expect(etiqueta.textContent).toContain("Ritmo");
    expect(etiqueta.textContent).toContain("no cambia la calificación");
    // La calificación de las reglas sigue igual.
    expect(document.querySelector("[data-variable=ER-B]")!.getAttribute("data-nivel")).toBe(
      "por-mejorar",
    );
  });
});

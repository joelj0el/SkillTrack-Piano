import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { filasDeProgreso, PaginaMiGrupo, PaginaMiProgreso, tendencia } from "./tableros.tsx";

function servidor(respuestas: Record<string, unknown>) {
  const fetch = vi.fn(async (url: string) =>
    url in respuestas
      ? new Response(JSON.stringify(respuestas[url]), { status: 200 })
      : new Response(JSON.stringify({ detail: "No encontrado" }), {
          status: 404,
        }),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("tableros (HU-15)", () => {
  it("PU-web-26: Mi progreso arma una fila por semana y una columna por variable con datos", () => {
    const { clases, filas } = filasDeProgreso([
      { semana: "2026-11-09", clase: "ER-A", intentos: 1, pct_promedio: 70 },
      { semana: "2026-11-02", clase: "ER-B", intentos: 1, pct_promedio: 50 },
      { semana: "2026-11-02", clase: "ER-A", intentos: 3, pct_promedio: 90 },
    ]);
    expect(clases).toEqual(["ER-A", "ER-B"]);
    expect(filas).toEqual([
      { semana: "2026-11-02", pct: { "ER-A": 90, "ER-B": 50 } },
      { semana: "2026-11-09", pct: { "ER-A": 70 } },
    ]);
    expect(tendencia(70, 90)).toBe("baja 20 puntos");
    expect(tendencia(92.5, 90)).toBe("sube 2.5 puntos");
    expect(tendencia(90, 90)).toBe("igual que la semana anterior");
    expect(tendencia(90, undefined)).toBeNull();
  });

  it("PU-web-27: Mi progreso muestra la tendencia de la propia variable, sin puntaje global", async () => {
    servidor({
      "/api/tableros/mi-progreso": {
        semanas: [
          {
            semana: "2026-11-02",
            clase: "ER-A",
            intentos: 3,
            pct_promedio: 90,
          },
          {
            semana: "2026-11-09",
            clase: "ER-A",
            intentos: 1,
            pct_promedio: 70,
          },
        ],
      },
    });
    render(<PaginaMiProgreso />, { wrapper: MemoryRouter });
    const tabla = await screen.findByRole("table", {
      name: /por variable por semana/,
    });
    expect(within(tabla).getByText("Notas")).toBeDefined();
    expect(within(tabla).getByText(/baja 20 puntos/)).toBeDefined();
    expect(document.body.textContent).not.toMatch(/puntaje|ranking|estrella|posición/i);
  });

  it("PU-web-28: Mi grupo va en el orden de la API (alfabético) y cuenta errores en los últimos N", async () => {
    const fetch = servidor({
      "/api/tableros/mi-grupo?ultimos=10": {
        ultimos: 10,
        estudiantes: [
          {
            estudiante_id: 3,
            nombre_visible: "Ana",
            intentos_considerados: 4,
            errores: [{ clase: "ER-B", intentos_con_error: 2, indicadores: ["IND-B2"] }],
          },
          {
            estudiante_id: 1,
            nombre_visible: "Beto",
            intentos_considerados: 0,
            errores: [],
          },
        ],
      },
    });
    render(<PaginaMiGrupo />, { wrapper: MemoryRouter });
    const tabla = await screen.findByRole("table", {
      name: /errores recurrentes/i,
    });
    const filas = within(tabla).getAllByRole("row").slice(1);
    expect(filas.map((f) => f.getAttribute("data-estudiante"))).toEqual(["3", "1"]);
    const ritmo = filas[0]!.querySelector('[data-clase="ER-B"]')!;
    expect(ritmo.textContent).toBe("En 2 de 4 · Tropiezo o pausa");
    expect(fetch).toHaveBeenCalledWith("/api/tableros/mi-grupo?ultimos=10", expect.anything());
    expect(document.body.textContent).not.toMatch(/puntaje|estrella|posición|mejor|peor/i);
  });
});

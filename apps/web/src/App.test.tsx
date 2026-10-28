import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./App.tsx";

afterEach(cleanup);

describe("página de inicio", () => {
  it("PU-web-01: muestra el título de la aplicación", () => {
    render(<App obtenerSalud={() => new Promise(() => {})} />);

    expect(screen.getByRole("heading", { name: "SkillTrack-Piano" })).toBeDefined();
  });

  it("PU-web-02: muestra el estado de la API según la respuesta de salud", async () => {
    render(<App obtenerSalud={async () => ({ estado: "ok", version: "0.1.0" })} />);
    expect(await screen.findByText("API: ok")).toBeDefined();
    cleanup();

    render(<App obtenerSalud={async () => ({ estado: "caido" })} />);
    expect(await screen.findByText("API: no disponible")).toBeDefined();
    cleanup();

    render(<App obtenerSalud={() => Promise.reject(new Error("sin red"))} />);
    expect(await screen.findByText("API: no disponible")).toBeDefined();
  });
});

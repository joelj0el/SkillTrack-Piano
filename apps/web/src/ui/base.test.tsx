import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Check } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Boton, Chip, EstadoVista, Esqueleto, ProveedorAvisos, useAviso } from "./base.tsx";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("componentes base", () => {
  it("PU-ui-01: un botón cargando queda deshabilitado y lo anuncia", () => {
    render(<Boton cargando>Guardar</Boton>);
    const boton = screen.getByRole("button", {
      name: "Guardar",
    }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect(boton.getAttribute("aria-busy")).toBe("true");
  });

  it("PU-ui-02: las variantes usan su clase y el primario no necesita ninguna", () => {
    render(
      <>
        <Boton>Uno</Boton>
        <Boton variante="peligro">Dos</Boton>
      </>,
    );
    expect(screen.getByRole("button", { name: "Uno" }).className).toBe("");
    expect(screen.getByRole("button", { name: "Dos" }).className).toBe("peligro");
  });

  it("PU-ui-03: un chip siempre lleva icono y texto", () => {
    render(
      <Chip tono="correcto" icono={Check}>
        Correcto
      </Chip>,
    );
    const chip = screen.getByText("Correcto");
    expect(chip.querySelector("svg")).not.toBeNull();
    expect(chip.dataset.tono).toBe("correcto");
  });

  it("PU-ui-04: los estados muestran ilustración decorativa, título y el nivel pedido", () => {
    const { container } = render(
      <EstadoVista tipo="sin-conexion" titulo="Sin conexión" nivel={1}>
        <p>Revisa tu red.</p>
      </EstadoVista>,
    );
    expect(screen.getByRole("heading", { level: 1, name: "Sin conexión" })).toBeDefined();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("PU-ui-05: el esqueleto se anuncia como cargando", () => {
    render(<Esqueleto />);
    expect(screen.getByRole("status").textContent).toContain("Cargando");
  });

  it("PU-ui-06: el aviso aparece y desaparece solo", () => {
    vi.useFakeTimers();
    function Prueba() {
      const avisar = useAviso();
      return <button onClick={() => avisar("Tarea asignada")}>Avisar</button>;
    }
    render(
      <ProveedorAvisos>
        <Prueba />
      </ProveedorAvisos>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Avisar" }));
    expect(screen.getByRole("status").textContent).toContain("Tarea asignada");
    vi.advanceTimersByTime(4000);
  });
});

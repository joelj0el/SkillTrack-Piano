import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App.tsx";
import { ProveedorSesion } from "../sesion.tsx";

type Respuestas = Record<string, { estado: number; cuerpo: unknown }>;

const usuario = (rol: string, clave_temporal = false) => ({
  id: 1,
  usuario: "ana",
  nombre_visible: "Ana",
  superadmin: false,
  clave_temporal,
  membresias: [{ institucion_id: 1, rol }],
});

const tarea = (id: number, fecha_limite: string, estado: string) => ({
  id,
  estudiante_id: 1,
  docente_id: 2,
  ejercicio: { id: 1, codigo: "EJ-01", nombre: "Escala de Do mayor" },
  manos: "juntas",
  tempo_min_bpm: 60,
  tempo_max_bpm: 70,
  repeticiones_por_dia: 3,
  fecha_limite,
  estado,
  observaciones: [],
});

function servidor(respuestas: Respuestas) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const r = respuestas[url] ?? { estado: 404, cuerpo: { detail: "No encontrado" } };
      return new Response(JSON.stringify(r.cuerpo), { status: r.estado });
    }),
  );
}

function abrir(ruta: string) {
  render(
    <MemoryRouter initialEntries={[ruta]}>
      <ProveedorSesion>
        <App />
      </ProveedorSesion>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("pantallas", () => {
  it("PU-web-05: Mis tareas sin tareas muestra el estado vacío con acceso al catálogo", async () => {
    servidor({
      "/api/auth/me": { estado: 200, cuerpo: usuario("estudiante") },
      "/api/mis-tareas": { estado: 200, cuerpo: [] },
    });
    abrir("/tareas");

    expect(await screen.findByText(/aún no te asignó tareas/)).toBeDefined();
    expect(screen.getByRole("link", { name: /catálogo de ejercicios/ })).toBeDefined();
  });

  it("PU-web-06: una tarea vencida muestra el icono y el texto Vencida", async () => {
    servidor({
      "/api/auth/me": { estado: 200, cuerpo: usuario("estudiante") },
      "/api/mis-tareas": {
        estado: 200,
        cuerpo: [tarea(1, "2026-11-01", "Vencida"), tarea(2, "2026-12-01", "Asignada")],
      },
    });
    abrir("/tareas");

    const vencida = await screen.findByText("Vencida");
    expect(vencida.textContent).toContain("⚠");
    expect(screen.getByText("Asignada")).toBeDefined();
  });

  it("PU-web-07: con clave temporal cualquier pantalla lleva al cambio de contraseña", async () => {
    servidor({ "/api/auth/me": { estado: 200, cuerpo: usuario("docente", true) } });
    abrir("/estudiantes");

    expect(await screen.findByRole("heading", { name: "Cambiar contraseña" })).toBeDefined();
    expect(screen.queryByText("Mis estudiantes")).toBeNull();
  });

  it("PU-web-08: el inicio de sesión fallido muestra el mensaje genérico de la API", async () => {
    servidor({
      "/api/auth/me": { estado: 401, cuerpo: { detail: "Se requiere sesión" } },
      "/api/auth/login": { estado: 401, cuerpo: { detail: "Usuario o contraseña incorrectos" } },
    });
    abrir("/");

    fireEvent.change(await screen.findByLabelText("Usuario"), { target: { value: "ana" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Usuario o contraseña incorrectos");
  });

  it("PU-web-09: sin red, las secciones que necesitan el servidor muestran Sin conexión", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    abrir("/tareas");

    expect(await screen.findByRole("heading", { name: "Sin conexión" })).toBeDefined();
  });
});

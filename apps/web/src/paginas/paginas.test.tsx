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
  valoracion: null,
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
    expect(vencida.querySelector("svg")).not.toBeNull();
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

const ejercicio = (version: Record<string, unknown>) => ({
  id: 1,
  codigo: "EJ-01",
  nombre: "Escala de Do mayor",
  fuente: "Panel",
  tonalidad: "Do mayor",
  compas: "2/4",
  figura: "semicorchea",
  orden: 1,
  variantes_manos: ["MI", "MD", "juntas"],
  version_vigente: {
    id: 2,
    version: 2,
    tempo_min_permitido_bpm: 60,
    tempo_max_permitido_bpm: 75,
    rango_octavas: 2,
    nota_min_midi: null,
    nota_max_midi: null,
    eventos_esperados: [],
    partitura_svg: null,
    transcripcion: "pendiente",
    ...version,
  },
});

describe("detalle del ejercicio", () => {
  it("PU-web-14: muestra la partitura, la digitación por mano y la guía con sus tres apartados", async () => {
    servidor({
      "/api/auth/me": { estado: 200, cuerpo: usuario("estudiante") },
      "/api/catalogo/ejercicios/EJ-01": {
        estado: 200,
        cuerpo: ejercicio({
          partitura_svg: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
          transcripcion: "importada",
          eventos_esperados: [
            { idx: 0, tiempo_beats: 0, mano: "MI", dedo: 5, clase_altura: 0, midi: 48 },
            { idx: 1, tiempo_beats: 0, mano: "MD", dedo: 1, clase_altura: 0, midi: 60 },
          ],
        }),
      },
    });
    abrir("/catalogo/EJ-01");

    const partitura = await screen.findByRole("img", { name: /Partitura de Escala de Do mayor/ });
    expect(partitura.querySelector("svg")).not.toBeNull();
    expect(screen.getByText(/revisión del panel/)).toBeDefined();
    const derecha = screen.getByRole("region", { name: "Digitación de la mano derecha" });
    expect(derecha.textContent).toBe("Mano derechaDo4, dedo 1");
    expect(screen.getByRole("region", { name: "Digitación de la mano izquierda" })).toBeDefined();
    for (const apartado of ["Muñeca", "Separación entre dedos", "Curvatura"]) {
      expect(screen.getByRole("heading", { name: apartado })).toBeDefined();
    }
    expect(screen.getAllByText("Pendiente de aprobación del panel.")).toHaveLength(3);
    expect(screen.getAllByRole("img", { name: /: pendiente$/ })).toHaveLength(3);
  });

  it("PU-web-15: sin transcripción, la partitura y la digitación quedan como pendientes", async () => {
    servidor({
      "/api/auth/me": { estado: 200, cuerpo: usuario("estudiante") },
      "/api/catalogo/ejercicios/EJ-01": { estado: 200, cuerpo: ejercicio({}) },
    });
    abrir("/catalogo/EJ-01");

    expect(await screen.findByText(/Partitura pendiente de transcripción/)).toBeDefined();
    expect(screen.getByText("Digitación pendiente de transcripción.")).toBeDefined();
    expect(screen.queryByRole("img", { name: /Partitura de/ })).toBeNull();
  });
});

describe("avance de la tarea", () => {
  it("PU-web-16: la tarea muestra la meta del día y cada intento con fecha, hora y motivo", async () => {
    servidor({
      "/api/auth/me": { estado: 200, cuerpo: usuario("estudiante") },
      "/api/tareas/1": { estado: 200, cuerpo: tarea(1, "2026-12-01", "En práctica") },
      "/api/tareas/1/avance": {
        estado: 200,
        cuerpo: {
          tarea_id: 1,
          meta_por_dia: 3,
          hoy: "2026-11-11",
          validas_hoy: 2,
          dias: [{ fecha: "2026-11-11", validas: 2, meta: 3 }],
          intentos: [
            {
              id: 3,
              iniciado_en: "2026-11-11T15:40:00-04:00",
              estado: "evaluado",
              tempo_elegido_bpm: 60,
              tempo_medido_bpm: 55.2,
              cuenta_para_tarea: false,
              motivo_no_cuenta: "Tocaste a ♩≈55; tu tarea pide 60–70",
            },
          ],
        },
      },
    });
    abrir("/tareas/1");

    expect(await screen.findByText("2 de 3 hoy")).toBeDefined();
    expect(screen.getByText(/No cuenta: Tocaste a ♩≈55/)).toBeDefined();
    expect(screen.getByRole("list", { name: "Intentos" }).textContent).toMatch(
      /\d{2}\/\d{2}\/2026 \d{2}:\d{2}/,
    );
  });
});

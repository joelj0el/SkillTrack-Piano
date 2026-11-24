import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "../App.tsx";
import { ProveedorSesion } from "../sesion.tsx";
import { cambioSemanal, intentosPorSemana } from "./panel.tsx";

type Respuestas = Record<string, { estado: number; cuerpo: unknown }>;

const usuario = (rol: string) => ({
  id: 1,
  usuario: "ana",
  nombre_visible: "Ana Rojas",
  superadmin: false,
  clave_temporal: false,
  membresias: [{ institucion_id: 1, rol }],
});

const tarea = {
  id: 1,
  estudiante_id: 1,
  docente_id: 2,
  ejercicio: { id: 1, codigo: "EJ-01", nombre: "Escala de Do mayor" },
  manos: "juntas",
  tempo_min_bpm: 60,
  tempo_max_bpm: 70,
  repeticiones_por_dia: 3,
  fecha_limite: "2026-12-01",
  estado: "En práctica",
  observaciones: [],
  valoracion: null,
};

// Datos SINTÉTICOS con la forma de la semilla: sin precios ni límites definidos.
const plan = (id: number, nombre: string, destacado: boolean, beneficios: string[]) => ({
  id,
  nombre,
  descripcion: `Plan ${nombre}`,
  beneficios,
  precio_bs: null,
  periodo: "mensual",
  limite_docentes: null,
  limite_estudiantes: null,
  destacado,
  activo: true,
});
const PLANES_API = [
  plan(1, "Docente", false, ["1 docente", "Seguimiento de cada estudiante"]),
  plan(2, "Institución", true, ["Varios docentes"]),
  plan(3, "Convenio especial", false, ["Precio según el convenio"]),
];

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

// Lo que el diseño v2 no muestra nunca (invariante: sin rankings ni puntajes globales).
const PROHIBIDO =
  /estrella|racha|nivel (actual|intermedio)|promedio general|progreso general|análisis ia/i;

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("diseño v2: inicio público, panel y menú", () => {
  it("PU-web-31: cuenta los intentos de esta semana (desde el lunes) y de la anterior", () => {
    const ahora = new Date(2026, 10, 25, 12); // miércoles 25-nov-2026
    const r = intentosPorSemana(
      [
        { iniciado_en: new Date(2026, 10, 23, 8).toISOString() }, // lunes: esta semana
        { iniciado_en: new Date(2026, 10, 25, 9).toISOString() },
        { iniciado_en: new Date(2026, 10, 22, 20).toISOString() }, // domingo: la anterior
        { iniciado_en: new Date(2026, 10, 10, 9).toISOString() }, // hace dos semanas: no cuenta
      ],
      ahora,
    );
    expect(r).toEqual({ esta: 2, anterior: 1 });
    expect(cambioSemanal(r)).toBe("+1 frente a la semana anterior");
    expect(cambioSemanal({ esta: 1, anterior: 3 })).toBe("−2 frente a la semana anterior");
    expect(cambioSemanal({ esta: 0, anterior: 0 })).toBe("igual que la semana anterior");
  });

  it("PU-web-32: sin sesión, / muestra la página pública con Ver planes y sin puntajes", async () => {
    servidor({ "/api/auth/me": { estado: 401, cuerpo: { detail: "Se requiere sesión" } } });
    abrir("/");

    expect(await screen.findByRole("heading", { level: 1, name: /Aprende piano/ })).toBeDefined();
    expect(screen.getAllByRole("link", { name: "Iniciar sesión" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Ver planes" }).length).toBeGreaterThan(0);
    expect(screen.getByText(/no sale del teléfono/)).toBeDefined();
    expect(document.body.textContent).not.toMatch(PROHIBIDO);
  });

  it("PU-web-33: con sesión de estudiante, / lleva al panel con tareas pendientes y repeticiones de hoy", async () => {
    servidor({
      "/api/auth/me": { estado: 200, cuerpo: usuario("estudiante") },
      "/api/mis-tareas": { estado: 200, cuerpo: [tarea] },
      "/api/mis-intentos": { estado: 200, cuerpo: [] },
      "/api/tableros/mi-progreso": { estado: 200, cuerpo: { semanas: [] } },
      "/api/tareas/1/avance": {
        estado: 200,
        cuerpo: {
          tarea_id: 1,
          meta_por_dia: 3,
          hoy: "2026-11-23",
          validas_hoy: 2,
          dias: [{ fecha: "2026-11-23", validas: 2, meta: 3 }],
          intentos: [],
        },
      },
    });
    abrir("/");

    expect(await screen.findByRole("heading", { level: 1, name: "¡Hola, Ana!" })).toBeDefined();
    const resumen = screen.getByRole("region", { name: "Resumen" });
    expect(within(resumen).getByText("2 de 3")).toBeDefined();
    expect(resumen.querySelector('[data-resumen="pendientes"]')?.textContent).toMatch(/1/);
    expect(screen.getByRole("link", { name: "Practicar Escala de Do mayor" })).toBeDefined();
    expect(document.body.textContent).not.toMatch(PROHIBIDO);
  });

  it("PU-web-34: el menú solo tiene las secciones reales de cada rol", async () => {
    servidor({
      "/api/auth/me": { estado: 200, cuerpo: usuario("estudiante") },
      "/api/mis-tareas": { estado: 200, cuerpo: [] },
    });
    abrir("/tareas");
    const menu = await screen.findByRole("navigation", { name: "Principal" });
    expect(
      within(menu)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Inicio", "Mis tareas", "Ejercicios", "Mi progreso", "Perfil"]);
    cleanup();

    servidor({
      "/api/auth/me": { estado: 200, cuerpo: usuario("admin_inst") },
    });
    abrir("/perfil");
    const menuAdmin = await screen.findByRole("navigation", { name: "Principal" });
    expect(
      within(menuAdmin)
        .getAllByRole("link")
        .map((a) => a.textContent),
    ).toEqual(["Usuarios", "Mi plan", "Perfil"]);
    expect(screen.getByText("Administración", { selector: "dd" })).toBeDefined();
  });

  it("PU-web-35: la entrada tiene Volver al inicio, que lleva a la página pública", async () => {
    servidor({ "/api/auth/me": { estado: 401, cuerpo: { detail: "Se requiere sesión" } } });
    abrir("/entrar");
    const volver = await screen.findByRole("link", { name: "Volver al inicio" });
    expect(volver.getAttribute("href")).toBe("/");
  });

  it("PU-web-36: /planes muestra los planes de la API, la Institución como recomendada y los límites sin definir como —", async () => {
    servidor({
      "/api/auth/me": { estado: 401, cuerpo: { detail: "Se requiere sesión" } },
      "/api/planes": { estado: 200, cuerpo: PLANES_API },
    });
    abrir("/planes");
    expect(await screen.findByRole("heading", { level: 1, name: "Planes" })).toBeDefined();
    const planes = await screen.findAllByRole("article");
    expect(planes.map((p) => p.querySelector("h2")?.textContent)).toEqual([
      "Docente",
      "Institución",
      "Convenio especial",
    ]);
    expect(planes.map((p) => p.getAttribute("data-destacado"))).toEqual(["false", "true", "false"]);
    expect(within(planes[1]!).getByText("Recomendado")).toBeDefined();
    for (const p of planes) expect(within(p).getByText("Bs —")).toBeDefined();
    for (const p of planes) {
      expect(within(p).getByText(/Hasta — docentes y — estudiantes/)).toBeDefined();
    }
    // Ningún precio ni límite inventado: la única cifra es el docente del plan Docente.
    expect(planes.map((p) => p.textContent?.match(/\d+/g) ?? [])).toEqual([["1"], [], []]);
    const enlaces = screen.getAllByRole("link", { name: /Solicitar información/ });
    expect(enlaces.map((a) => a.getAttribute("href"))).toEqual([
      "/solicitar-acceso?plan=1",
      "/solicitar-acceso?plan=2",
      "/solicitar-acceso?plan=3",
    ]);
  });

  it("PU-web-37: Ver planes abre la ventana con su título; ya no hay planes al final de la página", async () => {
    HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
      this.open = false;
    };
    servidor({
      "/api/auth/me": { estado: 401, cuerpo: { detail: "Se requiere sesión" } },
      "/api/planes": { estado: 200, cuerpo: PLANES_API },
    });
    abrir("/");
    await screen.findByRole("heading", { level: 1, name: /Aprende piano/ });
    expect(screen.queryByRole("region", { name: "Planes" })).toBeNull();
    const botones = screen.getAllByRole("button", { name: "Ver planes" });
    expect(botones.length).toBe(2);
    fireEvent.click(botones[0]!);
    const ventana = screen.getByRole("dialog", { name: "Planes" });
    expect(await within(ventana).findAllByRole("article")).toHaveLength(3);
    expect(within(ventana).getByRole("button", { name: "Cerrar" })).toBeDefined();
  });

  it("PU-web-38: el menú lateral se recoge con un botón, deja los íconos con su nombre y recuerda la preferencia", async () => {
    localStorage.removeItem("skilltrack.menu");
    const respuestas = {
      "/api/auth/me": { estado: 200, cuerpo: usuario("admin_inst") },
    };
    servidor(respuestas);
    abrir("/perfil");
    const boton = await screen.findByRole("button", { name: "Contraer el menú" });
    expect(boton.getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(boton);
    expect(document.querySelector(".aplicacion")?.classList.contains("menu-recogido")).toBe(true);
    expect(localStorage.getItem("skilltrack.menu")).toBe("recogido");
    // Recogido, cada ícono conserva su nombre accesible (la etiqueta flotante).
    const menu = screen.getByRole("navigation", { name: "Principal" });
    expect(within(menu).getByRole("link", { name: "Usuarios" })).toBeDefined();
    cleanup();

    servidor(respuestas);
    abrir("/perfil");
    const expandir = await screen.findByRole("button", { name: "Expandir el menú" });
    expect(expandir.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(expandir);
    expect(localStorage.getItem("skilltrack.menu")).toBe("abierto");
  });
});

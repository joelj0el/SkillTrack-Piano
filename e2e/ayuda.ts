import { expect, request, type APIRequestContext, type Page } from "@playwright/test";

export const CLAVE_DEMO = process.env.SEMILLA_CLAVE ?? "demo-piano-2026";
export const CLAVE_NUEVA = "clave-propia-2026";
const CSRF = { "x-skilltrack-csrf": "1" };
const BASE = process.env.E2E_URL ?? "https://localhost";

/** Sufijo único por ejecución: cada prueba crea sus propios usuarios. */
export function unico(prefijo: string): string {
  return `${prefijo}.${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
}

export async function sesionApi(usuario: string, clave: string): Promise<APIRequestContext> {
  const contexto = await request.newContext({ baseURL: BASE, ignoreHTTPSErrors: true });
  const r = await contexto.post("/api/auth/login", { data: { usuario, clave }, headers: CSRF });
  expect(r.status(), await r.text()).toBe(200);
  return contexto;
}

export class Admin {
  constructor(
    readonly api: APIRequestContext,
    readonly institucionId: number,
  ) {}

  static async demo(): Promise<Admin> {
    const api = await sesionApi("admin.demo", CLAVE_DEMO);
    const yo = await (await api.get("/api/auth/me")).json();
    const institucionId = yo.membresias.find((m: { rol: string }) => m.rol === "admin_inst")
      .institucion_id as number;
    return new Admin(api, institucionId);
  }

  /** Crea el usuario y devuelve su id y clave temporal. */
  async crear(usuario: string, rol: string): Promise<{ id: number; clave: string }> {
    const r = await this.api.post(`/api/instituciones/${this.institucionId}/usuarios`, {
      data: { usuario, nombre_visible: `Persona ${usuario}`, es_menor: false, rol },
      headers: CSRF,
    });
    expect(r.status(), await r.text()).toBe(201);
    const cuerpo = await r.json();
    return { id: cuerpo.id, clave: cuerpo.clave_temporal };
  }

  /** Crea el usuario y le fija CLAVE_NUEVA para que pueda entrar sin el cambio obligatorio. */
  async crearListo(usuario: string, rol: string): Promise<number> {
    const { id, clave } = await this.crear(usuario, rol);
    const api = await sesionApi(usuario, clave);
    const r = await api.post("/api/auth/cambiar-clave", {
      data: { clave_actual: clave, clave_nueva: CLAVE_NUEVA },
      headers: CSRF,
    });
    expect(r.status()).toBe(204);
    return id;
  }

  async asignar(docenteId: number, estudianteId: number): Promise<void> {
    const r = await this.api.post(`/api/instituciones/${this.institucionId}/asignaciones`, {
      data: { docente_id: docenteId, estudiante_id: estudianteId },
      headers: CSRF,
    });
    expect(r.status(), await r.text()).toBe(201);
  }
}

/** Docente y estudiante nuevos, asignados entre sí y con su clave propia. */
export async function parDocenteEstudiante() {
  const admin = await Admin.demo();
  const docente = unico("doc");
  const estudiante = unico("est");
  const docenteId = await admin.crearListo(docente, "docente");
  const estudianteId = await admin.crearListo(estudiante, "estudiante");
  await admin.asignar(docenteId, estudianteId);
  return { admin, docente, docenteId, estudiante, estudianteId };
}

export async function crearTareaApi(
  docente: string,
  estudianteId: number,
  cambios: Record<string, unknown> = {},
): Promise<number> {
  const api = await sesionApi(docente, CLAVE_NUEVA);
  const r = await api.post("/api/tareas", {
    data: {
      estudiante_id: estudianteId,
      ejercicio_id: 1,
      manos: "juntas",
      tempo_min_bpm: 60,
      tempo_max_bpm: 70,
      repeticiones_por_dia: 3,
      fecha_limite: enDias(7),
      ...cambios,
    },
    headers: CSRF,
  });
  expect(r.status(), await r.text()).toBe(201);
  return (await r.json()).id;
}

export function enDias(dias: number): string {
  const fecha = new Date(Date.now() + dias * 86_400_000 - 4 * 3_600_000);
  return fecha.toISOString().slice(0, 10);
}

export function fechaLegible(iso: string): string {
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

export async function entrar(page: Page, usuario: string, clave: string): Promise<void> {
  await page.goto("/entrar");
  await page.getByLabel("Usuario").fill(usuario);
  await page.getByLabel("Contraseña").fill(clave);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Espera el resultado: sesión iniciada, cambio de clave obligatorio o mensaje de error.
  await expect(
    page
      .getByRole("button", { name: "Salir" })
      .or(page.getByRole("heading", { name: "Cambiar contraseña" }))
      .or(page.getByRole("alert")),
  ).toBeVisible();
}

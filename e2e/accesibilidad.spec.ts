import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { Admin, CLAVE_DEMO, entrar, unico } from "./ayuda.ts";

const IMPACTOS_GRAVES = ["serious", "critical"];
const ESCRITORIO = { width: 1280, height: 800 };
const VISTAS_PRACTICA = [
  "encuadre",
  "microfono",
  "calibracion",
  "preparacion",
  "conteo",
  "ejecucion",
  "analizando",
  "resultado",
  "no-evaluable",
];

// Sin animaciones: el contraste se mide sobre el estado final de cada pantalla.
test.use({ contextOptions: { reducedMotion: "reduce" } });

async function erroresGraves(page: Page): Promise<string[]> {
  // Con movimiento reducido las transiciones duran 1 ms, pero siguen existiendo: axe mide
  // cuando ninguna animación ni transición está en curso.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter((v) => IMPACTOS_GRAVES.includes(v.impact ?? ""))
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
}

async function revisar(page: Page, pantalla: string): Promise<void> {
  expect(await erroresGraves(page), pantalla).toEqual([]);
}

test("PU-diseno-03: el análisis detecta un error grave", async ({ page }) => {
  await page.setContent(
    `<!doctype html><html lang="es"><title>Prueba</title><main><button></button></main></html>`,
  );
  expect((await erroresGraves(page)).join()).toContain("button-name");
});

async function sinSesion(page: Page): Promise<void> {
  test.setTimeout(120_000);
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  await revisar(page, "inicio de sesión");

  await page.goto("/design");
  await expect(page.getByRole("heading", { name: "Sistema de diseño" })).toBeVisible();
  await revisar(page, "galería");

  for (const vista of VISTAS_PRACTICA) {
    await page.goto(`/design/vista/${vista}`);
    await expect(page.locator(".practica")).toBeVisible();
    await revisar(page, `práctica: ${vista}`);
  }
}

async function administracion(page: Page): Promise<void> {
  test.setTimeout(120_000);
  await entrar(page, "admin.demo", CLAVE_DEMO);
  await page.goto("/usuarios");
  await expect(page.getByRole("list", { name: "Personas" })).toBeVisible();
  await revisar(page, "usuarios en el móvil");
  await page.setViewportSize(ESCRITORIO);
  await revisar(page, "usuarios en el escritorio");
  await page.getByRole("button", { name: "Salir" }).click();

  const admin = await Admin.demo();
  const usuario = unico("axe");
  const { clave } = await admin.crear(usuario, "estudiante");
  await entrar(page, usuario, clave);
  await expect(page.getByRole("heading", { name: "Cambiar contraseña" })).toBeVisible();
  await revisar(page, "cambio de contraseña");
}

async function docente(page: Page): Promise<void> {
  test.setTimeout(120_000);
  await entrar(page, "docente.demo", CLAVE_DEMO);
  await page.goto("/estudiantes");
  await expect(page.locator("a.tarjeta").first()).toBeVisible();
  await revisar(page, "mis estudiantes");

  await page.locator("a.tarjeta").first().click();
  await page.getByText("Asignar tarea").first().click();
  await expect(page.getByRole("form", { name: "Asignar tarea" })).toBeVisible();
  await revisar(page, "ficha, asignar tarea y observación");
  await page.setViewportSize(ESCRITORIO);
  await revisar(page, "ficha en el escritorio");
}

async function estudiante(page: Page, context: BrowserContext): Promise<void> {
  test.setTimeout(180_000);
  await context.grantPermissions(["camera", "microphone"]);
  await entrar(page, "estudiante.demo", CLAVE_DEMO);
  await page.goto("/tareas");
  await expect(page.locator("a.tarjeta").first()).toBeVisible();
  await revisar(page, "mis tareas");

  await page.locator("a.tarjeta").first().click();
  const practicar = page.getByRole("link", { name: "Practicar" });
  await expect(practicar).toBeVisible();
  const destino = await practicar.getAttribute("href");
  await revisar(page, "detalle de la tarea");

  await page.goto("/catalogo");
  await expect(page.locator("a.tarjeta").first()).toBeVisible();
  await revisar(page, "catálogo");

  await page.locator("a.tarjeta").first().click();
  await expect(page.getByRole("heading", { name: "Guía de posición" })).toBeVisible();
  await revisar(page, "detalle del ejercicio");

  await page.goto("/microfono");
  await expect(page.locator("[data-nivel]")).toBeAttached();
  await revisar(page, "micrófono");

  await page.goto(destino!);
  await expect(page.locator("[data-semaforo]")).not.toHaveAttribute("data-semaforo", "pidiendo", {
    timeout: 30_000,
  });
  await revisar(page, "encuadre con la cámara");
}

async function enTema(context: BrowserContext, tema: "claro" | "oscuro"): Promise<void> {
  await context.addInitScript((t) => localStorage.setItem("skilltrack.tema", t), tema);
}

test("PU-accesibilidad-01: sin sesión y pasos de la práctica, en claro", async ({
  page,
  context,
}) => {
  await enTema(context, "claro");
  await sinSesion(page);
});
test("PU-accesibilidad-02: sin sesión y pasos de la práctica, en oscuro", async ({
  page,
  context,
}) => {
  await enTema(context, "oscuro");
  await sinSesion(page);
});
test("PU-accesibilidad-03: administración y cambio de contraseña, en claro", async ({
  page,
  context,
}) => {
  await enTema(context, "claro");
  await administracion(page);
});
test("PU-accesibilidad-04: administración y cambio de contraseña, en oscuro", async ({
  page,
  context,
}) => {
  await enTema(context, "oscuro");
  await administracion(page);
});
test("PU-accesibilidad-05: docente, en claro", async ({ page, context }) => {
  await enTema(context, "claro");
  await docente(page);
});
test("PU-accesibilidad-06: docente, en oscuro", async ({ page, context }) => {
  await enTema(context, "oscuro");
  await docente(page);
});
test("PU-accesibilidad-07: estudiante, micrófono y encuadre, en claro", async ({
  page,
  context,
}) => {
  await enTema(context, "claro");
  await estudiante(page, context);
});
test("PU-accesibilidad-08: estudiante, micrófono y encuadre, en oscuro", async ({
  page,
  context,
}) => {
  await enTema(context, "oscuro");
  await estudiante(page, context);
});

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
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

for (const tema of ["claro", "oscuro"]) {
  test.describe(`accesibilidad en tema ${tema}`, () => {
    test.beforeEach(async ({ context }) => {
      await context.addInitScript((t) => localStorage.setItem("skilltrack.tema", t), tema);
    });

    test(`PU-a11y-${tema}-01: pantallas sin sesión y pasos de la práctica`, async ({ page }) => {
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
    });

    test(`PU-a11y-${tema}-02: administración y cambio de contraseña`, async ({ page }) => {
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
    });

    test(`PU-a11y-${tema}-03: docente`, async ({ page }) => {
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
    });

    test(`PU-a11y-${tema}-04: estudiante, micrófono y encuadre`, async ({ page, context }) => {
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
      await expect(page.locator("[data-semaforo]")).not.toHaveAttribute(
        "data-semaforo",
        "pidiendo",
        { timeout: 30_000 },
      );
      await revisar(page, "encuadre con la cámara");
    });
  });
}

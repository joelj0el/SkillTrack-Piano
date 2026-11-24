/**
 * HU-39 (ADR-004): gestión de planes del superadministrador, ventana de planes leída de la ruta
 * pública, solicitud de acceso desde la página de inicio y "Mi plan". Datos SINTÉTICOS; el pago
 * por QR no llama al banco.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CLAVE_DEMO, entrar, unico } from "./ayuda.ts";

test.use({ contextOptions: { reducedMotion: "reduce" } });

async function sinErroresGraves(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  const graves = violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

test("PA-HU39-12: el superadministrador gestiona planes y la ventana de inicio los lee de la ruta pública", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  const nombre = unico("Plan").slice(0, 40);
  await entrar(page, "superadmin.demo", CLAVE_DEMO);
  await expect(page.getByRole("heading", { level: 1, name: "Planes y convenios" })).toBeVisible();
  // Los planes de la semilla no tienen precio ni límites: se muestran como "—".
  await expect(page.locator("[data-plan=Institución]")).toContainText("Bs —");

  await page.getByText("Nuevo plan", { exact: true }).click();
  const formulario = page.getByRole("form", { name: "Nuevo plan" });
  await formulario.getByLabel("Nombre").fill(nombre);
  await formulario.getByLabel("Descripción").fill("Plan de prueba para una demostración");
  await formulario.getByLabel("Beneficios (uno por línea)").fill("Un beneficio\nOtro beneficio");
  await formulario.getByRole("button", { name: "Crear plan" }).click();
  await expect(page.locator(`[data-plan="${nombre}"]`)).toContainText("Activo");
  await sinErroresGraves(page);

  // La página de inicio (sin sesión) lo muestra en la ventana de planes.
  const anonimo = await browser.newPage({ ignoreHTTPSErrors: true });
  await anonimo.goto("/");
  await anonimo.getByRole("banner").getByRole("button", { name: "Ver planes" }).click();
  const ventana = anonimo.getByRole("dialog", { name: "Planes" });
  await expect(ventana.getByRole("heading", { name: nombre })).toBeVisible();
  await expect(ventana.getByRole("article").filter({ hasText: nombre })).toContainText("Bs —");

  // Al desactivarlo deja de aparecer en la ruta pública.
  const tarjeta = page.locator(`[data-plan="${nombre}"]`);
  await tarjeta.getByText(`Editar ${nombre}`).click();
  await tarjeta.getByLabel(/Activo/).uncheck();
  await tarjeta.getByRole("button", { name: "Guardar" }).click();
  await expect(tarjeta).toContainText("Inactivo");
  const publicos = await (await anonimo.request.get("/api/planes")).json();
  expect(publicos.map((p: { nombre: string }) => p.nombre)).not.toContain(nombre);
  await anonimo.close();
});

test("PA-HU39-13: la solicitud de acceso reemplaza al correo y Mi plan muestra el pago por QR en integración", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const nombre = unico("Persona");
  await page.goto("/");
  await page.getByRole("link", { name: "Solicitar acceso para mi institución" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Solicitar acceso" })).toBeVisible();
  const formulario = page.getByRole("form", { name: "Solicitar acceso" });
  await formulario.getByLabel("Tu nombre").fill(nombre);
  await formulario.getByLabel(/^Institución/).fill("Escuela de prueba");
  await formulario.getByLabel("Correo").fill("contacto@ejemplo.org");
  await formulario.getByLabel("Plan que te interesa").selectOption({ label: "Institución" });
  await sinErroresGraves(page);
  await formulario.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.locator("[data-solicitud-enviada]")).toBeVisible();

  await entrar(page, "superadmin.demo", CLAVE_DEMO);
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Solicitudes" })
    .click();
  const solicitud = page.locator("[data-solicitud]").filter({ hasText: nombre });
  await expect(solicitud).toContainText("Plan: Institución");
  await solicitud.getByRole("button", { name: "Marcar como atendida" }).click();
  await expect(solicitud).toContainText("Atendida");
  await sinErroresGraves(page);

  await page.context().clearCookies();
  await entrar(page, "admin.demo", CLAVE_DEMO);
  await page
    .getByRole("navigation", { name: "Principal" })
    .getByRole("link", { name: "Mi plan" })
    .click();
  await expect(page.locator("[data-mi-plan]")).toContainText("Instituto de demostración");
  await expect(
    page.getByRole("heading", { name: "Pago por QR en integración con el banco" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Pagar con QR" })).toBeDisabled();
  await sinErroresGraves(page);
});

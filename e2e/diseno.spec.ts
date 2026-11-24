import { expect, test } from "@playwright/test";

test("PU-diseno-01: la galería funciona, cambia de tema y respeta la política de seguridad", async ({
  page,
}) => {
  const violaciones: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy/i.test(m.text())) {
      violaciones.push(m.text());
    }
  });

  await page.goto("/design");
  await expect(page.getByRole("heading", { level: 1, name: "Sistema de diseño" })).toBeVisible();

  await page.getByRole("button", { name: "Cambiar a tema oscuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-tema", "oscuro");

  await page.getByRole("button", { name: "Abrir diálogo" }).click();
  await expect(page.getByRole("dialog", { name: "Ejemplo de diálogo" })).toBeVisible();
  await page.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Mostrar aviso" }).click();
  await expect(page.getByText("Cambios guardados")).toBeVisible();

  await page.goto("/design/vista/conteo");
  await expect(page.locator("[data-pulso]")).toBeVisible();
  expect(violaciones).toEqual([]);
});

test("PU-diseno-02: Cancelar durante la ejecución mide al menos 56 px", async ({ page }) => {
  await page.goto("/design/vista/ejecucion");
  const caja = await page.getByRole("button", { name: "Cancelar" }).boundingBox();
  expect(caja?.height).toBeGreaterThanOrEqual(56);
});

test("PU-diseno-04: la ventana de planes tiene título, mantiene el foco y se cierra con Esc y con Cerrar", async ({
  page,
}) => {
  // Los planes salen de la ruta pública (la semilla carga 3; otras pruebas pueden agregar).
  const activos = (await (await page.request.get("/api/planes")).json()).length;
  expect(activos).toBeGreaterThanOrEqual(3);
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "Ver planes" }).click();
  const ventana = page.getByRole("dialog", { name: "Planes" });
  await expect(ventana).toBeVisible();
  await expect(ventana.getByRole("article")).toHaveCount(activos);
  // El foco no sale de la ventana al recorrerla con Tab.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    expect(await ventana.evaluate((v) => v.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(ventana).toBeHidden();

  await page.getByRole("button", { name: "Ver planes" }).first().click();
  await ventana.getByRole("button", { name: "Cerrar" }).click();
  await expect(ventana).toBeHidden();

  await page.goto("/planes");
  await expect(page.getByRole("heading", { level: 1, name: "Planes" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(activos);
});

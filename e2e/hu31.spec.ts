import { expect, test } from "@playwright/test";
import { CLAVE_DEMO, entrar, unico } from "./ayuda.ts";

test("PA-HU31-01: el administrador crea un estudiante menor sin correo y la clave temporal se muestra una vez", async ({
  page,
}) => {
  const usuario = unico("menor");
  await entrar(page, "admin.demo", CLAVE_DEMO);
  await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible();

  const formulario = page.getByRole("form", { name: "Crear usuario" });
  await formulario.getByLabel("Nombre visible").fill("Lucía (prueba)");
  await formulario.getByLabel(/^Usuario/).fill(usuario);
  await formulario.getByLabel("Rol").selectOption("estudiante");
  await formulario.getByLabel("Menor de edad").check();
  await formulario.getByRole("button", { name: "Crear usuario" }).click();

  const aviso = page.locator("[data-clave-temporal]");
  await expect(aviso).toContainText(usuario);
  const clave = (await aviso.getAttribute("data-clave-temporal")) ?? "";
  expect(clave.length).toBeGreaterThanOrEqual(8);
  await expect(page.getByRole("list", { name: "Personas" })).toContainText("menor de edad");

  // Al recargar la pantalla, la clave ya no aparece.
  await page.reload();
  await expect(page.locator("[data-clave-temporal]")).toHaveCount(0);
  await expect(page.getByText(clave)).toHaveCount(0);

  await page.getByRole("button", { name: "Salir" }).click();
  await entrar(page, usuario, clave);
  await expect(page.getByRole("heading", { name: "Cambiar contraseña" })).toBeVisible();
});

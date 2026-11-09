import { expect, test } from "@playwright/test";
import { Admin, CLAVE_DEMO, entrar, unico } from "./ayuda.ts";

const PANTALLA_INICIAL = [
  ["estudiante.demo", "Mis tareas"],
  ["docente.demo", "Mis estudiantes"],
  ["admin.demo", "Usuarios"],
  ["investigador.demo", "Modo investigación"],
] as const;

test("PA-HU01-01: cada rol llega a su pantalla inicial", async ({ page }) => {
  for (const [usuario, pantalla] of PANTALLA_INICIAL) {
    await entrar(page, usuario, CLAVE_DEMO);
    await expect(page.getByRole("heading", { level: 1, name: pantalla })).toBeVisible();
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  }
});

test("PA-HU01-02: con clave temporal no se accede a nada hasta definir una contraseña nueva", async ({
  page,
}) => {
  const admin = await Admin.demo();
  const usuario = unico("temporal");
  const { clave } = await admin.crear(usuario, "estudiante");

  await entrar(page, usuario, clave);
  await expect(page.getByRole("heading", { name: "Cambiar contraseña" })).toBeVisible();
  for (const ruta of ["/tareas", "/catalogo", "/estudiantes"]) {
    await page.goto(ruta);
    await expect(page.getByRole("heading", { name: "Cambiar contraseña" })).toBeVisible();
  }

  // Igual a la temporal: el servidor la rechaza.
  await page.getByLabel("Contraseña actual").fill(clave);
  await page.getByLabel(/Contraseña nueva/).fill(clave);
  await page.getByLabel("Repite la contraseña nueva").fill(clave);
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("alert")).toBeVisible();

  await page.getByLabel(/Contraseña nueva/).fill("una-clave-nueva-1");
  await page.getByLabel("Repite la contraseña nueva").fill("una-clave-nueva-1");
  await page.getByRole("button", { name: "Guardar contraseña" }).click();
  await expect(page.getByRole("heading", { name: "Mis tareas" })).toBeVisible();
});

test("PA-HU01-03: usuario o contraseña incorrectos dan el mismo mensaje genérico", async ({
  page,
}) => {
  await entrar(page, "no.existe.nunca", "cualquier-clave");
  const sinUsuario = await page.getByRole("alert").textContent();

  await entrar(page, "estudiante.demo", "clave-equivocada");
  const claveMala = await page.getByRole("alert").textContent();

  expect(sinUsuario).toBe("Usuario o contraseña incorrectos");
  expect(claveMala).toBe(sinUsuario);
});

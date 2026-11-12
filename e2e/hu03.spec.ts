import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, entrar, parDocenteEstudiante } from "./ayuda.ts";
import { registrarPeticiones, verificarPrivacidad } from "./privacidad.ts";

test("PA-HU03-03: sin permiso de cámara se explica cómo habilitarlo y se ofrece Reintentar", async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  const { estudiante } = await parDocenteEstudiante();
  await entrar(page, estudiante, CLAVE_NUEVA);

  await page.goto("/practicar");

  await expect(
    page.getByRole("heading", { name: "No tenemos permiso para usar la cámara" }),
  ).toBeVisible();
  await expect(page.getByText('cambia "Cámara" a "Permitir"')).toBeVisible();
  await expect(page.getByRole("button", { name: "Reintentar" })).toBeVisible();
});

test("PA-HU03-05: durante 30 s de encuadre no sale ninguna imagen ni video por la red", async ({
  page,
  context,
}) => {
  const { estudiante } = await parDocenteEstudiante();
  await entrar(page, estudiante, CLAVE_NUEVA);
  await context.grantPermissions(["camera"]);

  const peticiones = registrarPeticiones(page);
  await page.goto("/practicar");
  await expect(page.locator("[data-semaforo]")).not.toHaveAttribute("data-semaforo", "pidiendo");
  const inicio = peticiones.length;
  await page.waitForTimeout(30_000);

  const durante = peticiones.slice(inicio);
  verificarPrivacidad(durante, new URL(page.url()).origin);
  // El semáforo mide sobre la imagen local y da motivos con texto.
  await expect(page.locator("[data-motivo]").first()).toBeVisible();
});

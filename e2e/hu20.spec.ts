import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, entrar, parDocenteEstudiante } from "./ayuda.ts";
import { registrarPeticiones, verificarPrivacidad } from "./privacidad.ts";

test("PU-web-12: con micrófono simulado se mide el nivel, se completa la prueba y no sale audio", async ({
  page,
  context,
}) => {
  const { estudiante } = await parDocenteEstudiante();
  await entrar(page, estudiante, CLAVE_NUEVA);
  await context.grantPermissions(["microphone"]);
  const peticiones = registrarPeticiones(page);

  await page.goto("/microfono");
  await page.getByRole("button", { name: "Probar el micrófono" }).click();
  // El micrófono simulado emite un tono: el medidor sube por encima del silencio digital.
  await expect
    .poll(async () => Number(await page.locator("[data-nivel]").getAttribute("data-nivel")), {
      timeout: 15_000,
    })
    .toBeGreaterThan(-90);
  await expect(page.locator("[data-semaforo-audio]")).toBeVisible({ timeout: 15_000 });

  verificarPrivacidad(peticiones, new URL(page.url()).origin);
});

test("PA-HU20-03: sin permiso de micrófono se ofrece el modo solo visión", async ({
  page,
  context,
}) => {
  await context.clearPermissions();
  const { estudiante } = await parDocenteEstudiante();
  await entrar(page, estudiante, CLAVE_NUEVA);

  await page.goto("/microfono");
  await expect(page.getByRole("heading", { name: "No podemos usar el micrófono" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar en modo solo visión" }).click();
  await expect(page.locator("[data-continuar=vision]")).toContainText(
    "las notas y el ritmo no se evaluarán",
  );
});

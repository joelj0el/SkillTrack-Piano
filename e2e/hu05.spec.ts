import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, entrar, parDocenteEstudiante } from "./ayuda.ts";
import { registrarPeticiones, verificarPrivacidad } from "./privacidad.ts";

// La cámara simulada de Chromium muestra un patrón de prueba sin manos: el detector debe cargar,
// procesar fotogramas y NO dar verde. Que detecte manos reales se verifica con la webcam.
test("PU-web-11: el detector autoalojado carga, procesa la cámara y sin manos no avanza solo", async ({
  page,
  context,
}) => {
  const { estudiante } = await parDocenteEstudiante();
  await entrar(page, estudiante, CLAVE_NUEVA);
  await context.grantPermissions(["camera"]);
  const peticiones = registrarPeticiones(page);

  await page.goto("/practicar?ejercicio=EJ-03&manos=juntas");

  await expect(page.locator("[data-estado-detector]")).toHaveAttribute(
    "data-estado-detector",
    "listo",
    { timeout: 30_000 },
  );
  await expect
    .poll(async () => Number(await page.locator("[data-fps]").getAttribute("data-fps")))
    .toBeGreaterThan(0);
  await expect(page.locator("[data-secuencia=provisional]")).toContainText("Si♭");
  await expect(page.locator('[data-motivo="sin-manos"]')).toBeVisible();
  // Sin manos no hay verde: no arranca la cuenta atrás y el encuadre no avanza.
  await expect(page.locator("[data-cuenta-atras]")).toHaveAttribute("data-cuenta-atras", "espera");
  await page.waitForTimeout(4_000);
  await expect(page.getByRole("heading", { name: "1. Coloca el teléfono" })).toBeVisible();
  await expect(page.locator("[data-cuenta-atras]")).toHaveAttribute("data-cuenta-atras", "espera");

  verificarPrivacidad(peticiones, new URL(page.url()).origin);
});

import { expect, test, type Request } from "@playwright/test";
import { CLAVE_NUEVA, entrar, parDocenteEstudiante } from "./ayuda.ts";

const TIPOS_DE_MEDIOS = /^(image|video|audio)\/|multipart\//i;

test("PU-web-12: con micrófono simulado se mide el nivel, se completa la prueba y no sale audio", async ({
  page,
  context,
}) => {
  const { estudiante } = await parDocenteEstudiante();
  await entrar(page, estudiante, CLAVE_NUEVA);
  await context.grantPermissions(["microphone"]);
  const peticiones: Request[] = [];
  page.on("request", (r) => peticiones.push(r));

  await page.goto("/microfono");
  await page.getByRole("button", { name: "Probar el micrófono" }).click();
  // El micrófono simulado emite un tono: el medidor sube por encima del silencio digital.
  await expect
    .poll(async () => Number(await page.locator("[data-nivel]").getAttribute("data-nivel")), {
      timeout: 15_000,
    })
    .toBeGreaterThan(-90);
  await expect(page.locator("[data-semaforo-audio]")).toBeVisible({ timeout: 15_000 });

  const origen = new URL(page.url()).origin;
  for (const r of peticiones) {
    const tipo = (await r.allHeaders())["content-type"] ?? "";
    expect(tipo, r.url()).not.toMatch(TIPOS_DE_MEDIOS);
    expect(r.postDataBuffer()?.length ?? 0, r.url()).toBeLessThanOrEqual(256 * 1024);
    expect(new URL(r.url()).origin, r.url()).toBe(origen);
  }
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

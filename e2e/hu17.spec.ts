import { expect, request, test } from "@playwright/test";
import { CLAVE_NUEVA, entrar, parDocenteEstudiante } from "./ayuda.ts";

test("PA-HU17-01: manifiesto instalable y service worker activo en 10 s o menos", async ({
  page,
}) => {
  await page.goto("/");
  const manifiesto = await (await page.request.get("/manifest.webmanifest")).json();
  expect(manifiesto.name).toBe("SkillTrack-Piano");
  expect(manifiesto.display).toBe("standalone");
  expect(manifiesto.start_url).toBe("/");
  const tamanos = manifiesto.icons.map((i: { sizes: string }) => i.sizes);
  expect(tamanos).toEqual(expect.arrayContaining(["192x192", "512x512"]));

  const inicio = Date.now();
  const estado = await page.evaluate(async () => {
    const registro = await navigator.serviceWorker.ready;
    const sw = registro.active;
    if (sw && sw.state !== "activated") {
      await new Promise((ok) => sw.addEventListener("statechange", ok, { once: true }));
    }
    return registro.active?.state;
  });
  expect(estado).toBe("activated");
  expect(Date.now() - inicio).toBeLessThanOrEqual(10_000);
});

test("PA-HU17-02: sin red se muestra la app y las secciones del servidor dicen Sin conexión", async ({
  page,
  context,
}) => {
  const { estudiante } = await parDocenteEstudiante();
  await entrar(page, estudiante, CLAVE_NUEVA);
  await expect(page.getByRole("heading", { name: "Mis tareas" })).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();

  await context.setOffline(true);
  await page.reload();

  await expect(page.getByText("SkillTrack-Piano").first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sin conexión" })).toBeVisible();
  await context.setOffline(false);
});

test("PA-HU17-03: cabeceras de seguridad en toda ruta y redirección de HTTP a HTTPS", async () => {
  const cliente = await request.newContext({ ignoreHTTPSErrors: true });
  for (const ruta of ["/", "/tareas", "/api/health", "/manifest.webmanifest"]) {
    const r = await cliente.get(`https://localhost${ruta}`);
    const h = r.headers();
    expect(h["strict-transport-security"], ruta).toMatch(/max-age=\d+/);
    expect(h["content-security-policy"], ruta).toContain("connect-src 'self'");
    expect(h["permissions-policy"], ruta).toBe("camera=(self), microphone=(self)");
    expect(h["referrer-policy"], ruta).toBe("no-referrer");
  }
  const http = await cliente.get("http://localhost/tareas", { maxRedirects: 0 });
  expect([301, 308]).toContain(http.status());
  expect(http.headers().location).toBe("https://localhost/tareas");
});

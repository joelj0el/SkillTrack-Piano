/**
 * HU-40: pago por QR con el proveedor del banco, contra un servidor FALSO del banco (nunca el
 * real). Necesita la pila con infra/docker-compose.banco-falso.yml y E2E_BANECO=1; si no, se
 * omite. Datos SINTÉTICOS: el precio lo crea la prueba.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, request, test, type Page } from "@playwright/test";
import { CLAVE_DEMO, sesionApi, unico } from "./ayuda.ts";

test.use({ contextOptions: { reducedMotion: "reduce" } });
test.skip(!process.env.E2E_BANECO, "Solo con la pila del banco falso (E2E_BANECO=1).");

const CSRF = { "x-skilltrack-csrf": "1" };
const BANCO_FALSO = process.env.E2E_BANCO_FALSO ?? "http://127.0.0.1:18080";

async function sinErroresGraves(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  const graves = violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

test("PA-HU40-04: con el banco (servidor falso), registrarse → QR → pagado → entra a la app", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const api = await sesionApi("superadmin.demo", CLAVE_DEMO);
  const nombre = unico("Plan").slice(0, 40);
  const creado = await api.post("/api/admin/planes", {
    headers: CSRF,
    data: {
      nombre,
      descripcion: "Plan sintético de la prueba E2E",
      beneficios: ["Un beneficio"],
      precio_bs: 75,
      periodo: "mensual",
      limite_docentes: null,
      limite_estudiantes: null,
      destacado: false,
      activo: true,
    },
  });
  expect(creado.status(), await creado.text()).toBe(201);
  const plan = (await creado.json()) as { id: number };
  const usuario = unico("banco");
  try {
    await page.goto(`/registro?plan=${plan.id}`);
    const formulario = page.getByRole("form", { name: "Crear tu cuenta" });
    await formulario.getByLabel("Tu nombre").fill("Persona compradora");
    await formulario.getByLabel("Nombre de tu clase o estudio").fill("Clases de prueba");
    await formulario.getByLabel("Correo").fill(`${usuario}@ejemplo.org`);
    await formulario.getByLabel("Teléfono").fill("+591 70000000");
    await formulario.getByLabel(/^Usuario/).fill(usuario);
    await formulario.getByLabel(/^Contraseña/).fill("clave-compradora-1");
    await formulario.getByLabel(/Acepto los/).check();
    await formulario.getByRole("button", { name: "Crear mi cuenta" }).click();

    // El QR del banco (falso): imagen, monto, vencimiento y "Esperando el pago…".
    await expect(page.getByRole("heading", { level: 1, name: "Pago de tu plan" })).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Código QR para pagar Bs 75,00 al mes" }),
    ).toBeVisible();
    await expect(page.getByText("Esperando el pago…", { exact: true })).toBeVisible();
    await expect(page.getByText(/^Vence el \d\d\/\d\d\/\d{4}\.$/)).toBeVisible();
    await sinErroresGraves(page);

    // Se paga en el banco falso; la pantalla consulta sola cada 5 s y entra a la app.
    const pago = await (await page.request.get("/api/mi-pago")).json();
    const banco = await request.newContext();
    const pagar = await banco.post(`${BANCO_FALSO}/_control/pagar`, {
      data: { transactionId: pago.qr.id_transaccion },
    });
    expect(pagar.status()).toBe(200);
    await banco.dispose();
    const asistente = page.getByRole("region", { name: "Asistente de primer ingreso" });
    await expect(asistente).toBeVisible({ timeout: 30_000 });
    await expect(asistente.getByText("Paso 1 de 2")).toBeVisible();
  } finally {
    await api.patch(`/api/admin/planes/${plan.id}`, { headers: CSRF, data: { activo: false } });
  }
});

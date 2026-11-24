/**
 * HU-40 (ADR-005): registro de compradores desde la página de inicio, cuenta pendiente de pago,
 * pago por QR (adaptador simulado: nunca llama al banco), activación y primer ingreso. Datos
 * SINTÉTICOS: el precio y el convenio los crea la prueba; no son precios del producto.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CLAVE_DEMO, entrar, sesionApi, unico } from "./ayuda.ts";

test.use({ contextOptions: { reducedMotion: "reduce" } });

const CSRF = { "x-skilltrack-csrf": "1" };
const CLAVE = "clave-compradora-1";

async function sinErroresGraves(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  const graves = violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

/** Plan de la prueba, con un precio sintético para poder generar el QR. */
async function planDePrueba(precio: number | null) {
  const api = await sesionApi("superadmin.demo", CLAVE_DEMO);
  const nombre = unico("Plan").slice(0, 40);
  const r = await api.post("/api/admin/planes", {
    headers: CSRF,
    data: {
      nombre,
      descripcion: "Plan sintético de la prueba E2E",
      beneficios: ["Un beneficio"],
      precio_bs: precio,
      periodo: "mensual",
      limite_docentes: null,
      limite_estudiantes: null,
      destacado: false,
      activo: true,
    },
  });
  expect(r.status(), await r.text()).toBe(201);
  const plan = (await r.json()) as { id: number; nombre: string };
  return {
    api,
    plan,
    /** Lo desactiva al terminar: la página de inicio no acumula planes de prueba. */
    retirar: async () => {
      await api.patch(`/api/admin/planes/${plan.id}`, { headers: CSRF, data: { activo: false } });
    },
  };
}

async function llenarRegistro(page: Page, usuario: string, institucion: string) {
  const formulario = page.getByRole("form", { name: "Crear tu cuenta" });
  await formulario.getByLabel("Tu nombre").fill("Persona compradora");
  await formulario.getByLabel(/^Nombre de (tu clase|la institución)/).fill(institucion);
  await formulario.getByLabel("Correo").fill(`${usuario}@ejemplo.org`);
  await formulario.getByLabel("Teléfono").fill("+591 70000000");
  await formulario.getByLabel(/^Usuario/).fill(usuario);
  await formulario.getByLabel(/^Contraseña/).fill(CLAVE);
  await formulario.getByLabel(/Acepto los/).check();
  return formulario;
}

test("PA-HU40-09: elegir plan → registrarse → pagar (simulado) → activar → entrar", async ({
  page,
  browser,
}) => {
  test.setTimeout(180_000);
  const { plan, retirar } = await planDePrueba(75);
  const usuario = unico("compra");
  const institucion = unico("Escuela");
  try {
    // Elegir el plan desde la ventana de planes de la página de inicio.
    await page.goto("/");
    await page.getByRole("banner").getByRole("button", { name: "Empezar ahora" }).click();
    const ventana = page.getByRole("dialog", { name: "Planes" });
    await ventana.getByRole("link", { name: `Elegir el plan ${plan.nombre}` }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Crear tu cuenta" })).toBeVisible();
    await expect(page.getByLabel("Plan")).toHaveValue(String(plan.id));

    // Registrarse como institución.
    await page.getByLabel("Represento a una institución").check();
    const formulario = await llenarRegistro(page, usuario, institucion);
    await sinErroresGraves(page);
    await formulario.getByRole("button", { name: "Crear mi cuenta" }).click();

    // Cuenta pendiente: solo la pantalla de pago, con el QR simulado y el monto del plan.
    await expect(page.getByRole("heading", { level: 1, name: "Pago de tu plan" })).toBeVisible();
    await expect(page.getByRole("img", { name: /QR simulado/ })).toBeVisible();
    await expect(page.locator("[data-monto]")).toHaveText("Bs 75,00 al mes");
    await expect(page.getByText("Pago en verificación")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Principal" })).toHaveCount(0);
    await sinErroresGraves(page);
    await page.goto("/usuarios");
    await expect(page).toHaveURL(/\/pago$/);
    await page.getByRole("button", { name: "Ya pagué: verificar" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Todavía no se confirmó" }),
    ).toBeVisible();

    // El superadministrador verifica el pago y activa el plan desde Solicitudes.
    const contexto = await browser.newContext({
      ignoreHTTPSErrors: true,
      reducedMotion: "reduce",
    });
    const super_ = await contexto.newPage();
    await entrar(super_, "superadmin.demo", CLAVE_DEMO);
    await super_
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Solicitudes" })
      .click();
    const cuenta = super_.locator(`[data-cuenta="${institucion}"]`);
    await expect(cuenta).toContainText(`${usuario}@ejemplo.org`);
    await expect(cuenta).toContainText("QR generado");
    await sinErroresGraves(super_);
    await cuenta.getByRole("button", { name: `Activar el plan de ${institucion}` }).click();
    await expect(cuenta).toHaveCount(0);
    await contexto.close();

    // La cuenta entra a la aplicación: primer ingreso con el asistente, que se puede saltar.
    await page.getByRole("button", { name: "Ya pagué: verificar" }).click();
    const asistente = page.getByRole("region", { name: "Asistente de primer ingreso" });
    await expect(asistente.getByText("Paso 1 de 3")).toBeVisible();
    await asistente.getByRole("button", { name: "Saltar el asistente" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible();
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Mi plan" })
      .click();
    await expect(page.locator("[data-mi-plan]")).toContainText(plan.nombre);
    await expect(page.locator("[data-estado]")).toHaveAttribute("data-estado", "activa");
  } finally {
    await retirar();
  }
});

test("PA-HU40-10: inicio con Iniciar sesión y Empezar ahora, textos legales y asistente con un convenio gratuito", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { api, plan, retirar } = await planDePrueba(null);
  const codigo = `E2E-${Date.now().toString(36).toUpperCase()}`;
  const r = await api.post("/api/admin/convenios", {
    headers: CSRF,
    data: { codigo, plan_id: plan.id, precio_bs: 0, cupos: 1, vence: "2099-12-31" },
  });
  expect(r.status(), await r.text()).toBe(201);
  const usuario = unico("indep");
  const estudiante = unico("est");
  try {
    await page.goto("/");
    const barra = page.getByRole("banner");
    await expect(barra.getByRole("link", { name: "Iniciar sesión" })).toHaveAttribute(
      "href",
      "/entrar",
    );
    await expect(barra.getByRole("button", { name: "Empezar ahora" })).toBeVisible();

    for (const [ruta, titulo] of [
      ["/terminos", "Términos y condiciones"],
      ["/privacidad", "Política de privacidad"],
    ] as const) {
      await page.goto(ruta);
      await expect(page.getByRole("heading", { level: 1, name: titulo })).toBeVisible();
      await expect(page.getByText("Pendiente de revisión legal")).toBeVisible();
      await sinErroresGraves(page);
    }

    // Docente independiente con un convenio de precio 0: la cuenta queda activa sin pago.
    await page.goto("/registro");
    const formulario = await llenarRegistro(page, usuario, "Clases de prueba");
    await formulario.getByLabel("Tengo un código de convenio").check();
    await formulario.getByLabel(/^Código de convenio/).fill(codigo.toLowerCase());
    await formulario.getByRole("button", { name: "Crear mi cuenta" }).click();

    const asistente = page.getByRole("region", { name: "Asistente de primer ingreso" });
    await expect(asistente.getByText("Paso 1 de 2")).toBeVisible();
    await sinErroresGraves(page);
    await asistente.getByRole("button", { name: "Empezar" }).click();
    await asistente.getByLabel("Nombre visible").fill("Estudiante de prueba");
    await asistente.getByLabel(/^Usuario/).fill(estudiante);
    await asistente.getByRole("button", { name: "Crear estudiante" }).click();
    await expect(asistente.locator("[data-clave-temporal]")).toContainText(estudiante);
    await asistente.getByRole("button", { name: "Terminar" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Usuarios" })).toBeVisible();
    // Su primer estudiante quedó asignado a él.
    await expect(page.getByRole("list", { name: "Asignaciones" })).toContainText(
      "Estudiante de prueba",
    );

    // El código ya no tiene cupos: el segundo registro recibe un mensaje claro.
    await page.context().clearCookies();
    await page.goto("/registro");
    const otro = await llenarRegistro(page, unico("otro"), "Otra clase");
    await otro.getByLabel("Tengo un código de convenio").check();
    await otro.getByLabel(/^Código de convenio/).fill(codigo);
    await otro.getByRole("button", { name: "Crear mi cuenta" }).click();
    await expect(page.getByRole("alert")).toHaveText(
      "El código de convenio ya no tiene cupos disponibles.",
    );
  } finally {
    await retirar();
  }
});

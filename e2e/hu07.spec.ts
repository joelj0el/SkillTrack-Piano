/**
 * P-42, pantalla de resultados (HU-07, 25, 26, 27 y 28) con cámara y micrófono simulados.
 * Un intento completo se comparte entre las pruebas de la serie para no repetir la práctica.
 */
import AxeBuilder from "@axe-core/playwright";
import { devices, expect, test, type Browser, type Page } from "@playwright/test";
import { publicarArtefactos } from "./artefactos.ts";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante, sesionApi } from "./ayuda.ts";
import { escena, intentoCompleto, simularDispositivos } from "./intento-simulado.ts";

const CSRF = { "x-skilltrack-csrf": "1" };
const BASE = process.env.E2E_URL ?? "https://localhost";
const BLOQUES = ["bien", "mejorar", "notas", "variables", "resumen", "docente", "progreso"];

test.use({
  launchOptions: {
    args: ["--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
  },
});

/** Instante en que aparece cada fase (para medir PRM-03 sin depender de la red). */
function registrarFases() {
  const fases: Record<string, number> = {};
  new MutationObserver(() => {
    for (const el of document.querySelectorAll("[data-fase]")) {
      const f = el.getAttribute("data-fase")!;
      fases[f] ??= performance.now();
    }
  }).observe(document, { subtree: true, childList: true, attributes: true });
  (window as unknown as { __fases: Record<string, number> }).__fases = fases;
}

async function nuevaPagina(browser: Browser): Promise<Page> {
  const contexto = await browser.newContext({
    ...devices["Pixel 7"],
    baseURL: BASE,
    ignoreHTTPSErrors: true,
    locale: "es-BO",
    timezoneId: "America/La_Paz",
    reducedMotion: "reduce",
    permissions: ["camera", "microphone"],
  });
  const page = await contexto.newPage();
  await page.addInitScript(registrarFases);
  return page;
}

/** Un intento v2 guardado por la API, sin tarea, con su calificación (para el progreso). */
function intentoAnterior(versionId: number, dias: number, nivel: string) {
  return {
    version: 2,
    client_uuid: crypto.randomUUID(),
    version_ejercicio_id: versionId,
    tarea_id: null,
    version_nucleo: "0.1.0",
    version_modelo_mano: "simulado@e2e",
    instrumento: "digital",
    manos: "juntas",
    clase_dispositivo: "Android/Chrome",
    modo: "VA",
    modo_metronomo: "sin",
    tempo_elegido_bpm: 60,
    estado: "evaluado",
    motivo_no_evaluable: null,
    iniciado_en: new Date(Date.now() - dias * 86_400_000).toISOString(),
    duracion_ms: 9000,
    pct_eventos_evaluables: 90,
    pct_digitacion_correcta: null,
    tempo_medido_bpm: 60,
    referencia_temporal: "tempo_inicial",
    cambio_tempo_pct: 1,
    audio_sin_procesar: true,
    calificacion: [
      { clase: "ER-A", nivel, pct: 92 },
      { clase: "ER-E", nivel: "no-evaluado", pct: null },
    ],
    eventos: [],
  };
}

test.describe.serial("pantalla de resultados de un intento completo", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    // La escala de 2 octavas a manos juntas tiene 58 eventos: todos con banda.
    await publicarArtefactos(58);
    const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
    const tareaId = await crearTareaApi(docente, estudianteId);

    const delDocente = await sesionApi(docente, CLAVE_NUEVA);
    const taxonomia = await (await delDocente.get("/api/catalogo/taxonomia")).json();
    const ritmo = taxonomia.find((c: { codigo: string }) => c.codigo === "ER-B");
    const obs = await delDocente.post("/api/observaciones", {
      data: { tarea_id: tareaId, clase_error_id: ritmo.id, texto: "Cuida el pulso en la bajada" },
      headers: CSRF,
    });
    expect(obs.status(), await obs.text()).toBe(201);

    const delEstudiante = await sesionApi(estudiante, CLAVE_NUEVA);
    const ej = (await (await delEstudiante.get("/api/catalogo/ejercicios/EJ-01")).json())
      .version_vigente.id as number;
    for (const [dias, nivel] of [
      [2, "en-desarrollo"],
      [1, "logrado"],
    ] as const) {
      const r = await delEstudiante.post("/api/intentos", {
        data: intentoAnterior(ej, dias, nivel),
        headers: CSRF,
      });
      expect(r.status(), await r.text()).toBe(201);
    }

    page = await nuevaPagina(browser);
    // Un tropiezo: el 6.º instante llega 60 ms tarde (≈ 23 % del intervalo a ♩ = 57).
    await simularDispositivos(page, escena(57, { 5: 60 }));
    await entrar(page, estudiante, CLAVE_NUEVA);
    await intentoCompleto(page, tareaId);
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  test("PA-HU07-01: el resultado aparece en ≤ 5 s después de terminar (PRM-03)", async () => {
    const fases = await page.evaluate(
      () => (window as unknown as { __fases: Record<string, number> }).__fases,
    );
    expect(fases.analizando).toBeDefined();
    const analisis = await page.locator("[aria-label=Resultados] > p.suave").first().textContent();
    console.log(`PRM-03: ${Math.round(fases.resultado! - fases.analizando!)} ms; ${analisis}`);
    expect(fases.resultado! - fases.analizando!, analisis ?? "").toBeLessThanOrEqual(5_000);
  });

  test("PA-HU07-02: bloques en el orden del panel, una corrección principal y sin estrellas", async () => {
    const orden = await page
      .locator("[data-bloque]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-bloque")));
    expect(orden).toEqual(BLOQUES);
    const mejorar = page.locator("[data-bloque=mejorar]");
    await expect(mejorar.locator("[data-correccion=principal]")).toHaveCount(1);
    // Las demás quedan plegadas.
    expect(await mejorar.locator("details [data-correccion=otra]").count()).toBeGreaterThan(0);
    await expect(mejorar.locator("details")).not.toHaveAttribute("open");
    await expect(page.locator("[aria-label=Resultados]")).not.toContainText(/★|estrella|puntaje/i);
  });

  test("PA-HU07-03: la pantalla de resultados no tiene errores graves de accesibilidad", async () => {
    const { violations } = await new AxeBuilder({ page }).analyze();
    const graves = violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
    expect(graves.map((v) => v.id)).toEqual([]);
  });

  test("PA-HU26-01: la corrección principal es la más crítica, con su nombre, dónde y su mensaje", async () => {
    const principal = page.locator("[data-correccion=principal]");
    // El ritmo es la clase más crítica: el tropiezo va primero.
    await expect(principal).toHaveAttribute("data-indicador", "IND-B2");
    await expect(principal.getByRole("heading")).toHaveText("Tropiezo o pausa");
    await expect(principal).toContainText(/Notas \d/);
    await expect(principal).toContainText("pendiente de aprobación del panel");
    for (const otra of await page.locator("[data-correccion=otra]").all()) {
      // Plegadas: fuera del árbol de accesibilidad hasta abrirlas.
      await expect(otra.locator("h4")).not.toBeEmpty();
    }
  });

  test("PA-HU25-01: cada nota muestra su familia con icono y texto; al tocarla, mano, dedo y ms", async () => {
    const notas = page.locator("[data-bloque=notas] button[data-familia]");
    expect(await notas.count()).toBeGreaterThan(0);
    for (const n of await notas.all()) {
      await expect(n.locator(".chip svg")).toHaveCount(1);
      await expect(n.locator(".chip")).not.toBeEmpty();
    }
    const tiempo = page.locator("[data-bloque=notas] button[data-familia=tiempo]").first();
    await tiempo.click();
    await expect(tiempo).toHaveAttribute("aria-expanded", "true");
    const detalle = page.locator("[data-detalle]");
    await expect(detalle).toContainText(/Mano (derecha|izquierda)/);
    await expect(detalle).toContainText("Dedo");
    await expect(detalle).toContainText(/\d+ ms/);
  });

  test("PA-HU27-02: ninguna variable se califica sin datos: los no evaluables por diseño dicen No evaluado y por qué", async () => {
    for (const clase of ["ER-E", "ER-F"]) {
      const fila = page.locator(`[data-variable=${clase}]`);
      await expect(fila).toHaveAttribute("data-nivel", "no-evaluado");
      await expect(fila).toContainText("No evaluado");
      await expect(fila).toContainText(/No evaluable por diseño/);
    }
    await expect(page.locator("[data-regla-prm22]")).toContainText("90 %");
  });

  test("PA-HU26-02: se muestra la última observación del docente con su aspecto", async () => {
    const docente = page.locator("[data-bloque=docente]");
    await expect(docente).toContainText("Cuida el pulso en la bajada");
    await expect(docente).toContainText(/Aspecto: .+/);
  });

  test("PA-HU28-01: la calificación por variable de los intentos anteriores del mismo ejercicio y manos", async () => {
    const filas = page.getByRole("table", { name: "Últimos intentos" }).locator("tr[data-intento]");
    await expect(filas).toHaveCount(2);
    await expect(filas.first()).toContainText("Logrado");
    await expect(filas.nth(1)).toContainText("En desarrollo");
  });

  test("PA-HU35-01: con la bandera del clasificador apagada (por defecto), el resultado es idéntico al de las reglas", async () => {
    // Sin etiqueta del clasificador en ninguna parte de la pantalla.
    await expect(page.locator("[data-clasificador]")).toHaveCount(0);
    await expect(page.locator("[aria-label=Resultados]")).not.toContainText(/clasificador/i);
    // Lo que se ve y lo que se guarda es lo de las reglas: misma calificación y mismos indicadores.
    const enPantalla = await page
      .locator("[data-bloque=variables] tr[data-variable]")
      .evaluateAll((filas) =>
        filas.map((f) => [f.getAttribute("data-variable"), f.getAttribute("data-nivel")]),
      );
    const indicadores = await page
      .locator("[data-bloque=mejorar] [data-correccion]")
      .evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute("data-indicador")))].sort());
    const [guardado] = await (await page.request.get("/api/mis-intentos")).json();
    expect(
      guardado.calificacion.map((c: { clase: string; nivel: string }) => [c.clase, c.nivel]),
    ).toEqual(enPantalla);
    expect(guardado.indicadores_deficientes).toEqual(indicadores);
  });

  test("PA-HU28-02: Reintentar vuelve al conteo con la misma calibración y el mismo tempo", async () => {
    await page.getByRole("button", { name: "Reintentar" }).click();
    const conteo = page.locator(".conteo-escena");
    await expect(page.locator("[data-fase=conteo]")).toBeVisible();
    await expect(conteo).toHaveAttribute("data-tempo", "60");
    await expect(page.getByRole("heading", { name: "2. Calibra el teclado" })).toHaveCount(0);
  });
});

test.describe.serial("intento no evaluable", () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(240_000);
    const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
    const tareaId = await crearTareaApi(docente, estudianteId);
    page = await nuevaPagina(browser);
    await simularDispositivos(page, escena(57));
    await entrar(page, estudiante, CLAVE_NUEVA);
    // Solo suenan 8 de los 29 instantes: la ejecución queda incompleta.
    await intentoCompleto(page, tareaId, { tocarHasta: 8 });
  });

  test.afterAll(async () => {
    await page?.context().close();
  });

  test("PA-HU27-01: el intento incompleto es No evaluable, con su motivo y una acción sugerida", async () => {
    await expect(page.locator("[data-motivo-no-evaluable]")).toHaveText("Ejecución incompleta");
    await expect(page.locator("[data-accion-sugerida]")).toContainText(
      "Toca el ejercicio completo",
    );
    for (const fila of await page.locator("[data-variable]").all()) {
      await expect(fila).toHaveAttribute("data-nivel", "no-evaluado");
    }
  });

  test("PA-HU25-02: las notas no evaluables muestran su motivo", async () => {
    const nota = page.locator("[data-bloque=notas] button[data-familia=no-evaluable]").last();
    await nota.click();
    await expect(page.locator("[data-motivo-nota]")).not.toBeEmpty();
  });
});

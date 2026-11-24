/**
 * Gráficos de Mi progreso, Mi grupo, la ficha del estudiante y los paneles: cada uno con título,
 * texto alternativo y su tabla equivalente, sin rankings y sin errores graves de accesibilidad.
 * Datos SINTÉTICOS creados por la API.
 */
import { randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante, sesionApi } from "./ayuda.ts";

const CSRF = { "x-skilltrack-csrf": "1" };
const SIN_RANKING = /ranking|puesto|posición|puntaje|estrella|★|mejor estudiante|peor/i;
// Mi grupo dice "no es un ranking": ahí se buscan las demás palabras.
const SIN_POSICIONES = /puesto|posición|puntaje|estrella|★|mejor estudiante|peor/i;

test.use({ contextOptions: { reducedMotion: "reduce" } });

function intento(
  versionId: number,
  tareaId: number,
  semanasAtras: number,
  pct: number,
  indicadores: string[],
) {
  return {
    version: 2,
    client_uuid: randomUUID(),
    version_ejercicio_id: versionId,
    tarea_id: tareaId,
    version_nucleo: "0.1.0",
    version_modelo_mano: "hand_landmarker@e2e",
    instrumento: "digital",
    manos: "juntas",
    clase_dispositivo: "E2E",
    modo: "VA",
    modo_metronomo: "con",
    tempo_elegido_bpm: 64,
    estado: "evaluado",
    motivo_no_evaluable: null,
    iniciado_en: new Date(Date.now() - (semanasAtras * 7 * 24 + 1) * 3_600_000).toISOString(),
    duracion_ms: 9000,
    pct_eventos_evaluables: 90,
    pct_digitacion_correcta: null,
    tempo_medido_bpm: 64,
    referencia_temporal: "tempo_elegido",
    cambio_tempo_pct: 1,
    audio_sin_procesar: true,
    eventos: [],
    calificacion: [
      { clase: "ER-A", nivel: pct >= 90 ? "logrado" : "en-desarrollo", pct },
      { clase: "ER-B", nivel: "por-mejorar", pct: 60 },
      { clase: "ER-E", nivel: "no-evaluado", pct: null },
    ],
    indicadores_deficientes: indicadores,
  };
}

async function sinErroresGraves(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  const graves = violations.filter((v) => ["serious", "critical"].includes(v.impact ?? ""));
  expect(graves.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
}

test.describe("gráficos de progreso (HU-15, HU-30)", () => {
  let par: Awaited<ReturnType<typeof parDocenteEstudiante>>;

  test.beforeAll(async () => {
    par = await parDocenteEstudiante();
    const tareaId = await crearTareaApi(par.docente, par.estudianteId);
    const api = await sesionApi(par.estudiante, CLAVE_NUEVA);
    const ej = (await (await api.get("/api/catalogo/ejercicios/EJ-01")).json()).version_vigente
      .id as number;
    // Tres semanas: Notas sube 70 → 80 → 95; el tropiezo aparece en los dos primeros.
    for (const [semanas, pct, indicadores] of [
      [2, 70, ["IND-A1", "IND-B2"]],
      [1, 80, ["IND-A1", "IND-B2"]],
      [0, 95, ["IND-B2"]],
    ] as const) {
      const r = await api.post("/api/intentos", {
        data: intento(ej, tareaId, semanas, pct, [...indicadores]),
        headers: CSRF,
      });
      expect(r.status(), await r.text()).toBe(201);
    }
  });

  test("PU-graficos-02: Mi progreso tiene una línea por variable y los errores más frecuentes en barras", async ({
    page,
  }) => {
    await entrar(page, par.estudiante, CLAVE_NUEVA);
    await page.goto("/mi-progreso");
    const progreso = page.locator("[data-figura=progreso]");
    await expect(progreso.locator("figcaption")).toHaveText(
      "Tu % en cada variable, semana a semana",
    );
    const notas = progreso.locator("[data-grafico=lineas] li[data-clase=ER-A]");
    await expect(notas.getByRole("img")).toHaveAttribute(
      "aria-label",
      "Notas por semana: 70 %, 80 %, 95 %.",
    );
    // La tabla equivalente sigue visible debajo.
    await expect(
      page.getByRole("table", { name: "Calificación por variable por semana" }),
    ).toBeVisible();

    const errores = page.locator("[data-figura=errores]");
    await expect(errores.locator("li[data-clase=ER-B]")).toContainText("En 3 de 3 intentos");
    await expect(errores.locator("li[data-clase=ER-A]")).toContainText("En 2 de 3 intentos");
    await errores.locator("summary").click();
    await expect(errores.getByRole("table")).toContainText("Ritmo");
    await expect(page.locator("main")).not.toContainText(SIN_RANKING);
    await sinErroresGraves(page);
  });

  test("PU-graficos-03: Mi grupo muestra el mapa de calor y la tendencia por estudiante, en orden alfabético", async ({
    page,
  }) => {
    await entrar(page, par.docente, CLAVE_NUEVA);
    await page.goto("/mi-grupo");
    const fila = page.locator(`[data-figura=mapa-calor] tr[data-estudiante="${par.estudianteId}"]`);
    await expect(fila.locator("[data-clase=ER-B]")).toHaveClass(/calor-4/);
    await expect(fila.locator("[data-clase=ER-B]")).toContainText("En 3 de 3");
    await expect(page.getByLabel("Leyenda del mapa de calor")).toBeVisible();

    const tendencia = page.locator(`[data-tendencia="${par.estudianteId}"]`);
    await expect(tendencia.locator("li[data-clase=ER-A]").getByRole("img")).toHaveAttribute(
      "aria-label",
      "Notas por semana: 70 %, 80 %, 95 %.",
    );
    // Las tarjetas siguen el orden de la tabla (alfabético, el de la API).
    const enTabla = await page
      .locator("[data-figura=mapa-calor] tr[data-estudiante]")
      .evaluateAll((f) => f.map((e) => e.getAttribute("data-estudiante")));
    const enTarjetas = await page
      .locator("[data-tendencia]")
      .evaluateAll((f) => f.map((e) => e.getAttribute("data-tendencia")));
    expect(enTarjetas).toEqual(enTabla);
    await expect(page.locator("main")).not.toContainText(SIN_POSICIONES);
    await sinErroresGraves(page);
  });

  test("PU-graficos-04: la ficha del estudiante muestra sus errores en barras y la tendencia de cada variable", async ({
    page,
  }) => {
    await entrar(page, par.docente, CLAVE_NUEVA);
    await page.goto(`/estudiantes/${par.estudianteId}`);
    const ficha = page.locator("section[aria-labelledby=ficha-progreso]");
    await expect(ficha.locator("[data-figura=errores] li[data-clase=ER-B]")).toContainText(
      "En 3 de 3 intentos",
    );
    await expect(
      ficha.locator("[data-figura=tendencia] li[data-clase=ER-A]").getByRole("img"),
    ).toHaveAttribute("aria-label", "Notas por semana: 70 %, 80 %, 95 %.");
    await ficha.locator("[data-figura=tendencia] summary").click();
    await expect(ficha.locator("[data-figura=tendencia]").getByRole("table")).toContainText("95 %");
    await sinErroresGraves(page);
  });

  test("PU-graficos-05: los paneles muestran minigráficos de tendencia con su texto alternativo", async ({
    page,
  }) => {
    await entrar(page, par.estudiante, CLAVE_NUEVA);
    await page.goto("/inicio");
    const semana = page.locator("[data-resumen=semana] [data-grafico=mini]");
    await expect(semana.getByRole("img")).toHaveAttribute(
      "aria-label",
      /^Tus intentos por semana, últimas 8 semanas: (\d+, ){7}\d+\.$/,
    );
    await expect(semana.locator("table caption")).toHaveText(/Tus intentos por semana/);
    await sinErroresGraves(page);

    await page.context().clearCookies();
    await entrar(page, par.docente, CLAVE_NUEVA);
    await page.goto("/inicio");
    const grupo = page.locator("[data-resumen=con-intentos] [data-grafico=mini]");
    await expect(grupo.getByRole("img")).toHaveAttribute(
      "aria-label",
      /^Intentos del grupo por semana, últimas 8 semanas: .*1, 1, 1\.$/,
    );
    await sinErroresGraves(page);
  });
});

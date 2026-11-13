import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, entrar, parDocenteEstudiante, sesionApi } from "./ayuda.ts";

const CSRF = { "x-skilltrack-csrf": "1" };
const SIN_RANKING = /ranking|puesto|posición|puntaje|estrella|★|mejor estudiante|peor/i;

/** Intento libre v2 evaluado, con su calificación y los indicadores que detectó la regla. */
function intento(horasAtras: number, calificacion: unknown[], indicadores: string[]) {
  return {
    version: 2,
    client_uuid: randomUUID(),
    version_ejercicio_id: 1,
    tarea_id: null,
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
    iniciado_en: new Date(Date.now() - horasAtras * 3_600_000).toISOString(),
    duracion_ms: 9000,
    pct_eventos_evaluables: 90,
    pct_digitacion_correcta: null,
    tempo_medido_bpm: 63.4,
    referencia_temporal: "tempo_elegido",
    cambio_tempo_pct: 1,
    audio_sin_procesar: true,
    eventos: [],
    calificacion,
    indicadores_deficientes: indicadores,
  };
}

const notas = (pct: number) => [{ clase: "ER-A", nivel: "en-desarrollo", pct }];

test.describe("tableros descriptivos (HU-15)", () => {
  let par: Awaited<ReturnType<typeof parDocenteEstudiante>>;

  test.beforeAll(async () => {
    par = await parDocenteEstudiante();
    const api = await sesionApi(par.estudiante, CLAVE_NUEVA);
    // Hace dos semanas y en las últimas horas: la semana actual baja en Notas (90 → 70).
    for (const datos of [
      intento(14 * 24, notas(90), ["IND-B2"]),
      intento(2, notas(80), ["IND-B2", "IND-C1"]),
      intento(1, notas(60), []),
    ]) {
      const r = await api.post("/api/intentos", { data: datos, headers: CSRF });
      expect(r.status(), await r.text()).toBe(201);
    }
  });

  test("PA-HU15-01: Mi progreso muestra la calificación por variable por semana del estudiante", async ({
    page,
  }) => {
    await entrar(page, par.estudiante, CLAVE_NUEVA);
    await page.getByRole("link", { name: "Mi progreso" }).click();
    const tabla = page.getByRole("table", {
      name: "Calificación por variable por semana",
    });
    const filas = tabla.locator("tbody tr");
    await expect(filas).toHaveCount(2);
    await expect(filas.nth(0).locator("[data-clase=ER-A]")).toHaveText("90 %");
    await expect(filas.nth(1).locator("[data-clase=ER-A]")).toHaveText("70 % · baja 20 puntos");
    await expect(page.locator("main")).not.toContainText(SIN_RANKING);
  });

  test("PA-HU15-02: Mi grupo muestra los errores recurrentes por clase y estudiante en los últimos N intentos, sin rankings", async ({
    page,
  }) => {
    await entrar(page, par.docente, CLAVE_NUEVA);
    await page.getByRole("link", { name: "Mi grupo" }).click();
    const fila = page.locator(`[data-estudiante="${par.estudianteId}"]`);
    await expect(fila.locator("th")).toContainText("3 intentos");
    await expect(fila.locator("[data-clase=ER-B]")).toHaveText("En 2 de 3 · Tropiezo o pausa");
    await expect(fila.locator("[data-clase=ER-C]")).toHaveText("En 1 de 3 · Dedo incorrecto");
    await expect(fila.locator("[data-clase=ER-A]")).toHaveText("—");

    await page.getByLabel("Últimos intentos").selectOption("5");
    await expect(page.getByLabel("Últimos intentos")).toHaveValue("5");
    await expect(fila.locator("[data-clase=ER-B]")).toHaveText("En 2 de 3 · Tropiezo o pausa");
    await expect(page.locator("main")).not.toContainText(
      /puesto|posición|puntaje|estrella|★|mejor estudiante|peor/i,
    );
  });
});

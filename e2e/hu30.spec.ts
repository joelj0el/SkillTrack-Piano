import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante, sesionApi } from "./ayuda.ts";

const CSRF = { "x-skilltrack-csrf": "1" };

/** Intento v2 como lo envía la app, con su calificación y los indicadores que detectó. */
function intento(tareaId: number, cambios: Record<string, unknown>) {
  return {
    version: 2,
    client_uuid: randomUUID(),
    version_ejercicio_id: 1,
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
    iniciado_en: new Date().toISOString(),
    duracion_ms: 9000,
    pct_eventos_evaluables: 90,
    pct_digitacion_correcta: null,
    tempo_medido_bpm: 63.4,
    referencia_temporal: "tempo_elegido",
    cambio_tempo_pct: 1,
    audio_sin_procesar: true,
    eventos: [],
    ...cambios,
  };
}

test("PA-HU30-02: por tarea, el docente ve fecha, tempo, metrónomo, calificación por variable e indicadores deficientes de cada intento", async ({
  page,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId);
  const api = await sesionApi(estudiante, CLAVE_NUEVA);
  for (const datos of [
    intento(tareaId, {
      iniciado_en: new Date(Date.now() - 3_600_000).toISOString(),
      calificacion: [
        { clase: "ER-A", nivel: "logrado", pct: 95 },
        { clase: "ER-B", nivel: "por-mejorar", pct: 60 },
        { clase: "ER-E", nivel: "no-evaluado", pct: null },
      ],
      indicadores_deficientes: ["IND-B2"],
    }),
    intento(tareaId, {
      estado: "no_evaluable",
      motivo_no_evaluable: "Ejecución incompleta",
      modo_metronomo: "sin",
      tempo_medido_bpm: null,
      referencia_temporal: null,
    }),
  ]) {
    const r = await api.post("/api/intentos", { data: datos, headers: CSRF });
    expect(r.status(), await r.text()).toBe(201);
  }

  await entrar(page, docente, CLAVE_NUEVA);
  await page.goto(`/estudiantes/${estudianteId}`);
  const tarjeta = page.locator(`[data-tarea="${tareaId}"]`);
  await tarjeta.getByText("Intentos (2)").click();
  const filas = tarjeta
    .getByRole("table", { name: `Intentos de la tarea ${tareaId}` })
    .locator("tbody tr");
  await expect(filas).toHaveCount(2);

  // Del más reciente al más antiguo.
  const [incompleto, evaluado] = [filas.nth(0), filas.nth(1)];
  await expect(incompleto).toContainText("No evaluable: Ejecución incompleta");
  await expect(incompleto).toContainText("Sin metrónomo");
  await expect(evaluado).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
  await expect(evaluado).toContainText("♩ elegido = 64 · medido ≈ 63");
  await expect(evaluado).toContainText("Con metrónomo");
  await expect(evaluado.locator("[data-variable=ER-A]")).toHaveText("Notas: Logrado (95 %)");
  await expect(evaluado.locator("[data-variable=ER-B]")).toHaveText("Ritmo: Por mejorar (60 %)");
  await expect(evaluado.locator("[data-variable=ER-E]")).toHaveText(
    "Curvatura de los dedos: No evaluado",
  );
  await expect(evaluado.locator("[data-indicador]")).toHaveText(["Tropiezo o pausa"]);
});

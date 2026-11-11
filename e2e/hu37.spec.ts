import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante, sesionApi } from "./ayuda.ts";

const CSRF = { "x-skilltrack-csrf": "1" };

/** Intento v2 evaluado con el tempo medido indicado, como lo envía la app. */
function intento(tareaId: number, tempoMedido: number, tempoElegido = 60) {
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
    modo_metronomo: "sin",
    tempo_elegido_bpm: tempoElegido,
    estado: "evaluado",
    motivo_no_evaluable: null,
    iniciado_en: new Date().toISOString(),
    duracion_ms: 9000,
    pct_eventos_evaluables: 90,
    pct_digitacion_correcta: null,
    secuencia_esperada: "provisional",
    tempo_medido_bpm: tempoMedido,
    referencia_temporal: "tempo_inicial",
    cambio_tempo_pct: 1,
    audio_sin_procesar: true,
    eventos: [],
  };
}

/** Cada intento: [tempo medido, tempo elegido]; elegir menos que el mínimo es práctica lenta. */
async function practicar(estudiante: string, tareaId: number, tempos: [number, number?][]) {
  const api = await sesionApi(estudiante, CLAVE_NUEVA);
  for (const [medido, elegido] of tempos) {
    const datos = intento(tareaId, medido, elegido);
    const r = await api.post("/api/intentos", { data: datos, headers: CSRF });
    expect(r.status(), await r.text()).toBe(201);
  }
}

test("PA-HU37-01: con 2 intentos válidos hoy la tarea muestra 2 de 3 y la lista con fecha y hora", async ({
  page,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId);
  await practicar(estudiante, tareaId, [[64], [62], [55]]);

  await entrar(page, estudiante, CLAVE_NUEVA);
  await page.getByRole("link", { name: /EJ-01/ }).click();
  await expect(page.getByText("2 de 3 hoy")).toBeVisible();
  const intentos = page.getByRole("list", { name: "Intentos" }).getByRole("listitem");
  await expect(intentos).toHaveCount(3);
  for (const i of await intentos.all()) {
    await expect(i).toContainText(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
  }
  await expect(page.getByText(/No cuenta: Tocaste a ♩≈55; tu tarea pide 60–70/)).toBeVisible();
});

test("PA-HU37-03: el docente ve por día las repeticiones válidas frente a la meta y cada intento", async ({
  page,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId);
  await practicar(estudiante, tareaId, [[64], [45, 45]]);

  await entrar(page, docente, CLAVE_NUEVA);
  await page.getByRole("link", { name: new RegExp(`Persona ${estudiante}`) }).click();
  await page.getByText("Avance: 1 de 3 hoy").click();
  const tabla = page.getByRole("table", { name: `Avance por día de la tarea ${tareaId}` });
  await expect(tabla.getByRole("row")).toHaveCount(2); // encabezado + hoy (asignada hoy)
  await expect(tabla).toContainText("1 de 3");
  const tarjeta = page.locator(`[data-tarea="${tareaId}"]`);
  await expect(tarjeta.getByRole("list", { name: "Intentos" }).getByRole("listitem")).toHaveCount(
    2,
  );
  // La práctica lenta aparece en la lista del docente, con su motivo.
  await expect(tarjeta.getByText("No cuenta: Práctica lenta")).toBeVisible();
});

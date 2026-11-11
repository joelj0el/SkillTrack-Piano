import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante, sesionApi } from "./ayuda.ts";
import { escena, intentoCompleto, simularDispositivos } from "./intento-simulado.ts";

test.use({
  launchOptions: {
    args: ["--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
  },
});

test("PA-HU10-05: tocar fuera del rango de la tarea se informa en el resultado y no cuenta", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  // La tarea pide ♩ = 60–70; la escala suena a ♩ = 57.
  const tareaId = await crearTareaApi(docente, estudianteId, { manos: "juntas" });
  await page.context().grantPermissions(["camera", "microphone"]);
  await simularDispositivos(page, escena(57));
  await entrar(page, estudiante, CLAVE_NUEVA);

  const cuerpo = await intentoCompleto(page, tareaId);

  expect(cuerpo.estado).toBe("evaluado");
  expect(Math.round(cuerpo.tempo_medido_bpm as number)).toBe(57);
  await expect(
    page.getByText("Tocaste a ♩≈57; tu tarea pide 60–70. Este intento no cuenta para la tarea."),
  ).toBeVisible();

  const api = await sesionApi(estudiante, CLAVE_NUEVA);
  const avance = await (await api.get(`/api/tareas/${tareaId}/avance`)).json();
  expect(avance.validas_hoy).toBe(0);
  expect(avance.intentos[0]).toMatchObject({
    cuenta_para_tarea: false,
    motivo_no_cuenta: "Tocaste a ♩≈57; tu tarea pide 60–70",
  });
});

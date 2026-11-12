import { expect, test, type Page } from "@playwright/test";
import {
  CLAVE_NUEVA,
  crearTareaApi,
  enDias,
  entrar,
  fechaLegible,
  parDocenteEstudiante,
} from "./ayuda.ts";

async function valorar(page: Page, tareaId: number, valor: "Lograda" | "Por repetir") {
  const tarjeta = page.locator(`[data-tarea="${tareaId}"]`);
  const form = tarjeta.getByRole("form", {
    name: `Valoración de la tarea ${tareaId}`,
  });
  // Tras guardar, la ficha se recarga: el desplegable puede seguir abierto o no.
  if (!(await form.isVisible())) await tarjeta.getByText("Valorar la tarea").click();
  await form.getByLabel("Valoración").selectOption({ label: valor });
  return form;
}

test("PA-HU38-01: el docente marca Por repetir con observación y plazo nuevo, luego Lograda; el estudiante ve la valoración", async ({
  page,
  browser,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId);
  await entrar(page, docente, CLAVE_NUEVA);
  await page.goto(`/estudiantes/${estudianteId}`);
  const tarjeta = page.locator(`[data-tarea="${tareaId}"]`);
  const estado = tarjeta.locator("[data-estado]");
  await expect(estado).toHaveText("Asignada");

  // Por repetir: sin observación el formulario no se envía.
  let form = await valorar(page, tareaId, "Por repetir");
  await form.getByRole("button", { name: "Guardar valoración" }).click();
  await expect(estado).toHaveText("Asignada");
  await form.getByLabel("Aspecto a repetir").selectOption({ index: 1 });
  const aspecto = await form
    .getByLabel("Aspecto a repetir")
    .evaluate((s: HTMLSelectElement) => s.selectedOptions[0]!.text);
  await form.getByLabel("Observación").fill("Repite la bajada cuidando el pulso");
  const plazo = enDias(10);
  await form.getByLabel("Plazo nuevo (opcional)").fill(plazo);
  await form.getByRole("button", { name: "Guardar valoración" }).click();
  await expect(estado).toHaveText("En práctica");
  await expect(tarjeta).toContainText(`Plazo: ${fechaLegible(plazo)}`);
  await expect(tarjeta.locator("[data-valoracion=por_repetir]")).toBeVisible();
  await expect(tarjeta).toContainText("Repite la bajada cuidando el pulso");

  // Lograda: la tarea queda Revisada.
  form = await valorar(page, tareaId, "Lograda");
  await form.getByRole("button", { name: "Guardar valoración" }).click();
  await expect(estado).toHaveText("Revisada");

  const contexto = await browser.newContext({
    baseURL: process.env.E2E_URL ?? "https://localhost",
    ignoreHTTPSErrors: true,
  });
  const delEstudiante = await contexto.newPage();
  await entrar(delEstudiante, estudiante, CLAVE_NUEVA);
  await delEstudiante.goto("/tareas");
  const suya = delEstudiante.getByRole("link", { name: /EJ-01/ });
  await expect(suya.locator("[data-estado]")).toHaveText("Revisada");
  await expect(suya.locator("[data-valoracion=lograda]")).toContainText(
    "Valoración del docente: Lograda",
  );
  await suya.click();
  await expect(delEstudiante.getByRole("list", { name: "Observaciones" })).toContainText(aspecto);
  await contexto.close();
});

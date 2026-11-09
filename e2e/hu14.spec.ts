import { expect, test } from "@playwright/test";
import {
  CLAVE_NUEVA,
  crearTareaApi,
  enDias,
  entrar,
  fechaLegible,
  parDocenteEstudiante,
} from "./ayuda.ts";

test("PA-HU14-01: la tarea asignada aparece en Mis tareas del estudiante con sus 5 datos", async ({
  page,
}) => {
  const { docente, estudiante } = await parDocenteEstudiante();
  const plazo = enDias(7);

  await entrar(page, docente, CLAVE_NUEVA);
  await page.getByRole("link", { name: new RegExp(`Persona ${estudiante}`) }).click();
  const formulario = page.getByRole("form", { name: "Asignar tarea" });
  await formulario.getByLabel("Ejercicio").selectOption({ label: "EJ-01 · Escala de Do mayor" });
  await formulario.getByLabel("Manos").selectOption("juntas");
  await formulario.getByLabel("Tempo mínimo").fill("60");
  await formulario.getByLabel("Tempo máximo").fill("70");
  await formulario.getByLabel("Plazo").fill(plazo);
  await formulario.getByLabel("Repeticiones por día").fill("3");
  await formulario.getByRole("button", { name: "Asignar tarea" }).click();
  await expect(page.locator("[data-tarea]")).toHaveCount(1);

  await page.getByRole("button", { name: "Salir" }).click();
  await entrar(page, estudiante, CLAVE_NUEVA);
  const tarjeta = page.getByRole("link", { name: /EJ-01/ });
  await expect(tarjeta).toContainText("Manos juntas");
  await expect(tarjeta).toContainText("♩ = 60–70");
  await expect(tarjeta).toContainText(`Plazo: ${fechaLegible(plazo)}`);
  await expect(tarjeta).toContainText("Repeticiones por día: 3");
  await expect(tarjeta).toContainText("Asignada");
});

test("PA-HU14-04: la observación con aspecto llega al estudiante con fecha, aspecto y texto", async ({
  page,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId);

  await entrar(page, docente, CLAVE_NUEVA);
  await page.goto(`/estudiantes/${estudianteId}`);
  const formulario = page.getByRole("form", { name: `Observación para la tarea ${tareaId}` });
  const texto = formulario.getByLabel("Sugerencia");
  await expect(texto).toHaveAttribute("placeholder", "Mejora…, tratando de…, para que…");
  await expect(texto).toHaveAttribute("maxlength", "1000");
  await formulario.getByLabel("Aspecto (opcional)").selectOption({ label: "Desfase rítmico" });
  await texto.fill("Mejora el pulso, tratando de contar en voz alta, para que no aceleres.");
  await formulario.getByRole("button", { name: "Registrar observación" }).click();
  await expect(page.getByText("Mejora el pulso")).toBeVisible();

  await page.getByRole("button", { name: "Salir" }).click();
  await entrar(page, estudiante, CLAVE_NUEVA);
  await page.getByRole("link", { name: /EJ-01/ }).click();
  const observacion = page.getByRole("list", { name: "Observaciones" }).getByRole("listitem");
  await expect(observacion).toContainText("Desfase rítmico");
  await expect(observacion).toContainText("Mejora el pulso, tratando de contar en voz alta");
  await expect(observacion).toContainText(/\d{2}\/\d{2}\/\d{4}/);
});

test("PA-HU14-05: los cambios y la cancelación de la tarea llegan al estudiante", async ({
  page,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId);
  const nuevoPlazo = enDias(10);

  await entrar(page, docente, CLAVE_NUEVA);
  await page.goto(`/estudiantes/${estudianteId}`);
  await page.getByText("Cambiar o cancelar").click();
  const cambio = page.getByRole("form", { name: `Cambiar la tarea ${tareaId}` });
  await cambio.getByLabel("Tempo mínimo").fill("65");
  await cambio.getByLabel("Tempo máximo").fill("75");
  await cambio.getByLabel("Repeticiones por día").fill("5");
  await cambio.getByLabel("Plazo").fill(nuevoPlazo);
  await cambio.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.locator(`[data-tarea="${tareaId}"]`)).toContainText("♩ = 65–75");

  await page.getByRole("button", { name: "Salir" }).click();
  await entrar(page, estudiante, CLAVE_NUEVA);
  const pendientes = page.getByRole("region", { name: "Pendientes" });
  await expect(pendientes).toContainText("♩ = 65–75");
  await expect(pendientes).toContainText("Repeticiones por día: 5");
  await expect(pendientes).toContainText(fechaLegible(nuevoPlazo));

  await page.getByRole("button", { name: "Salir" }).click();
  await entrar(page, docente, CLAVE_NUEVA);
  await page.goto(`/estudiantes/${estudianteId}`);
  await page.getByText("Cambiar o cancelar").click();
  await page.getByRole("button", { name: "Cancelar tarea" }).click();
  await expect(page.locator(`[data-tarea="${tareaId}"]`)).toContainText("Cancelada");

  await page.getByRole("button", { name: "Salir" }).click();
  await entrar(page, estudiante, CLAVE_NUEVA);
  await expect(page.getByRole("region", { name: "Pendientes" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Canceladas" })).toContainText("Cancelada");
});

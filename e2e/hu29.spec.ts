import { expect, test } from "@playwright/test";
import {
  Admin,
  CLAVE_NUEVA,
  crearTareaApi,
  enDias,
  entrar,
  fechaLegible,
  parDocenteEstudiante,
  sesionApi,
  unico,
} from "./ayuda.ts";

test("PA-HU29-01: tres tareas ordenadas por plazo, cada una con sus datos y estado", async ({
  page,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const plazos = [enDias(9), enDias(2), enDias(5)];
  for (const plazo of plazos) await crearTareaApi(docente, estudianteId, { fecha_limite: plazo });

  await entrar(page, estudiante, CLAVE_NUEVA);
  const tarjetas = page.getByRole("region", { name: "Pendientes" }).getByRole("link");
  await expect(tarjetas).toHaveCount(3);
  const ordenados = [...plazos].sort();
  for (const [i, plazo] of ordenados.entries()) {
    const t = tarjetas.nth(i);
    await expect(t).toContainText(`Plazo: ${fechaLegible(plazo)}`);
    await expect(t).toContainText("EJ-01");
    await expect(t).toContainText("Manos juntas");
    await expect(t).toContainText("♩ = 60–70");
    await expect(t).toContainText("Repeticiones por día: 3");
    await expect(t).toContainText("Asignada");
  }
});

test("PA-HU29-02: observaciones de la más reciente a la más antigua, a un toque de Mis tareas", async ({
  page,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId);
  const api = await sesionApi(docente, CLAVE_NUEVA);
  for (const texto of ["Primera sugerencia", "Segunda sugerencia", "Tercera sugerencia"]) {
    await api.post("/api/observaciones", {
      data: { tarea_id: tareaId, texto },
      headers: { "x-skilltrack-csrf": "1" },
    });
  }

  await entrar(page, estudiante, CLAVE_NUEVA);
  await expect(page.getByRole("heading", { name: "Mis tareas" })).toBeVisible();
  await page.getByRole("link", { name: /EJ-01/ }).click(); // toque 1
  const items = page.getByRole("list", { name: "Observaciones" }).getByRole("listitem");
  await expect(items).toHaveCount(3);
  await expect(items.nth(0)).toContainText("Tercera sugerencia");
  await expect(items.nth(2)).toContainText("Primera sugerencia");
});

test("PA-HU29-04: sin tareas, Mis tareas explica el estado vacío y ofrece el catálogo", async ({
  page,
}) => {
  const admin = await Admin.demo();
  const estudiante = unico("vacio");
  await admin.crearListo(estudiante, "estudiante");

  await entrar(page, estudiante, CLAVE_NUEVA);
  await expect(page.getByText("Tu docente aún no te asignó tareas")).toBeVisible();
  await page.getByRole("link", { name: "Ver el catálogo de ejercicios" }).click();
  await expect(page.getByRole("heading", { name: "Catálogo de ejercicios" })).toBeVisible();
});

import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante } from "./ayuda.ts";

// PA-HU02-04 no se marca como cumplido: la partitura y la digitación aún no están transcritas.
// Esta prueba verifica lo que sí existe: la navegación en ≤ 2 toques, el tempo y la guía.
test("PU-web-10: el detalle del ejercicio se alcanza en 2 toques desde Mis tareas", async ({
  page,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  await crearTareaApi(docente, estudianteId);

  await entrar(page, estudiante, CLAVE_NUEVA);
  await page.getByRole("link", { name: /EJ-01/ }).click(); // toque 1
  await page.getByRole("link", { name: "Ver el ejercicio" }).click(); // toque 2

  await expect(page.getByRole("heading", { level: 1, name: "Escala de Do mayor" })).toBeVisible();
  await expect(page.getByText(/♩ = 60 y ♩ = 75/)).toBeVisible();
  for (const apartado of ["Muñeca", "Separación entre dedos", "Curvatura"]) {
    await expect(page.getByRole("heading", { name: apartado })).toBeVisible();
  }
  await expect(page.locator("[data-pendiente=partitura]")).toBeVisible();
});

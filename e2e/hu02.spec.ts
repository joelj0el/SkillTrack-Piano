import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante } from "./ayuda.ts";

// La partitura de PRUEBA SINTÉTICA (escala de Do, 2 octavas por mano), ya importada por la
// API: la base de la E2E no tiene cargadas las partituras reales del panel.
const PRUEBA = JSON.parse(
  readFileSync(
    new URL("../tools/catalogo/fixtures/PRUEBA-escala-do.json", import.meta.url),
    "utf8",
  ),
);

// Sin service worker: la respuesta del catálogo se reemplaza en la red de la página.
test.use({ serviceWorkers: "block" });

test("PA-HU02-04: el detalle muestra partitura, digitación, tempo y guía, a 2 toques de Mis tareas", async ({
  page,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  await crearTareaApi(docente, estudianteId);
  await page.route("**/api/catalogo/ejercicios/EJ-01", async (ruta) => {
    const respuesta = await ruta.fetch();
    const ejercicio = await respuesta.json();
    ejercicio.version_vigente = {
      ...ejercicio.version_vigente,
      ...PRUEBA,
      transcripcion: "importada",
    };
    await ruta.fulfill({ response: respuesta, json: ejercicio });
  });

  await entrar(page, estudiante, CLAVE_NUEVA);
  await page.getByRole("link", { name: /EJ-01/ }).click(); // toque 1
  await page.getByRole("link", { name: "Ver el ejercicio" }).click(); // toque 2

  await expect(page.getByRole("heading", { level: 1, name: "Escala de Do mayor" })).toBeVisible();
  const partitura = page.getByRole("img", {
    name: /Partitura de Escala de Do mayor/,
  });
  await expect(partitura.locator(":scope > svg")).toBeVisible();
  await expect(partitura.locator("g.note")).toHaveCount(58);

  const derecha = page.getByRole("region", {
    name: "Digitación de la mano derecha",
  });
  const izquierda = page.getByRole("region", {
    name: "Digitación de la mano izquierda",
  });
  await expect(derecha.getByRole("listitem")).toHaveCount(29);
  await expect(izquierda.getByRole("listitem")).toHaveCount(29);
  await expect(derecha.getByRole("listitem").first()).toHaveText("Do4, dedo 1");

  await expect(page.getByText(/♩ = 60 y ♩ = 75/)).toBeVisible();
  for (const apartado of ["Muñeca", "Separación entre dedos", "Curvatura"]) {
    await expect(page.getByRole("heading", { name: apartado })).toBeVisible();
  }
  await expect(page.getByText("Pendiente de aprobación del panel.")).toHaveCount(3);
  await expect(page.locator("[data-ilustracion=pendiente]")).toHaveCount(3);
});

test("PU-web-10: sin partitura importada, el detalle lo dice en lugar de mostrar una vacía", async ({
  page,
}) => {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  await crearTareaApi(docente, estudianteId);

  await entrar(page, estudiante, CLAVE_NUEVA);
  await page.getByRole("link", { name: /EJ-01/ }).click();
  await page.getByRole("link", { name: "Ver el ejercicio" }).click();

  await expect(page.locator("[data-pendiente=partitura]")).toBeVisible();
  await expect(page.locator("[data-pendiente=digitacion]")).toBeVisible();
});

import { expect, test, type Page, type Request } from "@playwright/test";
import { publicarArtefactos } from "./artefactos.ts";
import { CLAVE_DEMO, entrar } from "./ayuda.ts";

// Un detector o un modelo de aprendizaje automático se reconocería por estos archivos.
const MODELOS = /\/mediapipe\/|\.task(\?|$)|\.tflite|\.onnx|\.wasm|tasks-vision|PaginaPractica/i;

async function abrirHerramienta(page: Page): Promise<Request[]> {
  await publicarArtefactos();
  const peticiones: Request[] = [];
  // Solo lo que pide la página: la precarga del service worker descarga assets sin ejecutarlos.
  page.on("request", (r) => peticiones.push(r));
  await entrar(page, "investigador.demo", CLAVE_DEMO);
  await page.goto("/investigacion");
  await expect(page.getByRole("heading", { name: "Revisión de bandas y reglas" })).toBeVisible();
  await expect(page.locator("[data-modo]")).toBeVisible();
  return peticiones;
}

async function enModo(page: Page, modo: "V" | "A" | "VA") {
  await page.getByLabel("Modo").selectOption(modo);
  await expect(page.locator("[data-modo]")).toHaveAttribute("data-modo", modo);
  const diagnosticos = await page
    .getByRole("table", { name: "Diagnósticos" })
    .locator("tr[data-regla]")
    .evaluateAll((filas) =>
      filas.map((f) => [f.getAttribute("data-regla"), f.querySelectorAll("td")[3]!.textContent]),
    );
  const indicadores = await page
    .getByRole("table", { name: "Indicadores" })
    .locator("tr[data-indicador]")
    .evaluateAll((filas) =>
      Object.fromEntries(
        filas.map((f) => [
          f.getAttribute("data-indicador"),
          {
            estado: f.getAttribute("data-estado"),
            motivo: f.querySelectorAll("td")[2]!.textContent,
          },
        ]),
      ),
    );
  return { diagnosticos, indicadores };
}

test("PA-HU23-02: la herramienta del investigador muestra qué regla disparó cada diagnóstico y con qué eventos", async ({
  page,
}) => {
  await abrirHerramienta(page);
  const { diagnosticos, indicadores } = await enModo(page, "VA");
  expect(diagnosticos).toEqual([
    ["R-A1-01", "2"],
    ["R-B2-01", "4"],
    ["R-B3-02", "7"],
    ["R-C1-01", "5"],
    ["R-D2-01", "6"],
  ]);
  expect(indicadores["IND-B1"]!.estado).toBe("sin-error");
  expect(indicadores["IND-E1"]!.estado).toBe("no-evaluable");
  expect(indicadores["IND-E1"]!.motivo).toMatch(/^No evaluable por diseño/);
});

test("PA-HU24-01: el mismo intento en V, A y VA solo difiere en los indicadores de la modalidad excluida y registra el modo", async ({
  page,
}) => {
  await abrirHerramienta(page);
  const va = await enModo(page, "VA");
  for (const modo of ["V", "A"] as const) {
    const r = await enModo(page, modo);
    for (const [codigo, estado] of Object.entries(r.indicadores)) {
      const igual = JSON.stringify(estado) === JSON.stringify(va.indicadores[codigo]);
      if (!igual)
        expect(estado, codigo).toEqual({
          estado: "no-evaluable",
          motivo: `No se evalúa en modo ${modo}`,
        });
    }
    // Cada diagnóstico del modo reducido también está en VA, con los mismos eventos.
    for (const d of r.diagnosticos) expect(va.diagnosticos).toContainEqual(d);
    expect(r.diagnosticos.length).toBeLessThan(va.diagnosticos.length);
  }
});

test("PA-HU06-02: diagnosticar no descarga ni carga ningún modelo de aprendizaje automático", async ({
  page,
}) => {
  const peticiones = await abrirHerramienta(page);
  for (const modo of ["VA", "V", "A"] as const) await enModo(page, modo);
  expect(peticiones.length).toBeGreaterThan(0);
  expect(peticiones.map((r) => r.url()).filter((u) => MODELOS.test(u))).toEqual([]);
});

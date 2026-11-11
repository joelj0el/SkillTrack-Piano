import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante } from "./ayuda.ts";
import {
  escena,
  intentoCompleto,
  registrarPeticiones,
  simularDispositivos,
  verificarPrivacidad,
} from "./intento-simulado.ts";

test.use({
  launchOptions: {
    args: ["--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
  },
});

interface Evento {
  idx: number;
  ataque_ms: number | null;
  modalidad: string | null;
  nota: { estado: string; modalidad: string | null };
  dedo: { valor: number | null; modalidad: string | null };
  tecla: { midi: number | null; zona: number | null; modalidad: string | null };
  desfase_manos: { estado: string; modalidad: string | null } | null;
  rasgos: Record<string, number>;
  rasgos_modalidad: string | null;
}

async function practicarJuntas(page: import("@playwright/test").Page) {
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId, { manos: "juntas" });
  await page.context().grantPermissions(["camera", "microphone"]);
  // La escala más larga del repertorio: 2 octavas a manos juntas (29 instantes, 58 eventos).
  await simularDispositivos(page, escena(57));
  await entrar(page, estudiante, CLAVE_NUEVA);
  const peticiones = await registrarPeticiones(page);
  const cuerpo = await intentoCompleto(page, tareaId);
  return { cuerpo, peticiones, eventos: cuerpo.eventos as Evento[] };
}

test("PA-HU11-02: cada evento esperado tiene un registro fusionado con la modalidad de cada dato", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { cuerpo, eventos } = await practicarJuntas(page);

  expect(cuerpo.modo).toBe("VA");
  expect(eventos.map((e) => e.idx)).toEqual(Array.from({ length: 58 }, (_, i) => i));
  for (const e of eventos) {
    expect(e.nota.estado).toBe("correcta");
    expect(["A", "VA"]).toContain(e.nota.modalidad);
    expect(e.ataque_ms).not.toBeNull();
    // Lo que sale de la visión se marca V; sin dato, la modalidad queda en null.
    expect(e.dedo.modalidad).toBe(e.dedo.valor === null ? null : "V");
    expect(e.tecla.modalidad).toBe(e.tecla.midi === null ? null : "V");
    expect(e.rasgos_modalidad).toBe(Object.keys(e.rasgos).length ? "V" : null);
    expect(e.desfase_manos?.estado).toBe("a-tiempo");
  }
  // Hay fusión, y todo evento fusionado trae el dedo y la tecla que vio la cámara.
  const fusionados = eventos.filter((e) => e.nota.modalidad === "VA");
  expect(fusionados.length).toBeGreaterThan(0);
  expect(fusionados.every((e) => e.dedo.valor === 2 && e.tecla.zona !== null)).toBe(true);
});

test("PA-HU11-05: un intento completo con audio no envía medios ni a otro origen, y sus eventos ocupan ≤ 256 KB", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { cuerpo, peticiones } = await practicarJuntas(page);

  await verificarPrivacidad(page, peticiones);
  expect(Buffer.byteLength(JSON.stringify(cuerpo.eventos))).toBeLessThanOrEqual(256 * 1024);
});

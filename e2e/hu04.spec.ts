/** HU-04: al terminar de tocar (video simulado) el análisis empieza solo, sin botón "Enviar". */
import { expect, test } from "@playwright/test";
import { publicarArtefactos } from "./artefactos.ts";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante } from "./ayuda.ts";
import { escena, intentoCompleto, simularDispositivos } from "./intento-simulado.ts";

test.use({
  locale: "es-BO",
  timezoneId: "America/La_Paz",
  reducedMotion: "reduce",
  permissions: ["camera", "microphone"],
  launchOptions: {
    args: ["--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
  },
});

/** Registra el orden de las fases, cada clic (con la fase en que ocurrió) y los botones vistos. */
function observar() {
  const registro = { fases: [] as string[], clics: [] as string[], botones: new Set<string>() };
  const fase = () =>
    [...document.querySelectorAll("[data-fase]")].map((e) => e.getAttribute("data-fase")).at(-1) ??
    "";
  new MutationObserver(() => {
    const f = fase();
    if (f && registro.fases.at(-1) !== f) registro.fases.push(f);
    for (const b of document.querySelectorAll("button")) registro.botones.add(b.textContent ?? "");
  }).observe(document, { subtree: true, childList: true, attributes: true });
  document.addEventListener("click", () => registro.clics.push(fase()), true);
  (window as unknown as { __registro: typeof registro }).__registro = registro;
}

test("PA-HU04-01: al tocar, el análisis empieza solo al terminar: Conteo → Tocando → Analizando, sin botón Enviar", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await publicarArtefactos(58);
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId);
  await page.addInitScript(observar);
  await simularDispositivos(page, escena(60));
  await entrar(page, estudiante, CLAVE_NUEVA);

  await intentoCompleto(page, tareaId);

  const registro = await page.evaluate(() => {
    const r = (
      window as unknown as {
        __registro: { fases: string[]; clics: string[]; botones: Set<string> };
      }
    ).__registro;
    return { fases: r.fases, clics: r.clics, botones: [...r.botones] };
  });
  const desde = registro.fases.indexOf("conteo");
  expect(desde, registro.fases.join(" → ")).toBeGreaterThanOrEqual(0);
  expect(registro.fases.slice(desde)).toEqual(["conteo", "tocando", "analizando", "resultado"]);
  // Desde que empieza a sonar el conteo hasta el resultado, nadie tocó la pantalla.
  expect(registro.clics.filter((f) => ["conteo", "tocando", "analizando"].includes(f))).toEqual([]);
  expect(registro.botones.filter((b) => /enviar/i.test(b))).toEqual([]);
});

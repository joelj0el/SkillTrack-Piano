import { expect, test } from "@playwright/test";
import { publicarArtefactos } from "./artefactos.ts";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante } from "./ayuda.ts";
import { escena, intentoCompleto, simularDispositivos } from "./intento-simulado.ts";
import { registrarPeticiones, verificarPrivacidad } from "./privacidad.ts";

// El micrófono simulado suena sin un gesto de la persona.
test.use({
  launchOptions: {
    args: ["--ignore-certificate-errors", "--autoplay-policy=no-user-gesture-required"],
  },
});

test("PA-HU08-04: un intento completo con cámara y micrófono no envía medios, ni cuerpos grandes, ni a otro origen", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId);
  await context.grantPermissions(["camera", "microphone"]);
  await simularDispositivos(page, escena(57));
  await entrar(page, estudiante, CLAVE_NUEVA);

  const peticiones = registrarPeticiones(page.context());
  const cuerpo = await intentoCompleto(page, tareaId);

  expect(cuerpo.version).toBe(2);
  expect(cuerpo.version_modelo_mano).toBe("simulado@e2e");
  expect(peticiones.length).toBeGreaterThan(0);
  verificarPrivacidad(peticiones, new URL(page.url()).origin);
});

test("PU-web-20: con referencia y reglas publicadas, un intento nuevo envía sus ids", async ({
  page,
  context,
}) => {
  test.setTimeout(180_000);
  const { referenciaId, reglasId } = await publicarArtefactos();
  const { docente, estudiante, estudianteId } = await parDocenteEstudiante();
  const tareaId = await crearTareaApi(docente, estudianteId);
  await context.grantPermissions(["camera", "microphone"]);
  await simularDispositivos(page, escena(57));
  await entrar(page, estudiante, CLAVE_NUEVA);

  const cuerpo = await intentoCompleto(page, tareaId);

  expect(cuerpo.referencia_id).toBe(referenciaId);
  expect(cuerpo.conjunto_reglas_id).toBe(reglasId);
});

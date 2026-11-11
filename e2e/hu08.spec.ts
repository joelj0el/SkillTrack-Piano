import { expect, test } from "@playwright/test";
import { CLAVE_NUEVA, crearTareaApi, entrar, parDocenteEstudiante } from "./ayuda.ts";
import {
  escena,
  intentoCompleto,
  registrarPeticiones,
  simularDispositivos,
  verificarPrivacidad,
} from "./intento-simulado.ts";

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

  const peticiones = await registrarPeticiones(page);
  const cuerpo = await intentoCompleto(page, tareaId);

  expect(cuerpo.version).toBe(2);
  expect(cuerpo.version_modelo_mano).toBe("simulado@e2e");
  await verificarPrivacidad(page, peticiones);
});

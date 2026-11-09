// Prepara el detector de la mano autoalojado (sin CDN en tiempo de ejecución):
// copia el WASM del paquete @mediapipe/tasks-vision y descarga el modelo con versión fija,
// verificando su SHA-256. Uso: node tools/mediapipe.mjs
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Buffer } from "node:buffer";
import { URL, fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("../", import.meta.url));
const destino = join(raiz, "apps/web/public/mediapipe");
const requerir = createRequire(join(raiz, "apps/web/package.json"));
// El paquete no exporta package.json: se ubica desde el punto de entrada.
const paquete = dirname(requerir.resolve("@mediapipe/tasks-vision"));
const { version } = JSON.parse(readFileSync(join(paquete, "package.json"), "utf8"));

// Modelo publicado por MediaPipe, versión 1 en float16 (URL con versión, no "latest").
const MODELO_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MODELO_VERSION = "hand_landmarker/float16/1";

mkdirSync(join(destino, "wasm"), { recursive: true });
for (const archivo of readdirSync(join(paquete, "wasm"))) {
  copyFileSync(join(paquete, "wasm", archivo), join(destino, "wasm", archivo));
}

const modelo = join(destino, "hand_landmarker.task");
if (!existsSync(modelo)) {
  const respuesta = await fetch(MODELO_URL);
  if (!respuesta.ok) throw new Error(`No se pudo descargar el modelo: HTTP ${respuesta.status}`);
  writeFileSync(modelo, Buffer.from(await respuesta.arrayBuffer()));
}
const sha256 = createHash("sha256").update(readFileSync(modelo)).digest("hex");
// version.json (versionado) fija el modelo: si el archivo descargado no coincide, se rechaza.
const registro = join(destino, "version.json");
if (existsSync(registro)) {
  const esperado = JSON.parse(readFileSync(registro, "utf8")).modeloSha256;
  if (esperado && esperado !== sha256) {
    throw new Error(`El modelo descargado no coincide con el registrado (${sha256} ≠ ${esperado})`);
  }
}

writeFileSync(
  registro,
  `${JSON.stringify({ tasksVision: version, modelo: MODELO_VERSION, modeloSha256: sha256 }, null, 2)}\n`,
);
console.log(`MediaPipe ${version}, modelo ${MODELO_VERSION} (sha256 ${sha256.slice(0, 12)}…)`);

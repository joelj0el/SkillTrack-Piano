// docs:build — arma build/SECCION_II.docx con pandoc a partir de docs/seccion-ii/.
// Pandoc corre en Docker con la imagen fijada: no hace falta instalarlo.
// Si existe docs/seccion-ii/reference.docx, sus estilos se aplican al documento.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const IMAGEN = "pandoc/core:3.7";
const RAIZ = resolve(import.meta.dirname, "../..");
const CARPETA = "docs/seccion-ii";

/** Lista de archivos del bloque `archivos:` de orden.yaml, en orden. */
export function leerOrden(texto) {
  const archivos = [];
  let dentro = false;
  for (const linea of texto.split(/\r?\n/)) {
    if (/^archivos:\s*$/.test(linea)) dentro = true;
    else if (dentro && /^\s+-\s+/.test(linea)) archivos.push(linea.replace(/^\s+-\s+/, "").trim());
    else if (dentro && /^\S/.test(linea)) dentro = false;
  }
  if (archivos.length === 0) throw new Error("orden.yaml no lista ningún archivo en archivos:");
  return archivos;
}

export function argumentosDocker(raiz, archivos, conReferencia) {
  return [
    "run",
    "--rm",
    "-v",
    `${raiz}:/data`,
    "-w",
    `/data/${CARPETA}`,
    IMAGEN,
    ...archivos,
    "--from=markdown",
    "--resource-path=.:/data/docs",
    ...(conReferencia ? ["--reference-doc=reference.docx"] : []),
    "--output=/data/build/SECCION_II.docx",
  ];
}

function principal() {
  const orden = resolve(RAIZ, CARPETA, "orden.yaml");
  if (!existsSync(orden)) {
    console.error(`docs:build: falta ${CARPETA}/orden.yaml`);
    return 1;
  }
  const archivos = leerOrden(readFileSync(orden, "utf8"));
  const faltan = archivos.filter((a) => !existsSync(resolve(RAIZ, CARPETA, a)));
  if (faltan.length) {
    console.error(`docs:build: no existen ${faltan.join(", ")}`);
    return 1;
  }
  const conReferencia = existsSync(resolve(RAIZ, CARPETA, "reference.docx"));
  mkdirSync(resolve(RAIZ, "build"), { recursive: true });
  const r = spawnSync("docker", argumentosDocker(RAIZ, archivos, conReferencia), {
    stdio: "inherit",
  });
  if (r.status !== 0) return r.status ?? 1;
  console.log(
    `docs:build: build/SECCION_II.docx con ${archivos.length} archivo(s)` +
      (conReferencia ? " y los estilos de reference.docx." : "; sin reference.docx todavía."),
  );
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = principal();
}

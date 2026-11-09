// Genera la planilla y los videos sintéticos de las pruebas de la ingesta (requiere Docker).
// Uso: node research/node/src/ingesta/generar-fixtures.ts
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import ExcelJS from "exceljs";

const DESTINO = resolve(import.meta.dirname, "../../fixtures/ingesta");

const VIDEOS: [nombre: string, color: string][] = [
  ["VID_20261109_175000.mp4", "white"],
  ["VID_20261109_180000.mp4", "red"],
  ["VID_20261109_180500.mp4", "green"],
  ["VID_20261109_181005.mp4", "blue"],
  ["VID_20261109_181500.mp4", "yellow"],
  ["VID_20261109_182000.mp4", "cyan"],
  ["VID_20261109_182500.mp4", "magenta"],
  ["VID_20261109_190000.mp4", "gray"],
];

const COLUMNAS = [
  "codigo_toma",
  "archivo_video",
  "hora",
  "instrumento",
  "ejercicio",
  "manos",
  "tempo",
  "repeticion",
  "evaluable",
  "origen",
  "etiquetas_1",
  "etiquetas_2",
  "compas_aprox",
  "notas",
];

const FILAS: (string | number | null)[][] = [
  [
    "CAL-digital-1",
    "VID_20261109_175000.mp4",
    "17:50",
    "digital",
    null,
    null,
    null,
    null,
    "si",
    "real",
    null,
    null,
    null,
    "Teclado vacío",
  ],
  [
    "D01-EJ01-JUN-60-R1",
    "VID_20261109_180000.mp4",
    "18:00",
    "digital",
    "EJ-01",
    "juntas",
    60,
    1,
    "si",
    "real",
    null,
    null,
    null,
    null,
  ],
  [
    "D01-EJ01-MI-60-R1-ACT",
    "VID_20261109_180500.mp4",
    "18:05",
    "digital",
    "EJ-01",
    "MI",
    60,
    1,
    "si",
    "actuado",
    "ER-A",
    null,
    "3",
    "Nota equivocada a propósito",
  ],
  [
    "E01-EJ01-JUN-60-R1",
    null,
    "18:10",
    "digital",
    "EJ-01",
    "juntas",
    60,
    1,
    "si",
    "real",
    "ER-A ER-B",
    "ER-A",
    "5",
    null,
  ],
  [
    "E01-EJ02-JUN-65-R1",
    "VID_20261109_181500.mp4",
    "18:15",
    "digital",
    "EJ-02",
    "juntas",
    65,
    1,
    "no",
    "real",
    "OK",
    null,
    null,
    "Alguien habló",
  ],
  [
    "E02-EJ01-JUN-60-R2",
    "no-existe.mp4",
    "18:17",
    "digital",
    "EJ-01",
    "juntas",
    60,
    2,
    "si",
    "real",
    null,
    null,
    null,
    null,
  ],
  [
    "E02-EJ01-JUN-60-R3",
    "VID_20261109_182000.mp4",
    "18:20",
    "guitarra",
    "EJ-01",
    "juntas",
    60,
    3,
    "si",
    "real",
    null,
    null,
    null,
    null,
  ],
  [
    "E02-EJ02-JUN-60-R1",
    "VID_20261109_182500.mp4",
    "18:25",
    "digital",
    "EJ-02",
    "juntas",
    60,
    1,
    "si",
    "real",
    "ER-Z",
    null,
    null,
    null,
  ],
];

const libro = new ExcelJS.Workbook();
const tomas = libro.addWorksheet("Tomas");
tomas.addRow(COLUMNAS);
FILAS.forEach((f) => tomas.addRow(f));
const valores = libro.addWorksheet("Valores");
valores.addRow(["instrumento", "ejercicio", "manos", "evaluable", "origen"]);
valores.addRow(["acustico", "EJ-01", "MI", "si", "real"]);
valores.addRow(["digital", "EJ-02", "MD", "no", "actuado"]);
valores.addRow(["teclado", "EJ-03", "juntas"]);
valores.addRow([null, "EJ-04"]);
await libro.xlsx.writeFile(resolve(DESTINO, "PLANILLA_TOMAS.xlsx"));

const ordenes = VIDEOS.map(
  ([nombre, color]) =>
    `ffmpeg -y -v error -f lavfi -i color=${color}:s=64x36:r=30 -f lavfi -i anullsrc=r=8000:cl=mono ` +
    `-t 1 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 8k -shortest /s/${nombre}`,
);
execFileSync(
  "docker",
  [
    "run",
    "--rm",
    "-v",
    `${DESTINO}:/s`,
    "alpine:3.22",
    "sh",
    "-c",
    `apk add --no-cache ffmpeg >/dev/null 2>&1 && ${ordenes.join(" && ")}`,
  ],
  { stdio: "inherit" },
);

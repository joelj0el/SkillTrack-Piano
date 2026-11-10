// Genera la planilla y los videos sintéticos de las pruebas de la ingesta (requiere Docker).
// Uso: node research/node/src/ingesta/generar-fixtures.ts
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import ExcelJS from "exceljs";
import { COLUMNAS_PLANILLA } from "./planilla.ts";

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

type Fila = Record<string, string | number>;

const comun: Fila = { fecha: "2026-11-09", institution: "Instituto A", instrumento: "digital" };
const docente: Fila = { ...comun, seudonimo: "D01", rol: "docente", consentimiento: "si" };
const estudiante: Fila = { ...comun, rol: "estudiante", consentimiento: "si" };

const FILAS: Fila[] = [
  {
    ...comun,
    codigo_toma: "CAL-digital-1",
    archivo_video: "VID_20261109_175000.mp4",
    hora_inicio: "17:50",
    notas: "Teclado vacío",
  },
  {
    ...docente,
    codigo_toma: "D01-EJ01-JUN-60-R1",
    archivo_video: "VID_20261109_180000.mp4",
    hora_inicio: "18:00",
    ejercicio: "EJ-01",
    manos: "juntas",
    tiempo_bpm: 60,
    repeticion: 1,
    orignen: "real",
    evaluable: "si",
  },
  {
    ...docente,
    codigo_toma: "D01-EJ01-MI-60-R1-ACT",
    archivo_video: "VID_20261109_180500.mp4",
    hora_inicio: "18:05",
    ejercicio: "EJ-01",
    manos: "MI",
    tiempo_bpm: 60,
    repeticion: 1,
    evaluable: "si",
    "compas aprox": "3",
    etiquetador_1: "D02",
    etiquetas_1: "ER-A",
    notas: "Nota equivocada a propósito",
  },
  {
    ...estudiante,
    codigo_toma: "E01-EJ01-JUN-60-R1",
    hora_inicio: "18:10",
    seudonimo: "E01",
    ejercicio: "EJ-01",
    manos: "juntas",
    tiempo_bpm: 60,
    repeticion: 1,
    orignen: "real",
    evaluable: "si",
    erroes_observados: "Notas y ritmo",
    "compas aprox": "5",
    etiquetador_1: "D02",
    etiquetas_1: "ER-A ER-B",
    etiquetador_2: "D03",
    etiquetas_2: "ER-A",
  },
  {
    ...estudiante,
    codigo_toma: "E01-EJ02-JUN-65-R1",
    archivo_video: "VID_20261109_181500.mp4",
    hora_inicio: "18:15",
    seudonimo: "E01",
    ejercicio: "EJ-02",
    manos: "juntas",
    tiempo_bpm: 65,
    repeticion: 1,
    orignen: "real",
    evaluable: "no",
    etiquetador_1: "D02",
    etiquetas_1: "OK",
    etiquetador_2: "D03",
    notas: "Alguien habló",
  },
  {
    ...estudiante,
    codigo_toma: "E02-EJ01-JUN-60-R2",
    archivo_video: "no-existe.mp4",
    hora_inicio: "18:17",
    seudonimo: "E02",
    ejercicio: "EJ-01",
    manos: "juntas",
    tiempo_bpm: 60,
    repeticion: 2,
    orignen: "real",
    evaluable: "si",
  },
  {
    ...estudiante,
    codigo_toma: "E02-EJ01-JUN-60-R3",
    archivo_video: "VID_20261109_182000.mp4",
    hora_inicio: "18:20",
    seudonimo: "E02",
    instrumento: "guitarra",
    ejercicio: "EJ-01",
    manos: "juntas",
    tiempo_bpm: 60,
    repeticion: 3,
    orignen: "real",
    evaluable: "si",
  },
  {
    ...estudiante,
    codigo_toma: "E02-EJ02-JUN-60-R1",
    archivo_video: "VID_20261109_182500.mp4",
    hora_inicio: "18:25",
    seudonimo: "E02",
    ejercicio: "EJ-02",
    manos: "juntas",
    tiempo_bpm: 60,
    repeticion: 1,
    orignen: "real",
    evaluable: "si",
    etiquetador_1: "D02",
    etiquetas_1: "ER-Z",
  },
];

const libro = new ExcelJS.Workbook();
const tomas = libro.addWorksheet("Tomas");
tomas.addRow([...COLUMNAS_PLANILLA]);
FILAS.forEach((f) => tomas.addRow(COLUMNAS_PLANILLA.map((c) => f[c] ?? null)));
const valores = libro.addWorksheet("Valores");
valores.addRow(["instrumento", "ejercicio", "manos", "evaluable", "orignen"]);
valores.addRow(["acustico", "EJ-01", "MI", "si", "real"]);
valores.addRow(["digital", "EJ-02", "MD", "no", "actuado"]);
valores.addRow(["teclado", "EJ-03", "juntas", null, "sintetico"]);
valores.addRow([null, "EJ-04"]);
await libro.xlsx.writeFile(resolve(DESTINO, "PLANILLA_TOMAS.xlsx"));

// Teclado dibujado de Do4 a Do6: 15 blancas de 40 px desde x = 20, con el borde frontal en y = 320
// y las negras desde y = 220 hasta y = 20.
const BLANCAS_CON_NEGRA = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12];
const teclado = [
  "drawbox=x=20:y=20:w=600:h=300:color=white:t=fill",
  ...Array.from(
    { length: 14 },
    (_, i) => `drawbox=x=${60 + 40 * i}:y=20:w=1:h=300:color=gray:t=fill`,
  ),
  ...BLANCAS_CON_NEGRA.map((i) => `drawbox=x=${48 + 40 * i}:y=20:w=24:h=200:color=black:t=fill`),
].join(",");
const ordenTeclado =
  `ffmpeg -y -v error -f lavfi -i color=dimgray:s=640x400:r=30,${teclado} -f lavfi ` +
  "-i anullsrc=r=8000:cl=mono -t 1 -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac " +
  "-b:a 8k -shortest /c/CAL-digital-1.mp4";

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
    "-v",
    `${resolve(DESTINO, "../calibracion")}:/c`,
    "alpine:3.22",
    "sh",
    "-c",
    `apk add --no-cache ffmpeg >/dev/null 2>&1 && ${[...ordenes, ordenTeclado].join(" && ")}`,
  ],
  { stdio: "inherit" },
);

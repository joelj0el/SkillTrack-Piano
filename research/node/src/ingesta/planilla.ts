import ExcelJS from "exceljs";

export class ErrorPlanilla extends Error {}

export interface FilaPlanilla {
  /** Número de fila en la hoja, como lo muestra Excel. */
  fila: number;
  campos: Record<string, string>;
}

export interface Planilla {
  tomas: FilaPlanilla[];
  valores: Map<string, Set<string>>;
  columnas: string[];
  /** Encabezados esperados que la hoja Tomas no trae; sus valores se tratan como vacíos. */
  columnasFaltantes: string[];
}

/** Encabezados de la planilla de las sesiones, tal como están escritos en ella. */
export const COLUMNAS_PLANILLA = [
  "codigo_toma",
  "archivo_video",
  "fecha",
  "hora_inicio",
  "seudonimo",
  "rol",
  "institution",
  "instrumento",
  "ejercicio",
  "manos",
  "tiempo_bpm",
  "repeticion",
  "orignen",
  "evaluable",
  "erroes_observados",
  "compas aprox",
  "etiquetador_1",
  "etiquetas_1",
  "etiquetador_2",
  "etiquetas_2",
  "consentimiento",
  "notas",
] as const;

const ALIAS: Record<string, string> = {
  codigo: "codigo_toma",
  hora_inicio: "hora",
  institution: "institucion",
  tiempo_bpm: "tempo",
  orignen: "origen",
  erroes_observados: "errores_observados",
  archivo: "archivo_video",
  video: "archivo_video",
  nombre_archivo: "archivo_video",
  tempo_bpm: "tempo",
  bpm: "tempo",
  rep: "repeticion",
  repeticiones: "repeticion",
  compas: "compas_aprox",
  compas_1: "compas_aprox_1",
  compas_2: "compas_aprox_2",
  metronomo: "modo_metronomo",
};

/** Minúsculas, sin acentos y con guiones bajos: compara nombres y valores escritos a mano. */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function nombreDeColumna(texto: string): string {
  const clave = normalizar(texto);
  return ALIAS[clave] ?? clave;
}

function texto(valor: ExcelJS.CellValue): string {
  if (valor === null || valor === undefined) return "";
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === "object") {
    if ("richText" in valor)
      return valor.richText
        .map((t) => t.text)
        .join("")
        .trim();
    if ("result" in valor) return texto(valor.result as ExcelJS.CellValue);
    if ("text" in valor) return String(valor.text).trim();
    return "";
  }
  return String(valor).trim();
}

/** Excel guarda la hora como fecha o como fracción de día; aquí queda como HH:MM. */
function hora(valor: string): string {
  const iso = /T(\d{2}:\d{2})/.exec(valor);
  if (iso) return iso[1]!;
  const fraccion = Number(valor);
  if (valor !== "" && Number.isFinite(fraccion) && fraccion >= 0 && fraccion < 1) {
    const minutos = Math.round(fraccion * 24 * 60);
    return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
  }
  return valor;
}

function hoja(libro: ExcelJS.Workbook, nombre: string): ExcelJS.Worksheet {
  const encontrada = libro.worksheets.find((h) => normalizar(h.name) === normalizar(nombre));
  if (!encontrada) throw new ErrorPlanilla(`La planilla no tiene la hoja "${nombre}".`);
  return encontrada;
}

function encabezado(h: ExcelJS.Worksheet): { fila: number; columnas: Map<number, string> } | null {
  for (let n = 1; n <= Math.min(10, h.rowCount); n++) {
    const columnas = new Map<number, string>();
    h.getRow(n).eachCell((celda, c) => {
      const nombre = nombreDeColumna(texto(celda.value));
      if (nombre) columnas.set(c, nombre);
    });
    if (columnas.size > 0) return { fila: n, columnas };
  }
  return null;
}

function leerTomas(h: ExcelJS.Worksheet): { tomas: FilaPlanilla[]; columnas: string[] } {
  let cabecera: { fila: number; columnas: Map<number, string> } | null = null;
  for (let n = 1; n <= Math.min(10, h.rowCount) && !cabecera; n++) {
    const columnas = new Map<number, string>();
    h.getRow(n).eachCell((celda, c) => columnas.set(c, nombreDeColumna(texto(celda.value))));
    if ([...columnas.values()].includes("codigo_toma")) cabecera = { fila: n, columnas };
  }
  if (!cabecera) throw new ErrorPlanilla('La hoja "Tomas" no tiene la columna codigo_toma.');

  const tomas: FilaPlanilla[] = [];
  for (let n = cabecera.fila + 1; n <= h.rowCount; n++) {
    const fila = h.getRow(n);
    const campos: Record<string, string> = {};
    for (const [c, nombre] of cabecera.columnas) {
      if (nombre) campos[nombre] = texto(fila.getCell(c).value);
    }
    if (Object.values(campos).every((v) => v === "")) continue;
    if (campos.hora !== undefined) campos.hora = hora(campos.hora);
    if (campos.fecha) campos.fecha = campos.fecha.slice(0, 10);
    tomas.push({ fila: n, campos });
  }
  return { tomas, columnas: [...cabecera.columnas.values()].filter(Boolean) };
}

/** Admite una columna por campo o el formato largo con las columnas "campo" y "valor". */
function leerValores(h: ExcelJS.Worksheet): Map<string, Set<string>> {
  const valores = new Map<string, Set<string>>();
  const cabecera = encabezado(h);
  if (!cabecera) return valores;
  const agregar = (campo: string, valor: string) => {
    if (!campo || !valor) return;
    if (!valores.has(campo)) valores.set(campo, new Set());
    valores.get(campo)!.add(valor);
  };
  const nombres = [...cabecera.columnas.entries()];
  const columnaCampo = nombres.find(([, n]) => n === "campo")?.[0];
  const columnaValor = nombres.find(([, n]) => n === "valor")?.[0];
  for (let n = cabecera.fila + 1; n <= h.rowCount; n++) {
    const fila = h.getRow(n);
    if (columnaCampo !== undefined && columnaValor !== undefined) {
      agregar(
        nombreDeColumna(texto(fila.getCell(columnaCampo).value)),
        texto(fila.getCell(columnaValor).value),
      );
    } else {
      for (const [c, campo] of nombres) agregar(campo, texto(fila.getCell(c).value));
    }
  }
  return valores;
}

export async function leerPlanilla(ruta: string): Promise<Planilla> {
  const libro = new ExcelJS.Workbook();
  await libro.xlsx.readFile(ruta);
  const { tomas, columnas } = leerTomas(hoja(libro, "Tomas"));
  return {
    tomas,
    columnas,
    valores: leerValores(hoja(libro, "Valores")),
    columnasFaltantes: COLUMNAS_PLANILLA.filter((c) => !columnas.includes(nombreDeColumna(c))),
  };
}

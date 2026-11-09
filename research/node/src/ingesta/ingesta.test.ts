import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { VERSION_NUCLEO } from "@skilltrack/core";
import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { asociar, type FilaParaAsociar, type VideoParaAsociar } from "./asociar.ts";
import { ingerir, type Reporte } from "./ingesta.ts";
import { leerPlanilla } from "./planilla.ts";
import type { Base } from "./registro.ts";

const FIXTURES = resolve(import.meta.dirname, "../../fixtures/ingesta");

function baseEnMemoria(): { base: Base; pg: PGlite } {
  const pg = new PGlite();
  return {
    pg,
    base: {
      consulta: (sql, parametros) => pg.query(sql, parametros) as ReturnType<Base["consulta"]>,
    },
  };
}

async function filas(pg: PGlite, sql: string): Promise<Record<string, unknown>[]> {
  return (await pg.query<Record<string, unknown>>(sql)).rows;
}

const fila = (indice: number, archivo?: string, hora?: number): FilaParaAsociar => ({
  indice,
  ...(archivo ? { archivo } : {}),
  ...(hora !== undefined ? { hora } : {}),
});
const video = (nombre: string, segundo?: number): VideoParaAsociar => ({
  nombre,
  ...(segundo !== undefined ? { segundo } : {}),
});

describe("lectura de la planilla", () => {
  it("PU-research-04: lee las hojas Tomas y Valores por nombre de columna", async () => {
    const p = await leerPlanilla(join(FIXTURES, "PLANILLA_TOMAS.xlsx"));
    expect(p.tomas).toHaveLength(8);
    expect(p.tomas[1]?.campos.codigo_toma).toBe("D01-EJ01-JUN-60-R1");
    expect(p.tomas[1]?.campos.tempo).toBe("60");
    expect(p.tomas[1]?.fila).toBe(3);
    expect(p.valores.get("instrumento")).toEqual(new Set(["acustico", "digital", "teclado"]));
  });

  it("PU-research-05: sin la hoja Tomas el error lo dice", async () => {
    const ruta = join(mkdtempSync(join(tmpdir(), "planilla-")), "sin-tomas.xlsx");
    const libro = new ExcelJS.Workbook();
    libro.addWorksheet("Valores");
    await libro.xlsx.writeFile(ruta);

    await expect(leerPlanilla(ruta)).rejects.toThrow('no tiene la hoja "Tomas"');
  });
});

describe("asociación fila–video", () => {
  it("PU-research-06: por nombre de archivo, sin distinguir mayúsculas", () => {
    const r = asociar([fila(0, "vid_1.MP4")], [video("VID_1.mp4"), video("VID_2.mp4")]);
    expect(r.pares.get(0)).toEqual({ nombre: "VID_1.mp4", metodo: "nombre" });
    expect(r.videosSinFila).toEqual(["VID_2.mp4"]);
  });

  it("PU-research-07: sin archivo, por la hora dentro de la tolerancia", () => {
    const r = asociar(
      [fila(0, undefined, 36000), fila(1, undefined, 36600)],
      [video("b.mp4", 36610), video("a.mp4", 36010), video("c.mp4", 50000)],
    );
    expect(r.pares.get(0)).toEqual({ nombre: "a.mp4", metodo: "hora" });
    expect(r.pares.get(1)).toEqual({ nombre: "b.mp4", metodo: "hora" });
    expect(r.videosSinFila).toEqual(["c.mp4"]);
  });

  it("PU-research-08: por orden solo si la cantidad coincide; si no, no adivina", () => {
    const iguales = asociar([fila(0), fila(1)], [video("b.mp4", 20), video("a.mp4", 10)]);
    expect(iguales.pares.get(0)).toEqual({ nombre: "a.mp4", metodo: "orden" });
    expect(iguales.pares.get(1)).toEqual({ nombre: "b.mp4", metodo: "orden" });

    const ambiguo = asociar([fila(0)], [video("b.mp4", 20), video("a.mp4", 10)]);
    expect(ambiguo.pares.size).toBe(0);
    expect(ambiguo.filasSinVideo).toHaveLength(1);
    expect(ambiguo.videosSinFila).toEqual(["a.mp4", "b.mp4"]);
  });

  it("PU-research-09: un nombre declarado que no existe no cae en otro video", () => {
    const r = asociar([fila(0, "falta.mp4", 100)], [video("a.mp4", 100)]);
    expect(r.pares.size).toBe(0);
    expect(r.filasSinVideo[0]?.indice).toBe(0);
    expect(r.videosSinFila).toEqual(["a.mp4"]);
  });
});

describe("ingesta de la sesión", { timeout: 60_000 }, () => {
  let salida: string;
  let pg: PGlite;
  let base: Base;
  let reporte: Reporte;

  beforeEach(async () => {
    salida = mkdtempSync(join(tmpdir(), "ingesta-"));
    ({ pg, base } = baseEnMemoria());
    reporte = await ingerir({ entrada: FIXTURES, salida, fecha: "2026-11-09", base });
  }, 60_000);

  it("PU-research-10: crea un paquete por toma con video, meta.json y hashes", () => {
    const paquete = join(salida, "PAQ-E01-EJ01-JUN-60-R1");
    const video = join(paquete, "video.mp4");
    expect(existsSync(video)).toBe(true);
    const sha = createHash("sha256").update(readFileSync(video)).digest("hex");
    const original = readFileSync(join(FIXTURES, "VID_20261109_181005.mp4"));
    expect(createHash("sha256").update(original).digest("hex")).toBe(sha);

    const meta = JSON.parse(readFileSync(join(paquete, "meta.json"), "utf8"));
    expect(meta).toMatchObject({
      tipo: "ejecucion",
      codigo_toma: "E01-EJ01-JUN-60-R1",
      origen: "real",
      asociacion: "hora",
      campos: { instrumento: "digital", hora: "18:10", etiquetas_1: "ER-A ER-B" },
      video: { archivo_original: "VID_20261109_181005.mp4", sha256: sha },
      versiones: { nucleo: VERSION_NUCLEO, ejercicio: "EJ-01@1" },
    });
  });

  it("PU-research-11: las tomas -ACT quedan marcadas como actuadas", () => {
    const ruta = join(salida, "PAQ-D01-EJ01-MI-60-R1-ACT", "meta.json");
    expect(JSON.parse(readFileSync(ruta, "utf8")).origen).toBe("actuado");
  });

  it("PU-research-12: registra participante, sesión y ejecución", async () => {
    expect(await filas(pg, "SELECT seudonimo, rol FROM participante ORDER BY 1")).toEqual([
      { seudonimo: "D01", rol: "docente_ref" },
      { seudonimo: "E01", rol: "estudiante" },
      { seudonimo: "ETQ-1", rol: "etiquetador" },
      { seudonimo: "ETQ-2", rol: "etiquetador" },
    ]);
    const sesiones = await filas(pg, "SELECT instrumento FROM sesion_grabacion");
    expect(sesiones).toEqual([{ instrumento: "digital" }]);
    const ejecuciones = await filas(
      pg,
      `SELECT codigo_toma, participante, version_ejercicio, campana, manos, tempo_elegido_bpm,
              modo_metronomo, evaluable, origen FROM ejecucion ORDER BY codigo_toma`,
    );
    expect(ejecuciones).toHaveLength(4);
    expect(ejecuciones[3]).toEqual({
      codigo_toma: "E01-EJ02-JUN-65-R1",
      participante: "E01",
      version_ejercicio: "EJ-02@1",
      campana: "B",
      manos: "juntas",
      tempo_elegido_bpm: 65,
      modo_metronomo: "sin",
      evaluable: false,
      origen: "real",
    });
  });

  it("PU-research-13: las etiquetas van por clase, con etiquetador y ronda", async () => {
    const consulta = `SELECT l.etiquetador, l.clase_error, l.presente, l.compas_aprox, l.ronda
      FROM etiqueta l JOIN ejecucion e ON e.id = l.ejecucion
      WHERE e.codigo_toma = 'E01-EJ01-JUN-60-R1' AND l.clase_error IN ('ER-A', 'ER-B', 'ER-C')
      ORDER BY 1, 2`;
    const base = { compas_aprox: "5", ronda: "doble" };
    expect(await filas(pg, consulta)).toEqual([
      { etiquetador: "ETQ-1", clase_error: "ER-A", presente: true, ...base },
      { etiquetador: "ETQ-1", clase_error: "ER-B", presente: true, ...base },
      { etiquetador: "ETQ-1", clase_error: "ER-C", presente: false, ...base },
      { etiquetador: "ETQ-2", clase_error: "ER-A", presente: true, ...base },
      { etiquetador: "ETQ-2", clase_error: "ER-B", presente: false, ...base },
      { etiquetador: "ETQ-2", clase_error: "ER-C", presente: false, ...base },
    ]);
    const ok = await filas(
      pg,
      `SELECT count(*)::int AS n, bool_or(l.presente) AS alguna, min(l.ronda) AS ronda
       FROM etiqueta l JOIN ejecucion e ON e.id = l.ejecucion
       WHERE e.codigo_toma = 'E01-EJ02-JUN-65-R1'`,
    );
    expect(ok).toEqual([{ n: 6, alguna: false, ronda: "simple" }]);
  });

  it("PU-research-14: el reporte separa cada categoría", () => {
    expect(reporte.tomas_validas).toEqual([
      "D01-EJ01-JUN-60-R1",
      "D01-EJ01-MI-60-R1-ACT",
      "E01-EJ01-JUN-60-R1",
      "E01-EJ02-JUN-65-R1",
    ]);
    expect(reporte.tomas_cal).toEqual(["CAL-digital-1"]);
    expect(reporte.filas_sin_video.map((f) => f.codigo)).toEqual(["E02-EJ01-JUN-60-R2"]);
    expect(reporte.videos_sin_fila).toEqual(["VID_20261109_190000.mp4"]);
    expect(reporte.valores_invalidos).toEqual([
      expect.objectContaining({
        codigo: "E02-EJ01-JUN-60-R3",
        campo: "instrumento",
        valor: "guitarra",
      }),
      expect.objectContaining({
        codigo: "E02-EJ02-JUN-60-R1",
        campo: "etiquetas_1",
        valor: "ER-Z",
      }),
    ]);
    expect(reporte.asociacion).toEqual({ nombre: 4, hora: 1, orden: 0 });
    expect(existsSync(join(salida, "reporte-ingesta.json"))).toBe(true);
  });

  it("PU-research-15: la toma de calibración tiene paquete y no es una ejecución", async () => {
    const meta = JSON.parse(readFileSync(join(salida, "PAQ-CAL-digital-1", "meta.json"), "utf8"));
    expect(meta.tipo).toBe("calibracion");
    const n = await filas(
      pg,
      "SELECT count(*)::int AS n FROM ejecucion WHERE codigo_toma LIKE 'CAL-%'",
    );
    expect(n).toEqual([{ n: 0 }]);
  });

  it("PU-research-16: repetir la ingesta no duplica paquetes ni filas", async () => {
    const otra = await ingerir({ entrada: FIXTURES, salida, fecha: "2026-11-09", base });
    expect(otra.tomas_validas).toEqual(reporte.tomas_validas);
    expect(otra.paquetes_rechazados).toEqual([]);
    expect(await filas(pg, "SELECT count(*)::int AS n FROM ejecucion")).toEqual([{ n: 4 }]);
    expect(await filas(pg, "SELECT count(*)::int AS n FROM etiqueta")).toEqual([{ n: 24 }]);
  });

  it("PA-HU18-04: si se altera un byte del paquete, se rechaza con un mensaje explícito", async () => {
    const video = join(salida, "PAQ-D01-EJ01-JUN-60-R1", "video.mp4");
    const datos = readFileSync(video);
    datos[100] = (datos[100] ?? 0) ^ 0xff;
    writeFileSync(video, datos);

    const otra = await ingerir({ entrada: FIXTURES, salida, fecha: "2026-11-09", base });

    expect(otra.tomas_validas).not.toContain("D01-EJ01-JUN-60-R1");
    expect(otra.paquetes_rechazados).toEqual([
      {
        codigo: "D01-EJ01-JUN-60-R1",
        motivo: expect.stringContaining("video.mp4 no coincide con su sha256"),
      },
    ]);
  });

  it("PU-research-17: un código que contradice sus columnas se informa y no se empaqueta", async () => {
    const entrada = mkdtempSync(join(tmpdir(), "entrada-"));
    cpSync(FIXTURES, entrada, { recursive: true });
    const libro = new ExcelJS.Workbook();
    await libro.xlsx.readFile(join(entrada, "PLANILLA_TOMAS.xlsx"));
    const hoja = libro.getWorksheet("Tomas");
    if (hoja) hoja.getRow(3).getCell(7).value = 70;
    await libro.xlsx.writeFile(join(entrada, "PLANILLA_TOMAS.xlsx"));
    const destino = mkdtempSync(join(tmpdir(), "salida-"));

    const r = await ingerir({
      entrada,
      salida: destino,
      fecha: "2026-11-09",
      base: baseEnMemoria().base,
    });

    expect(r.tomas_validas).not.toContain("D01-EJ01-JUN-60-R1");
    expect(r.valores_invalidos).toContainEqual(
      expect.objectContaining({ codigo: "D01-EJ01-JUN-60-R1", campo: "tempo", valor: "70" }),
    );
  });
});

describe("modo de verificación", () => {
  it("PU-research-18: informa lo mismo sin copiar videos ni tocar la base", async () => {
    const salida = mkdtempSync(join(tmpdir(), "verificar-"));

    const r = await ingerir({ entrada: FIXTURES, salida, fecha: "2026-11-09" });

    expect(r.solo_verificar).toBe(true);
    expect(r.tomas_validas).toHaveLength(4);
    expect(readdirSync(salida).filter((n) => n.startsWith("PAQ-"))).toEqual([]);
  });
});

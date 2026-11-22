// Validaciones V1 (OE2 y OE3) sobre las tomas reprocesadas; cada una deja su tabla en Markdown.
//   pnpm validacion v1-visual --ejercicio EJ-01@1 --anotacion <v1-visual.csv> [--reporte <reporte-reproceso.json>]… [--salida <carpeta>]
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ResultadoReproceso } from "@skilltrack/contracts";
import pg from "pg";
import { tomasParaV1, type TomaParaV1 } from "./consulta.ts";
import { leerAnotacionVisual, v1Visual, type TomaV1 } from "./v1.ts";
import { tablaV1Visual } from "./v1-informe.ts";

const BASE_LOCAL = "postgresql://research:research@127.0.0.1:5434/research";

export interface OpcionesV1 {
  ejercicio?: string | undefined;
  anotacion?: string | undefined;
  reporte?: string[] | undefined;
  salida: string;
  base?: string | undefined;
}

export async function escribirTabla(carpeta: string, nombre: string, contenido: string) {
  const archivo = join(resolve(carpeta), nombre);
  await writeFile(archivo, contenido, { flag: "wx" });
  console.log(`Tabla: ${archivo}`);
}

/** Tiempos de proceso por toma, de uno o más reporte-reproceso.json (el último manda). */
export function tiemposDe(reportes: readonly string[]) {
  const tiempos = new Map<string, { proceso_s: number; video_s: number }>();
  for (const r of reportes) {
    const { procesadas } = JSON.parse(readFileSync(r, "utf8")) as {
      procesadas: { codigo: string; duracion_proceso_s: number; duracion_video_s: number }[];
    };
    for (const p of procesadas) {
      tiempos.set(p.codigo, { proceso_s: p.duracion_proceso_s, video_s: p.duracion_video_s });
    }
  }
  return tiempos;
}

export function cargarResultado(t: TomaParaV1): ResultadoReproceso | null {
  const ruta = join(t.ruta, "resultado.json");
  return existsSync(ruta) ? ResultadoReproceso.parse(JSON.parse(readFileSync(ruta, "utf8"))) : null;
}

export async function conBase<T>(
  url: string | undefined,
  f: (t: TomaParaV1[]) => Promise<T>,
  ejercicio: string,
) {
  const cliente = new pg.Client({ connectionString: url ?? BASE_LOCAL });
  await cliente.connect();
  try {
    const base = { consulta: (sql: string, p?: unknown[]) => cliente.query(sql, p) };
    return await f(await tomasParaV1(base, ejercicio));
  } finally {
    await cliente.end();
  }
}

export async function v1VisualCli(o: OpcionesV1): Promise<void> {
  if (!o.ejercicio || !o.anotacion) {
    console.error(
      "Uso: v1-visual --ejercicio <EJ-xx@n> --anotacion <v1-visual.csv> [--reporte <reporte-reproceso.json>]… [--salida <carpeta>]",
    );
    process.exit(2);
  }
  const anotadas = leerAnotacionVisual(readFileSync(o.anotacion, "utf8"));
  const tiempos = tiemposDe(o.reporte ?? []);
  await conBase(
    o.base,
    async (lista) => {
      const tomas: TomaV1[] = lista.map((t) => ({
        codigo_toma: t.codigo_toma,
        origen: t.origen,
        instrumento: t.instrumento,
        resultado: cargarResultado(t),
        tiempo: tiempos.get(t.codigo_toma) ?? null,
      }));
      const conocidas = new Set(lista.map((t) => t.codigo_toma));
      const ajenas = [...new Set(anotadas.map((a) => a.codigo_toma))].filter(
        (c) => !conocidas.has(c),
      );
      if (ajenas.length)
        console.log(`Anotaciones de tomas que no están en la base: ${ajenas.join(", ")}`);
      await escribirTabla(
        o.salida,
        `v1-visual-${o.ejercicio!.replace("@", "-v")}.md`,
        tablaV1Visual(v1Visual(tomas, anotadas)),
      );
    },
    o.ejercicio,
  );
}

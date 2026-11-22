// Validaciones V1 (OE2 y OE3) sobre las tomas reprocesadas; cada una deja su tabla en Markdown.
//   pnpm validacion v1-visual --ejercicio EJ-01@1 --anotacion <v1-visual.csv> [--reporte <reporte-reproceso.json>]… [--salida <carpeta>]
//   pnpm validacion v1-acustica --ejercicio EJ-01@1 --anotaciones <carpeta> [--tolerancia-ms 50] [--salida <carpeta>]
//   pnpm validacion sincronizacion --toma <carpeta reprocesada> [--toma …] [--salida <carpeta>]
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { EventosAudio, FotogramaReproceso, ResultadoReproceso } from "@skilltrack/contracts";
import pg from "pg";
import { tomasParaV1, type TomaParaV1 } from "./consulta.ts";
import { sincronizacion, tablaSincronizacion, type TomaSincronizacion } from "./sincronizacion.ts";
import { leerAnotacionVisual, v1Visual, type TomaV1 } from "./v1.ts";
import {
  leerAnotacionAcustica,
  TOLERANCIA_ATAQUE_MS,
  v1Acustica,
  type TomaAcustica,
} from "./v1-acustica.ts";
import { tablaV1Acustica, tablaV1Visual } from "./v1-informe.ts";

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

export interface OpcionesV1Acustica extends OpcionesV1 {
  anotaciones?: string | undefined;
  "tolerancia-ms"?: string | undefined;
}

/** pnpm validacion v1-acustica --ejercicio EJ-01@1 --anotaciones <carpeta con <codigo_toma>.csv> [--tolerancia-ms 50] */
export async function v1AcusticaCli(o: OpcionesV1Acustica): Promise<void> {
  if (!o.ejercicio || !o.anotaciones) {
    console.error(
      "Uso: v1-acustica --ejercicio <EJ-xx@n> --anotaciones <carpeta> [--tolerancia-ms 50] [--salida <carpeta>]",
    );
    process.exit(2);
  }
  const tolerancia = Number(o["tolerancia-ms"] ?? TOLERANCIA_ATAQUE_MS);
  await conBase(
    o.base,
    async (lista) => {
      const tomas: TomaAcustica[] = [];
      const sinAudio: string[] = [];
      for (const t of lista) {
        const anotacion = join(o.anotaciones!, `${t.codigo_toma}.csv`);
        if (!existsSync(anotacion)) continue;
        const eventos = join(t.ruta, "audio_events.json");
        if (!existsSync(eventos)) {
          sinAudio.push(t.codigo_toma);
          continue;
        }
        const audio = EventosAudio.parse(JSON.parse(readFileSync(eventos, "utf8")));
        tomas.push({
          codigo_toma: t.codigo_toma,
          origen: t.origen,
          instrumento: t.instrumento,
          anotados: leerAnotacionAcustica(readFileSync(anotacion, "utf8")),
          detectados: audio.ataques.map((a) => ({ t: a.t, clase: a.clase })),
        });
      }
      console.log(`Tomas anotadas sin audio_events.json: ${sinAudio.join(", ") || "ninguna"}`);
      await escribirTabla(
        o.salida,
        `v1-acustica-${o.ejercicio!.replace("@", "-v")}.md`,
        tablaV1Acustica(v1Acustica(tomas, tolerancia), tolerancia),
      );
    },
    o.ejercicio,
  );
}

/** pnpm validacion sincronizacion --toma <carpeta reprocesada> [--toma …] [--salida <carpeta>] */
export async function sincronizacionCli(o: { toma?: string[] | undefined; salida: string }) {
  if (!o.toma?.length) {
    console.error(
      "Uso: sincronizacion --toma <carpeta de la toma reprocesada> [--toma …] [--salida <carpeta>]",
    );
    process.exit(2);
  }
  const tomas: TomaSincronizacion[] = o.toma.map((carpeta) => {
    const resultado = ResultadoReproceso.parse(
      JSON.parse(readFileSync(join(carpeta, "resultado.json"), "utf8")),
    );
    const fotogramas = readFileSync(join(carpeta, "landmarks.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => FotogramaReproceso.parse(JSON.parse(l)));
    const audio = EventosAudio.parse(
      JSON.parse(readFileSync(join(carpeta, "audio_events.json"), "utf8")),
    );
    if (!audio.pista) console.log(`${resultado.codigo_toma}: sin audio (${audio.motivo ?? "—"})`);
    return {
      codigo_toma: resultado.codigo_toma,
      origen: resultado.origen,
      fotogramas,
      ataques: audio.ataques.map((a) => a.t),
    };
  });
  await escribirTabla(o.salida, "sincronizacion.md", tablaSincronizacion(sincronizacion(tomas)));
}

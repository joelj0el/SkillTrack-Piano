// Procesa las tomas de una sesión con el núcleo de la app, en Edge o Chrome sin interfaz. Uso:
//   pnpm reprocesar --sesion <carpeta de paquetes> [--catalogo <catalogo.json>] [--solo <codigo>] [--sin-base]
// El catálogo sale de la app con: python -m app.modules.catalog.exportar; sin él, cada toma usa
// la escala provisional y su resultado.json lo dice.
// Se puede cortar y repetir: sigue con las tomas que faltan.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { Ejercicio } from "@skilltrack/contracts";
import pg from "pg";
import { readFileSync } from "node:fs";
import { abrirProcesador } from "./navegador.ts";
import { ErrorReproceso, reprocesar, type ReporteReproceso } from "./reprocesar.ts";

const BASE_LOCAL = "postgresql://research:research@127.0.0.1:5434/research";

function imprimir(r: ReporteReproceso): void {
  const seccion = (titulo: string, lineas: string[]) => {
    console.log(`\n${titulo}: ${lineas.length}`);
    lineas.forEach((l) => console.log(`  ${l}`));
  };
  seccion(
    "Procesadas",
    r.procesadas.map(
      (p) =>
        `${p.codigo}: ${p.duracion_proceso_s} s para ${Math.round(p.duracion_video_s)} s de video; ` +
        `${p.con_manos}/${p.fotogramas} fotogramas con manos, ${p.perdidos} perdidos; ` +
        `${p.porcentaje_evaluable} % evaluable; evaluable=${p.evaluable ? "si" : "no"}`,
    ),
  );
  seccion("Ya estaban hechas", r.ya_hechas);
  seccion(
    "NO SE PUEDEN DECODIFICAR",
    r.no_decodificables.map(
      (n) =>
        `${n.codigo}: video=${n.codec_video ?? "?"} audio=${n.codec_audio ?? "?"} (${n.motivo})`,
    ),
  );
  seccion(
    "Sin calibración",
    r.sin_calibracion.map((n) => `${n.codigo}: ${n.motivo}`),
  );
  seccion(
    "Paquetes rechazados",
    r.paquetes_rechazados.map((n) => `${n.codigo}: ${n.motivo}`),
  );
  seccion(
    "Fallidas",
    r.fallidas.map((n) => `${n.codigo}: ${n.motivo}`),
  );
  seccion("Sin registro en la base", r.sin_registro);
  const tiempos = r.procesadas.map((p) => p.duracion_proceso_s);
  if (tiempos.length) {
    const media = tiempos.reduce((a, b) => a + b, 0) / tiempos.length;
    console.log(`\nTiempo medio por toma: ${Math.round(media)} s`);
  }
}

const { values } = parseArgs({
  options: {
    sesion: { type: "string" },
    solo: { type: "string" },
    catalogo: { type: "string" },
    base: { type: "string" },
    "sin-base": { type: "boolean", default: false },
  },
});

if (!values.sesion) {
  console.error("Falta --sesion <carpeta de paquetes de la sesión>");
  process.exit(2);
}
const carpeta = resolve(values.sesion);
if (!existsSync(carpeta)) {
  console.error(`No existe la carpeta ${carpeta}`);
  process.exit(2);
}

let cliente: pg.Client | undefined;
const procesador = await abrirProcesador();
try {
  if (!values["sin-base"]) {
    cliente = new pg.Client({
      connectionString: values.base ?? process.env.RESEARCH_DATABASE_URL ?? BASE_LOCAL,
    });
    await cliente.connect();
  }
  const conexion = cliente;
  const reporte = await reprocesar({
    carpeta,
    procesador,
    avisar: console.log,
    ...(values.catalogo
      ? {
          catalogo: Ejercicio.array().parse(
            JSON.parse(readFileSync(resolve(values.catalogo), "utf8")),
          ),
        }
      : {}),
    ...(values.solo ? { solo: values.solo } : {}),
    ...(conexion
      ? {
          base: {
            consulta: (sql: string, parametros?: unknown[]) => conexion.query(sql, parametros),
          },
        }
      : {}),
  });
  imprimir(reporte);
  console.log(`\nReporte: ${resolve(carpeta, "reporte-reproceso.json")}`);
  const incompleto =
    reporte.no_decodificables.length +
    reporte.sin_calibracion.length +
    reporte.paquetes_rechazados.length +
    reporte.fallidas.length;
  if (incompleto > 0) process.exitCode = 1;
} catch (error) {
  if (error instanceof ErrorReproceso) {
    console.error(error.message);
    process.exitCode = 2;
  } else {
    throw error;
  }
} finally {
  await procesador.cerrar();
  await cliente?.end();
}

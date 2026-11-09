// Ingesta de una sesión de grabación. Uso:
//   pnpm ingesta --entrada <carpeta> [--salida <carpeta>] [--fecha AAAA-MM-DD] [--verificar]
// La carpeta de entrada contiene PLANILLA_TOMAS.xlsx y los videos.
import { basename, resolve } from "node:path";
import { parseArgs } from "node:util";
import pg from "pg";
import { ingerir, type Reporte } from "./ingesta.ts";
import { ErrorPlanilla } from "./planilla.ts";

const BASE_LOCAL = "postgresql://research:research@127.0.0.1:5434/research";

function imprimir(r: Reporte, salida: string): void {
  const seccion = (titulo: string, lineas: string[]) => {
    console.log(`\n${titulo}: ${lineas.length}`);
    lineas.forEach((l) => console.log(`  ${l}`));
  };
  console.log(
    r.solo_verificar ? "MODO VERIFICACIÓN: no se copió ni se registró nada." : "Ingesta terminada.",
  );
  console.log(`Columnas leídas: ${r.columnas.join(", ")}`);
  seccion("Tomas válidas", r.tomas_validas);
  seccion("Tomas de calibración (CAL-)", r.tomas_cal);
  seccion(
    "Filas sin video",
    r.filas_sin_video.map((f) => `fila ${f.fila} ${f.codigo}: ${f.motivo}`),
  );
  seccion("Videos sin fila", r.videos_sin_fila);
  seccion(
    "Valores inválidos",
    r.valores_invalidos.map(
      (p) => `fila ${p.fila} ${p.codigo}: ${p.campo}="${p.valor}" (${p.motivo})`,
    ),
  );
  seccion(
    "Paquetes rechazados",
    r.paquetes_rechazados.map((p) => `${p.codigo}: ${p.motivo}`),
  );
  console.log(
    `\nAsociación: ${r.asociacion.nombre} por nombre, ${r.asociacion.hora} por hora, ${r.asociacion.orden} por orden`,
  );
  console.log(
    `Etiquetas con etiquetador sin identificar (ETQ-n): ${r.etiquetadores_sin_identificar}`,
  );
  console.log(`Reporte: ${resolve(salida, "reporte-ingesta.json")}`);
}

const { values } = parseArgs({
  options: {
    entrada: { type: "string" },
    salida: { type: "string" },
    fecha: { type: "string" },
    base: { type: "string" },
    verificar: { type: "boolean", default: false },
  },
});

if (!values.entrada) {
  console.error("Falta --entrada <carpeta con PLANILLA_TOMAS.xlsx y los videos>");
  process.exit(2);
}
const entrada = resolve(values.entrada);
const nombre = basename(entrada);
const fecha = values.fecha ?? (/^\d{4}-\d{2}-\d{2}$/.test(nombre) ? nombre : undefined);
if (!fecha) {
  console.error("Indica --fecha AAAA-MM-DD: el nombre de la carpeta no es una fecha");
  process.exit(2);
}
const salida = resolve(values.salida ?? resolve("research/data/paquetes", nombre));

let cliente: pg.Client | undefined;
try {
  if (!values.verificar) {
    cliente = new pg.Client({
      connectionString: values.base ?? process.env.RESEARCH_DATABASE_URL ?? BASE_LOCAL,
    });
    await cliente.connect();
  }
  const conexion = cliente;
  const reporte = await ingerir({
    entrada,
    salida,
    fecha,
    ...(conexion
      ? {
          base: {
            consulta: (sql: string, parametros?: unknown[]) => conexion.query(sql, parametros),
          },
        }
      : {}),
  });
  imprimir(reporte, salida);
} catch (error) {
  if (error instanceof ErrorPlanilla) {
    console.error(`Planilla no válida: ${error.message}`);
    process.exitCode = 2;
  } else {
    throw error;
  }
} finally {
  await cliente?.end();
}

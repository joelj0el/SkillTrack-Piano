// Construye la referencia por consenso de un ejercicio con las tomas reprocesadas de la Campaña A.
//   pnpm bandas --ejercicio EJ-01@1 --version 1 --parametros <parametros.json> [--salida <carpeta>]
// Los parámetros salen de research/node/src/bandas/parametros.plantilla.json.
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ParametrosBandas, ResultadoReproceso } from "@skilltrack/contracts";
import pg from "pg";
import { tomasDeReferencia } from "./consulta.ts";
import { construirReferencia, escribirReferencia, type TomaReprocesada } from "./referencia.ts";

const BASE_LOCAL = "postgresql://research:research@127.0.0.1:5434/research";

const { values } = parseArgs({
  options: {
    ejercicio: { type: "string" },
    version: { type: "string" },
    parametros: { type: "string" },
    salida: { type: "string", default: "." },
    base: { type: "string" },
  },
});
const version = Number(values.version);
if (!values.ejercicio || !Number.isInteger(version) || version < 1 || !values.parametros) {
  console.error(
    "Uso: --ejercicio <EJ-xx@n> --version <N> --parametros <archivo.json> [--salida <carpeta>]",
  );
  process.exit(2);
}
const parametros = ParametrosBandas.parse(JSON.parse(readFileSync(values.parametros, "utf8")));

const cliente = new pg.Client({ connectionString: values.base ?? BASE_LOCAL });
await cliente.connect();
try {
  const base = { consulta: (sql: string, p?: unknown[]) => cliente.query(sql, p) };
  const tomas: TomaReprocesada[] = [];
  const sinReprocesar: string[] = [];
  const noEvaluables: string[] = [];
  for (const t of await tomasDeReferencia(base, values.ejercicio)) {
    const ruta = join(t.ruta, "resultado.json");
    if (!existsSync(ruta)) {
      sinReprocesar.push(t.codigo_toma);
      continue;
    }
    const resultado = ResultadoReproceso.parse(JSON.parse(readFileSync(ruta, "utf8")));
    if (!resultado.evaluable.final) noEvaluables.push(t.codigo_toma);
    else tomas.push({ docente: t.docente, resultado });
  }
  const ref = construirReferencia({
    tomas,
    parametros,
    version,
    versionEjercicio: values.ejercicio,
    generadaEn: new Date().toISOString(),
  });
  const archivo = await escribirReferencia(resolve(values.salida), ref);

  console.log(`Referencia v${ref.version} de ${ref.version_ejercicio}: ${archivo}`);
  console.log(
    `Docentes: ${ref.n_docentes} · tomas: ${ref.origen.tomas.length} · bandas: ${ref.bandas.length}`,
  );
  console.log(`Sin reprocesar: ${sinReprocesar.join(", ") || "ninguna"}`);
  console.log(`No evaluables tras el análisis: ${noEvaluables.join(", ") || "ninguna"}`);
  for (const d of ref.rasgos_descartados) console.log(`DESCARTADO ${d.rasgo}: ${d.motivo}`);
  for (const s of ref.rasgos_sin_evaluar) console.log(`SIN EVALUAR ${s.rasgo}: ${s.motivo}`);
} finally {
  await cliente.end();
}

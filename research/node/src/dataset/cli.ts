// HU-33: exporta las ejecuciones etiquetadas para el dataset del clasificador (research/python).
//   pnpm dataset:exportar --ejercicio EJ-01@1 --referencia <referencia.json> --reglas <conjunto.json> --salida <carpeta>
// Deja ejecuciones.jsonl (una por línea) y resumen.json (tomas totales y válidas por origen).
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ConjuntoReglas, Referencia, ResultadoReproceso } from "@skilltrack/contracts";
import pg from "pg";
import { CLASES_ERROR } from "../ingesta/validar.ts";
import { ORIGENES } from "../validacion/concordancia.ts";
import { etiquetasDelEjercicio, tomasDelEjercicio } from "../validacion/consulta.ts";
import { exportarEjecuciones, type PedidoExportacion } from "./exportar.ts";

const BASE_LOCAL = "postgresql://research:research@127.0.0.1:5434/research";

const { values } = parseArgs({
  options: {
    ejercicio: { type: "string" },
    referencia: { type: "string" },
    reglas: { type: "string" },
    salida: { type: "string" },
    base: { type: "string" },
  },
});
if (!values.ejercicio || !values.referencia || !values.reglas || !values.salida) {
  console.error(
    "Uso: --ejercicio <EJ-xx@n> --referencia <referencia.json> --reglas <conjunto.json> --salida <carpeta>",
  );
  process.exit(2);
}
const ref = Referencia.parse(JSON.parse(readFileSync(values.referencia, "utf8")));
const reglas = ConjuntoReglas.parse(JSON.parse(readFileSync(values.reglas, "utf8")));
const salida = resolve(values.salida);

const cliente = new pg.Client({ connectionString: values.base ?? BASE_LOCAL });
await cliente.connect();
try {
  const base = {
    consulta: (sql: string, p?: unknown[]) => cliente.query(sql, p),
  };
  const etiquetas = await etiquetasDelEjercicio(base, values.ejercicio);
  const conEtiqueta = new Set(etiquetas.map((e) => e.codigo_toma));
  const conteo = Object.fromEntries(
    ORIGENES.map((o) => [o, { total: 0, validas: 0, sin_reprocesar: 0 }]),
  );
  const pedidos: PedidoExportacion[] = [];
  // Todas las tomas del ejercicio cuentan para el % de tomas válidas (G-2).
  const { rows } = await base.consulta(
    "SELECT origen, count(*)::int AS n FROM ejecucion WHERE version_ejercicio = $1 GROUP BY origen",
    [values.ejercicio],
  );
  for (const r of rows as { origen: keyof typeof conteo; n: number }[])
    conteo[r.origen]!.total = r.n;
  for (const t of await tomasDelEjercicio(base, values.ejercicio)) {
    const ruta = join(t.ruta, "resultado.json");
    if (!existsSync(ruta)) {
      conteo[t.origen]!.sin_reprocesar++;
      continue;
    }
    const resultado = ResultadoReproceso.parse(JSON.parse(readFileSync(ruta, "utf8")));
    if (!resultado.evaluable.final) continue;
    conteo[t.origen]!.validas++;
    if (!conEtiqueta.has(t.codigo_toma)) continue;
    pedidos.push({
      codigo_toma: t.codigo_toma,
      sujeto: t.participante,
      origen: t.origen,
      version_ejercicio: values.ejercicio,
      resultado,
    });
  }
  const filas = exportarEjecuciones(
    pedidos,
    etiquetas,
    { version: ref.version, bandas: ref.bandas },
    reglas,
    CLASES_ERROR,
  );
  await mkdir(salida, { recursive: true });
  await writeFile(
    join(salida, "ejecuciones.jsonl"),
    filas.map((f) => JSON.stringify(f)).join("\n") + "\n",
    { flag: "wx" },
  );
  const resumen = {
    version_ejercicio: values.ejercicio,
    referencia: ref.version,
    reglas: reglas.version,
    tomas: conteo,
  };
  await writeFile(join(salida, "resumen.json"), `${JSON.stringify(resumen, null, 2)}\n`, {
    flag: "wx",
  });
  console.log(`Ejecuciones exportadas: ${filas.length} → ${salida}`);
  for (const [o, c] of Object.entries(conteo)) {
    console.log(`  ${o}: ${c.validas} válidas de ${c.total}; sin reprocesar ${c.sin_reprocesar}`);
  }
} finally {
  await cliente.end();
}

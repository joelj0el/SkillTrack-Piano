// Validaciones de la It-4 sobre la base de investigación; cada una deja su tabla en Markdown.
//   pnpm validacion v2  --ejercicio EJ-01@1 --referencia <referencia.json> [--salida <carpeta>]
//   pnpm validacion v3a --ejercicio EJ-01@1 --referencia <referencia.json> --reglas <conjunto.json> [--salida <carpeta>]
//   pnpm validacion v3b --ejercicio EJ-01@1 --referencia <referencia.json> --reglas <conjunto.json> [--salida <carpeta>]
import { existsSync, readFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { ConjuntoReglas, Referencia, ResultadoReproceso } from "@skilltrack/contracts";
import pg from "pg";
import { ROL_DOCENTE } from "../bandas/consulta.ts";
import { CLASES_ERROR } from "../ingesta/validar.ts";
import {
  concordanciaEtiquetadores,
  concordanciaReglas,
  type TomaEtiquetada,
} from "./concordancia.ts";
import { etiquetasDelEjercicio, tomasDelEjercicio, type TomaDeLaBase } from "./consulta.ts";
import { tablaEtiquetadores, tablaReglas, tablaV2 } from "./informe.ts";
import { v2PorOrigen } from "./v2.ts";

const BASE_LOCAL = "postgresql://research:research@127.0.0.1:5434/research";
const USO =
  "Uso: v2|v3a|v3b --ejercicio <EJ-xx@n> --referencia <referencia.json> [--reglas <conjunto.json>] [--salida <carpeta>]";

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    ejercicio: { type: "string" },
    referencia: { type: "string" },
    reglas: { type: "string" },
    salida: { type: "string", default: "." },
    base: { type: "string" },
  },
});
const [validacion] = positionals;
if (
  !["v2", "v3a", "v3b"].includes(validacion ?? "") ||
  !values.ejercicio ||
  !values.referencia ||
  (validacion !== "v2" && !values.reglas)
) {
  console.error(USO);
  process.exit(2);
}
const ref = Referencia.parse(JSON.parse(readFileSync(values.referencia, "utf8")));
const salida = resolve(values.salida);

async function escribir(nombre: string, contenido: string): Promise<void> {
  const archivo = join(salida, nombre);
  await writeFile(archivo, contenido, { flag: "wx" });
  console.log(`Tabla: ${archivo}`);
}

const cliente = new pg.Client({ connectionString: values.base ?? BASE_LOCAL });
await cliente.connect();
try {
  const base = {
    consulta: (sql: string, p?: unknown[]) => cliente.query(sql, p),
  };
  const sinReprocesar: string[] = [];
  const noEvaluables: string[] = [];
  const cargar = (t: TomaDeLaBase) => {
    const ruta = join(t.ruta, "resultado.json");
    if (!existsSync(ruta)) {
      sinReprocesar.push(t.codigo_toma);
      return null;
    }
    const resultado = ResultadoReproceso.parse(JSON.parse(readFileSync(ruta, "utf8")));
    if (!resultado.evaluable.final) {
      noEvaluables.push(t.codigo_toma);
      return null;
    }
    return resultado;
  };
  const tomas = await tomasDelEjercicio(base, values.ejercicio!);
  const sufijo = `${values.ejercicio!.replace("@", "-v")}-ref${ref.version}`;

  if (validacion === "v2") {
    const deDocentes = tomas.filter((t) => t.rol === ROL_DOCENTE);
    const cargadas = deDocentes.flatMap((t) => {
      const resultado = cargar(t);
      return resultado ? [{ docente: t.participante, origen: t.origen, resultado }] : [];
    });
    await escribir(`v2-${sufijo}.md`, tablaV2(v2PorOrigen(cargadas, ref)));
  } else {
    const reglas = ConjuntoReglas.parse(JSON.parse(readFileSync(values.reglas!, "utf8")));
    const etiquetas = await etiquetasDelEjercicio(base, values.ejercicio!);
    const conEtiqueta = new Set(etiquetas.map((e) => e.codigo_toma));
    const etiquetadas: TomaEtiquetada[] = tomas
      .filter((t) => conEtiqueta.has(t.codigo_toma))
      .flatMap((t) => {
        const resultado = cargar(t);
        return resultado
          ? [
              {
                codigo_toma: t.codigo_toma,
                participante: t.participante,
                origen: t.origen,
                resultado,
              },
            ]
          : [];
      });
    const referencia = { version: ref.version, bandas: ref.bandas };
    const nombre = `${sufijo}-reglas${reglas.version}`;
    if (validacion === "v3a") {
      const filas = concordanciaReglas(
        etiquetadas,
        etiquetas,
        referencia,
        reglas,
        "VA",
        CLASES_ERROR,
      );
      await escribir(
        `v3a-reglas-${nombre}.md`,
        tablaReglas("V3a · Concordancia de las reglas (modo VA) con las etiquetas", filas),
      );
      await escribir(
        `v3a-etiquetadores-${nombre}.md`,
        tablaEtiquetadores(concordanciaEtiquetadores(etiquetadas, etiquetas, CLASES_ERROR)),
      );
    } else {
      const filas = (["V", "A", "VA"] as const).flatMap((modo) =>
        concordanciaReglas(etiquetadas, etiquetas, referencia, reglas, modo, CLASES_ERROR),
      );
      await escribir(
        `v3b-${nombre}.md`,
        tablaReglas("V3b · Ablación V / A / VA de las reglas frente a las etiquetas", filas),
      );
    }
  }
  console.log(`Sin reprocesar: ${sinReprocesar.join(", ") || "ninguna"}`);
  console.log(`No evaluables tras el análisis: ${noEvaluables.join(", ") || "ninguna"}`);
} finally {
  await cliente.end();
}

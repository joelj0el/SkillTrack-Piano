/**
 * Publica una referencia y un conjunto de reglas nuevos (versión vigente + 1) como el
 * superadministrador de demostración. Bandas SINTÉTICAS pensadas para el intento de ejemplo.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect } from "@playwright/test";
import { INTENTO_EJEMPLO } from "../apps/web/src/investigacion/ejemplo.ts";
import { CLAVE_DEMO, sesionApi } from "./ayuda.ts";

const CSRF = { "x-skilltrack-csrf": "1" };
const PLANTILLA = resolve(import.meta.dirname, "../tools/catalogo/conjunto_reglas.v1.json");

async function siguienteVersion(
  api: Awaited<ReturnType<typeof sesionApi>>,
  ruta: string,
  version: (cuerpo: { referencia?: { version: number }; conjunto?: { version: number } }) => number,
): Promise<number> {
  const r = await api.get(ruta);
  if (r.status() === 404) return 1;
  expect(r.status()).toBe(200);
  return version(await r.json()) + 1;
}

/** Bandas para los eventos 0..n-1 (por omisión, los del intento de ejemplo). */
function bandas(n: number) {
  const porEvento = Array.from({ length: n }, (_, idx) => ({ idx })).flatMap((e) => [
    { unidad: `e${e.idx}`, rasgo: "tecla.zona", inferior: 0.2, superior: 0.6, centro: 0.4 },
    { unidad: `e${e.idx}`, rasgo: "ataque.desvio_pct", inferior: -15, superior: 15, centro: 0 },
  ]);
  const tempo = {
    unidad: "ejecucion",
    rasgo: "cambio_tempo.pct",
    inferior: -3,
    superior: 3,
    centro: 0,
  };
  return [...porEvento, tempo].map((b) => ({ ...b, n_docentes: 3, n_ejecuciones: 6 }));
}

export async function publicarArtefactos(
  eventos = INTENTO_EJEMPLO.eventos.length,
): Promise<{ referenciaId: number; reglasId: number }> {
  const api = await sesionApi("superadmin.demo", CLAVE_DEMO);
  // La referencia es de la versión vigente del EJ-01 (otra prueba pudo importar una partitura).
  const ej = (await (await api.get("/api/catalogo/ejercicios/EJ-01")).json()).version_vigente;
  const vRef = await siguienteVersion(
    api,
    `/api/catalogo/referencias/vigente?version_ejercicio_id=${ej.id}`,
    (c) => c.referencia!.version,
  );
  const referencia = {
    formato: 1,
    version: vRef,
    version_ejercicio: `EJ-01@${ej.version}`,
    n_docentes: 3,
    metodo: {
      unidad: "evento",
      percentiles: { inferior: 10, superior: 90, estado: "[PROVISIONAL]" },
      factor_retencion: { valor: 1, estado: "[PROVISIONAL]" },
      parametros_rasgos: {},
    },
    bandas: bandas(eventos),
    rasgos_descartados: [],
    rasgos_sin_evaluar: [],
    origen: {
      campana: "A",
      rol: "docente_ref",
      origen_tomas: "real",
      tomas: ["D01-EJ01-JUN-60-R1"],
      version_nucleo: "0.9.0",
      versiones_reprocesamiento: ["1.2.0"],
      generada_en: "2027-02-01T12:00:00Z",
    },
  };
  const r1 = await api.post("/api/catalogo/referencias", { data: referencia, headers: CSRF });
  expect(r1.status(), await r1.text()).toBe(201);

  const vReglas = await siguienteVersion(
    api,
    "/api/catalogo/reglas/vigente",
    (c) => c.conjunto.version,
  );
  const conjunto = { ...JSON.parse(readFileSync(PLANTILLA, "utf8")), version: vReglas };
  const r2 = await api.post("/api/catalogo/reglas", { data: conjunto, headers: CSRF });
  expect(r2.status(), await r2.text()).toBe(201);
  return { referenciaId: (await r1.json()).id, reglasId: (await r2.json()).id };
}

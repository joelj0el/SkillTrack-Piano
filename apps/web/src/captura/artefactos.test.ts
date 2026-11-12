import {
  CODIGOS_INDICADOR,
  type ReferenciaVigente,
  type ReglasVigentes,
} from "@skilltrack/contracts";
import { describe, expect, it } from "vitest";
import { ErrorApi, SinConexion } from "../api.ts";
import { artefactosVigentes, cacheEnMemoria, type Descargar } from "./artefactos.ts";

// Datos SINTÉTICOS.
const PENDIENTE = "pendiente de aprobación del panel";
const reglas: ReglasVigentes = {
  id: 4,
  publicada_en: "2027-02-10T12:00:00Z",
  conjunto: {
    version: 2,
    version_taxonomia: "v0.1",
    indicadores: Object.fromEntries(
      CODIGOS_INDICADOR.map((c) => [
        c,
        c === "IND-A1"
          ? { clase: "ER-A", evaluable: true, motivo_no_evaluable: null, mensaje: PENDIENTE }
          : {
              clase: `ER-${c.charAt(4)}`,
              evaluable: false,
              motivo_no_evaluable: "Sin rasgo",
              mensaje: PENDIENTE,
            },
      ]),
    ) as ReglasVigentes["conjunto"]["indicadores"],
    reglas: [
      {
        id: "R-A1-01",
        indicador: "IND-A1",
        alcance: "evento",
        modalidad: "A",
        condicion: { tipo: "estado", dato: "nota", valores: ["incorrecta"] },
        minimo_eventos: 1,
      },
    ],
  },
};
const referencia = {
  id: 7,
  version_ejercicio_id: 1,
  publicada_en: "2027-02-01T12:00:00Z",
  referencia: {
    formato: 1,
    version: 1,
    version_ejercicio: "EJ-01@1",
    n_docentes: 3,
    metodo: {
      unidad: "evento",
      percentiles: { inferior: 10, superior: 90, estado: "[PROVISIONAL]" },
      factor_retencion: { valor: 1, estado: "[PROVISIONAL]" },
      parametros_rasgos: {},
    },
    bandas: [],
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
  },
} satisfies ReferenciaVigente;

function servidor(respuestas: Record<string, unknown>): { descargar: Descargar; rutas: string[] } {
  const rutas: string[] = [];
  const descargar: Descargar = async (ruta, esquema) => {
    rutas.push(ruta);
    const r = respuestas[ruta];
    if (r instanceof Error) throw r;
    if (r === undefined) throw new ErrorApi(404, "Sin publicar");
    return esquema.parse(r);
  };
  return { descargar, rutas };
}

describe("referencia y reglas vigentes", () => {
  it("PU-web-17: al abrir una tarea se descargan la referencia de su ejercicio y las reglas, y quedan en caché", async () => {
    const cache = cacheEnMemoria();
    const { descargar, rutas } = servidor({
      "/catalogo/referencias/vigente?version_ejercicio_id=1": referencia,
      "/catalogo/reglas/vigente": reglas,
    });
    const a = await artefactosVigentes(1, cache, descargar);
    expect(a).toEqual({ referencia, reglas });
    expect(rutas).toEqual([
      "/catalogo/referencias/vigente?version_ejercicio_id=1",
      "/catalogo/reglas/vigente",
    ]);
    // Sin red, se usa lo guardado.
    const sinRed = servidor({
      "/catalogo/referencias/vigente?version_ejercicio_id=1": new SinConexion(),
      "/catalogo/reglas/vigente": new SinConexion(),
    });
    expect(await artefactosVigentes(1, cache, sinRed.descargar)).toEqual({ referencia, reglas });
  });

  it("PU-web-18: sin nada publicado queda null; sin red y sin caché, también", async () => {
    const cache = cacheEnMemoria();
    expect(await artefactosVigentes(1, cache, servidor({}).descargar)).toEqual({
      referencia: null,
      reglas: null,
    });
    const sinRed = servidor({
      "/catalogo/referencias/vigente?version_ejercicio_id=2": new SinConexion(),
      "/catalogo/reglas/vigente": new SinConexion(),
    });
    expect(await artefactosVigentes(2, cacheEnMemoria(), sinRed.descargar)).toEqual({
      referencia: null,
      reglas: null,
    });
  });

  it("PU-web-19: una versión nueva publicada reemplaza a la guardada", async () => {
    const cache = cacheEnMemoria();
    const ruta = "/catalogo/reglas/vigente";
    await artefactosVigentes(1, cache, servidor({ [ruta]: reglas }).descargar);
    const nuevas = { ...reglas, id: 5, conjunto: { ...reglas.conjunto, version: 3 } };
    await artefactosVigentes(1, cache, servidor({ [ruta]: nuevas }).descargar);
    const sinRed = servidor({ [ruta]: new SinConexion() });
    expect((await artefactosVigentes(1, cache, sinRed.descargar)).reglas?.id).toBe(5);
  });
});

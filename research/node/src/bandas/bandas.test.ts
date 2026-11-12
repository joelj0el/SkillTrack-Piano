import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  ParametrosBandas,
  Referencia,
  ResultadoReproceso,
  type EventoResultado,
} from "@skilltrack/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ingerir } from "../ingesta/ingesta.ts";
import { prepararEsquema, type Base } from "../ingesta/registro.ts";
import { ROL_DOCENTE, tomasDeReferencia } from "./consulta.ts";
import { observacionesDeToma } from "./observaciones.ts";
import { construirReferencia, escribirReferencia, validacionV2 } from "./referencia.ts";

// Datos SINTÉTICOS: la planilla y los videos de fixtures/ingesta y resultados inventados.
const FIXTURES = resolve(import.meta.dirname, "../../fixtures/ingesta");
const PLANTILLA = resolve(import.meta.dirname, "parametros.plantilla.json");
const parametros = ParametrosBandas.parse(JSON.parse(readFileSync(PLANTILLA, "utf8")));

function evento(
  idx: number,
  mano: "MI" | "MD",
  ataque_ms: number,
  extra: { altura?: number; desfase?: number } = {},
): EventoResultado {
  return {
    idx,
    mano,
    midi_esperado: 60,
    dedo_esperado: 2,
    estado: "evaluado",
    motivo: null,
    ataque_ms,
    modalidad: "A",
    nota: { estado: "correcta", midi: 60, clase_oida: 0, modalidad: "A" },
    dedo: { valor: 2, estado: "correcto", modalidad: "V" },
    tecla: { midi: 60, zona: 0.3, modalidad: "V" },
    desfase_manos:
      extra.desfase === undefined
        ? null
        : { estado: "a-tiempo", ms: extra.desfase, mano_tarde: null, modalidad: "A" },
    rasgos: extra.altura === undefined ? {} : { "altura.indice": extra.altura },
    rasgos_modalidad: extra.altura === undefined ? null : "V",
  };
}

function resultado(
  codigo: string,
  eventos: EventoResultado[],
  cambioPct: number | null,
  nucleo = "0.9.0",
): ResultadoReproceso {
  const sha = "0".repeat(64);
  return ResultadoReproceso.parse({
    version: 1,
    codigo_toma: codigo,
    origen: "real",
    versiones: {
      nucleo,
      modelo_mano: "m@1",
      ejercicio: "EJ-01@1",
      referencia: null,
      reglas: null,
      clasificador: null,
      reprocesamiento: "1.2.0",
    },
    secuencia_esperada: "partitura",
    calibracion: { sesion: "s", clip: "CAL-digital-1" },
    video: {
      archivo: "v.mp4",
      sha256: sha,
      codec_video: "h264",
      codec_audio: "aac",
      ancho: 1280,
      alto: 720,
      duracion_s: 10,
    },
    deteccion: { delegado: "CPU", fotogramas: 300, con_manos: 300, perdidos: 0 },
    landmarks_sha256: sha,
    audio_events_sha256: sha,
    analisis: {
      notas: [],
      visuales: [],
      acustico: cambioPct === null ? null : { tempo: { cambioPct } },
      eventos,
    },
    porcentaje_evaluable: 100,
    evaluable: { planilla: true, analisis: true, final: true },
  });
}

/** Una toma de un docente: semicorcheas a 250 ms, con su forma de tocar. */
function toma(docente: string, k: number, altura: number, desfase: number, cambio: number) {
  const eventos = [0, 1, 2, 3].map((i) =>
    evento(i, "MD", i * 250 + (i === 2 ? 10 : 0), { altura: altura + k, desfase: desfase + k }),
  );
  return { docente, resultado: resultado(`${docente}-EJ01-JUN-60-R${k + 1}`, eventos, cambio) };
}

describe("tomas de referencia en la base de investigación", () => {
  let pg: PGlite;
  let base: Base;
  beforeAll(async () => {
    pg = new PGlite();
    base = { consulta: (sql, p) => pg.query(sql, p) as ReturnType<Base["consulta"]> };
    await prepararEsquema(base);
    await ingerir({
      entrada: FIXTURES,
      salida: mkdtempSync(join(tmpdir(), "bandas-")),
      fecha: "2026-11-09",
      base,
    });
  }, 60_000);
  afterAll(() => pg.close());

  it("PU-research-65: la consulta usa el rol que guarda la ingesta y solo toma la Campaña A real", async () => {
    const { rows } = await pg.query<{ rol: string }>(
      "SELECT rol FROM participante WHERE seudonimo = 'D01'",
    );
    expect(rows[0]!.rol).toBe(ROL_DOCENTE);
    const tomas = await tomasDeReferencia(base, "EJ-01@1");
    // La toma actuada de D01 y las del estudiante quedan fuera.
    expect(tomas.map((t) => [t.codigo_toma, t.docente])).toEqual([["D01-EJ01-JUN-60-R1", "D01"]]);
    expect(tomas[0]!.ruta).toMatch(/PAQ-D01-EJ01-JUN-60-R1$/);
  });
});

describe("referencia por consenso", () => {
  it("PU-research-66: de cada toma salen rasgos, desfase y desvío por evento, y el cambio de tempo", () => {
    const { docente, resultado: r } = toma("D01", 0, 1, 20, 3);
    const obs = observacionesDeToma(docente, r);
    const de = (unidad: string, rasgo: string) =>
      obs.filter((o) => o.unidad === unidad && o.rasgo === rasgo).map((o) => o.valor);
    expect(de("e0", "altura.indice")).toEqual([1]);
    expect(de("e3", "desfase_manos.ms")).toEqual([20]);
    // e2 llega 10 ms tarde sobre un intervalo local de 250 ms: +4 %; e1 queda antes (−2 %).
    expect(de("e2", "ataque.desvio_pct")[0]).toBeCloseTo(4);
    expect(de("e1", "ataque.desvio_pct")[0]).toBeCloseTo((-5 / 255) * 100);
    expect(de("e0", "ataque.desvio_pct")).toEqual([]);
    expect(de("ejecucion", "cambio_tempo.pct")).toEqual([3]);
  });

  it("PU-research-67: el rasgo ruidoso entre docentes se descarta con su motivo; sin diferencia buscada, no se evalúa", () => {
    // El desfase entre manos varía 200 ms de un docente a otro (PRM-11 busca 50 ms); el cambio de
    // tempo apenas 1 %. La altura no tiene diferencia buscada documentada.
    const tomas = ["D01", "D02", "D03"].flatMap((d, i) => [
      toma(d, 0, 1, 200 * i, 2 + i * 0.5),
      toma(d, 1, 1, 200 * i, 2 + i * 0.5),
    ]);
    const ref = construirReferencia({
      tomas,
      parametros,
      version: 1,
      versionEjercicio: "EJ-01@1",
      generadaEn: "2027-02-01T12:00:00Z",
    });
    expect(Referencia.safeParse(ref).success).toBe(true);
    expect(ref.n_docentes).toBe(3);
    expect(ref.rasgos_descartados.map((d) => d.rasgo)).toEqual(["desfase_manos.ms"]);
    expect(ref.rasgos_descartados[0]!.motivo).toMatch(/comparable a la diferencia buscada/);
    expect(ref.bandas.some((b) => b.rasgo === "desfase_manos.ms")).toBe(false);
    expect(ref.bandas.some((b) => b.rasgo === "cambio_tempo.pct")).toBe(true);
    const pendiente = "Diferencia buscada PENDIENTE: no se evalúa la retención";
    expect(ref.rasgos_sin_evaluar).toEqual([
      { rasgo: "altura.indice", motivo: pendiente },
      { rasgo: "tecla.zona", motivo: pendiente },
    ]);
    expect(ref.bandas.some((b) => b.rasgo === "altura.indice")).toBe(true);
    expect(ref.origen.tomas).toHaveLength(6);
    expect(ref.origen.rol).toBe("docente_ref");
  });

  it("PU-research-68: la plantilla de parámetros marca los PRM como provisionales y el resto como PENDIENTE", () => {
    const rasgos = Object.entries(parametros.rasgos);
    for (const [, p] of rasgos) {
      expect(p.fuente === null ? "PENDIENTE" : "[PROVISIONAL]").toBe(p.estado);
      expect(p.diferencia_buscada === null).toBe(p.estado === "PENDIENTE");
    }
    expect(rasgos.filter(([, p]) => p.fuente).map(([, p]) => p.fuente)).toEqual([
      "PRM-09",
      "PRM-10",
      "PRM-11",
    ]);
    expect(parametros.percentiles).toEqual({ inferior: 10, superior: 90, estado: "[PROVISIONAL]" });
    expect(parametros.factor_retencion).toEqual({ valor: 1, estado: "[PROVISIONAL]" });
  });

  it("PU-research-69: no mezcla tomas de núcleos distintos ni de otro ejercicio", () => {
    const a = toma("D01", 0, 1, 0, 0);
    const b = { docente: "D02", resultado: resultado("D02-X", [], null, "0.8.0") };
    const pedido = { parametros, version: 1, generadaEn: "2027-02-01T12:00:00Z" };
    expect(() =>
      construirReferencia({ ...pedido, tomas: [a, b], versionEjercicio: "EJ-01@1" }),
    ).toThrow(/núcleos distintos/);
    expect(() =>
      construirReferencia({ ...pedido, tomas: [a], versionEjercicio: "EJ-02@1" }),
    ).toThrow(/otro ejercicio/);
  });

  it("PU-research-70: una versión escrita de la referencia no se reemplaza", async () => {
    const ref = construirReferencia({
      tomas: [toma("D01", 0, 1, 0, 0), toma("D02", 0, 1, 0, 0)],
      parametros,
      version: 3,
      versionEjercicio: "EJ-01@1",
      generadaEn: "2027-02-01T12:00:00Z",
    });
    const carpeta = mkdtempSync(join(tmpdir(), "ref-"));
    const ruta = await escribirReferencia(carpeta, ref);
    expect(ruta).toMatch(/referencia-EJ-01_1-v3\.json$/);
    expect(Referencia.parse(JSON.parse(readFileSync(ruta, "utf8")))).toEqual(ref);
    await expect(escribirReferencia(carpeta, ref)).rejects.toThrow(/Ya existe/);
  });
});

describe("V2 dejando un docente fuera", () => {
  it("PU-research-71: el docente que se aparta de los demás queda fuera de sus bandas", () => {
    // D04 se aparta (8 % frente a 2–3 %) sin que la dispersión entre docentes descarte el rasgo.
    const tomas = [
      ...["D01", "D02", "D03"].flatMap((d, i) => [
        toma(d, 0, 1, 0, 2 + i * 0.5),
        toma(d, 1, 1, 0, 2 + i * 0.5),
      ]),
      toma("D04", 0, 1, 0, 8),
    ];
    const ref = construirReferencia({
      tomas,
      parametros,
      version: 1,
      versionEjercicio: "EJ-01@1",
      generadaEn: "2027-02-01T12:00:00Z",
    });
    const v2 = validacionV2(tomas, ref);
    expect(v2.n_docentes).toBe(4);
    const cambio = (d: string) =>
      v2.por_docente
        .find((x) => x.docente === d)!
        .por_rasgo.find((r) => r.rasgo === "cambio_tempo.pct")!;
    expect(cambio("D04")).toEqual({
      rasgo: "cambio_tempo.pct",
      dentro: 0,
      total: 1,
      porcentaje: 0,
    });
    expect(cambio("D02").porcentaje).toBe(100);
  });
});

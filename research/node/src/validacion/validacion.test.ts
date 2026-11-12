import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import {
  ConjuntoReglas,
  ParametrosBandas,
  ResultadoReproceso,
  type EventoResultado,
} from "@skilltrack/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { construirReferencia } from "../bandas/referencia.ts";
import { ingerir } from "../ingesta/ingesta.ts";
import { prepararEsquema, type Base } from "../ingesta/registro.ts";
import { CLASES_ERROR } from "../ingesta/validar.ts";
import {
  concordanciaEtiquetadores,
  concordanciaReglas,
  type Origen,
  type TomaEtiquetada,
} from "./concordancia.ts";
import { etiquetasDelEjercicio, tomasDelEjercicio } from "./consulta.ts";
import { consensoDe, consensos, type FilaEtiqueta } from "./etiquetas.ts";
import { tablaEtiquetadores, tablaReglas, tablaV2 } from "./informe.ts";
import { kappaDeCohen, kappaDeFleiss } from "./kappa.ts";
import { v2PorOrigen } from "./v2.ts";

// Datos SINTÉTICOS: tomas, etiquetas y bandas inventadas; la planilla de fixtures/ingesta.
const PLANTILLA = resolve(import.meta.dirname, "../bandas/parametros.plantilla.json");
const FIXTURES = resolve(import.meta.dirname, "../../fixtures/ingesta");
const REGLAS = ConjuntoReglas.parse(
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, "../../../../tools/catalogo/conjunto_reglas.v1.json"),
      "utf8",
    ),
  ),
);

function evento(idx: number, cambios: Partial<EventoResultado> = {}): EventoResultado {
  return {
    idx,
    mano: "MD",
    midi_esperado: 60 + idx,
    dedo_esperado: 2,
    estado: "evaluado",
    motivo: null,
    ataque_ms: idx * 250,
    modalidad: "VA",
    nota: {
      estado: "correcta",
      midi: 60 + idx,
      clase_oida: idx % 12,
      modalidad: "VA",
    },
    dedo: { valor: 2, estado: "correcto", modalidad: "V" },
    tecla: { midi: 60 + idx, zona: 0.3, modalidad: "V" },
    desfase_manos: null,
    rasgos: {},
    rasgos_modalidad: null,
    ...cambios,
  };
}

function resultado(codigo: string, eventos: EventoResultado[]): ResultadoReproceso {
  const sha = "0".repeat(64);
  return ResultadoReproceso.parse({
    version: 1,
    codigo_toma: codigo,
    origen: "real",
    versiones: {
      nucleo: "0.9.0",
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
    deteccion: {
      delegado: "CPU",
      fotogramas: 300,
      con_manos: 300,
      perdidos: 0,
    },
    landmarks_sha256: sha,
    audio_events_sha256: sha,
    analisis: { notas: [], visuales: [], acustico: null, eventos },
    porcentaje_evaluable: 100,
    evaluable: { planilla: true, analisis: true, final: true },
  });
}

const escala = (cambios: Record<number, Partial<EventoResultado>> = {}) =>
  [0, 1, 2, 3, 4, 5].map((i) => evento(i, cambios[i]));
const teclaEquivocada = {
  2: {
    nota: { estado: "incorrecta", midi: 65, clase_oida: 5, modalidad: "A" },
  },
} as const;

const REFERENCIA = {
  version: 1,
  bandas: [0, 1, 2, 3, 4, 5].flatMap((i) => [
    {
      unidad: `e${i}`,
      rasgo: "tecla.zona",
      inferior: 0.2,
      superior: 0.6,
      centro: 0.4,
    },
    {
      unidad: `e${i}`,
      rasgo: "ataque.desvio_pct",
      inferior: -15,
      superior: 15,
      centro: 0,
    },
  ]),
};

function toma(
  codigo: string,
  participante: string,
  origen: Origen,
  eventos: EventoResultado[],
): TomaEtiquetada {
  return {
    codigo_toma: codigo,
    participante,
    origen,
    resultado: resultado(codigo, eventos),
  };
}

/** Dos etiquetadores (ronda doble) con las clases que cada uno marcó. */
function dobles(codigo: string, marca1: string[], marca2: string[] = marca1): FilaEtiqueta[] {
  return CLASES_ERROR.flatMap((clase) => [
    {
      codigo_toma: codigo,
      etiquetador: "ETQ-1",
      clase_error: clase,
      presente: marca1.includes(clase),
      ronda: "doble" as const,
    },
    {
      codigo_toma: codigo,
      etiquetador: "ETQ-2",
      clase_error: clase,
      presente: marca2.includes(clase),
      ronda: "doble" as const,
    },
  ]);
}

const TOMAS = [
  toma("E01-R1", "E01", "real", escala(teclaEquivocada)),
  toma("E02-R1", "E02", "real", escala()),
  toma("E03-R1", "E03", "real", escala(teclaEquivocada)),
  toma("E04-ACT", "E04", "actuado", escala(teclaEquivocada)),
];
const ETIQUETAS = [
  ...dobles("E01-R1", ["ER-A"]),
  ...dobles("E02-R1", []),
  // Las reglas detectan la tecla equivocada, pero los etiquetadores no la marcaron;
  // en el ritmo no se pusieron de acuerdo.
  ...dobles("E03-R1", [], ["ER-B"]),
  ...dobles("E04-ACT", ["ER-A"]),
];

describe("V3a y V3b: concordancia de las reglas con las etiquetas", () => {
  it("PU-research-72: κ de Cohen y de Fleiss coinciden con el cálculo a mano y quedan indefinidos sin variación", () => {
    const pares: [boolean, boolean][] = [
      ...Array<[boolean, boolean]>(20).fill([true, true]),
      ...Array<[boolean, boolean]>(5).fill([true, false]),
      ...Array<[boolean, boolean]>(10).fill([false, true]),
      ...Array<[boolean, boolean]>(15).fill([false, false]),
    ];
    const c = kappaDeCohen(pares);
    expect(c.n).toBe(50);
    expect(c.acuerdo).toBeCloseTo(0.7);
    expect(c.kappa).toBeCloseTo(0.4);
    expect(
      kappaDeCohen([
        [true, true],
        [true, true],
      ]).kappa,
    ).toBeNull();
    expect(kappaDeCohen([]).acuerdo).toBeNull();
    const f = kappaDeFleiss([
      [true, true],
      [false, false],
      [true, false],
      [false, false],
    ]);
    expect(f.acuerdo).toBeCloseTo(0.75);
    expect(f.kappa).toBeCloseTo(0.4667, 3);
  });

  it("PU-research-73: el consenso lo decide el desempate; sin él, todos deben coincidir y la ronda piloto no cuenta", () => {
    const c = consensos([
      ...dobles("T1", ["ER-A"], []),
      {
        codigo_toma: "T1",
        etiquetador: "ETQ-3",
        clase_error: "ER-A",
        presente: true,
        ronda: "desempate",
      },
      ...dobles("T2", ["ER-A"], []),
      {
        codigo_toma: "T3",
        etiquetador: "ETQ-1",
        clase_error: "ER-A",
        presente: true,
        ronda: "simple",
      },
      {
        codigo_toma: "T4",
        etiquetador: "ETQ-1",
        clase_error: "ER-A",
        presente: true,
        ronda: "piloto",
      },
    ]);
    expect(consensoDe(c, "T1", "ER-A")).toEqual({
      tipo: "consenso",
      presente: true,
    });
    expect(consensoDe(c, "T2", "ER-A")).toEqual({ tipo: "sin-consenso" });
    expect(consensoDe(c, "T2", "ER-C")).toEqual({
      tipo: "consenso",
      presente: false,
    });
    expect(consensoDe(c, "T3", "ER-A")).toEqual({
      tipo: "consenso",
      presente: true,
    });
    expect(consensoDe(c, "T4", "ER-A")).toEqual({ tipo: "sin-etiqueta" });
  });

  it("PU-research-74: V3a separa los orígenes, calcula κ solo con etiquetas reales y no evalúa E ni F", () => {
    const filas = concordanciaReglas(TOMAS, ETIQUETAS, REFERENCIA, REGLAS, "VA", CLASES_ERROR);
    const fila = (origen: Origen, clase: string) =>
      filas.find((f) => f.origen === origen && f.clase === clase)!;
    const a = fila("real", "ER-A");
    expect([a.n, a.participantes, a.positivos, a.detectados]).toEqual([3, 3, 1, 2]);
    expect(a.concordancia.acuerdo).toBeCloseTo(2 / 3);
    expect(a.concordancia.kappa).toBeCloseTo(0.4);
    expect(fila("real", "ER-B").sin_consenso).toBe(1);
    const actuado = fila("actuado", "ER-A");
    expect([actuado.n, actuado.concordancia.acuerdo, actuado.concordancia.kappa]).toEqual([
      1,
      1,
      null,
    ]);
    for (const clase of ["ER-E", "ER-F"]) {
      expect(fila("real", clase).evaluable).toBe(false);
      expect(fila("real", clase).motivo).toMatch(/No evaluable por diseño/);
    }
    expect(filas.some((f) => f.origen === "sintetico")).toBe(false);

    const md = tablaReglas("V3a", filas);
    expect(md).toContain("## Origen: real");
    expect(md).toContain("## Origen: actuado");
    expect(md).toMatch(
      /\| ER-A \| 3 \| 3 \| 1 \| 2 \| 0 \| 66\.7 % \| 0\.40 \| n chico: 3 participantes \(< 20\); n chico: 1 casos con la clase \(< 8\) \|/,
    );
    expect(md).toMatch(/\| ER-A \| 1 \| 1 \| 1 \| 1 \| 0 \| 100\.0 % \| no aplica \|/);
  });

  it("PU-research-75: V3b compara V, A y VA; sin visión la digitación no se evalúa y sin audio la nota tampoco", () => {
    const filas = (["V", "A", "VA"] as const).flatMap((modo) =>
      concordanciaReglas(TOMAS, ETIQUETAS, REFERENCIA, REGLAS, modo, CLASES_ERROR),
    );
    const fila = (modo: string, clase: string) =>
      filas.find((f) => f.origen === "real" && f.modo === modo && f.clase === clase)!;
    expect(fila("A", "ER-C").evaluable).toBe(false);
    expect(fila("V", "ER-A").evaluable).toBe(false);
    expect(fila("VA", "ER-A").n).toBe(3);
    expect(tablaReglas("V3b", filas)).toContain("| Modo | Clase |");
  });

  it("PU-research-76: κ entre etiquetadores (Fleiss, ronda doble) solo con etiquetas reales", () => {
    const filas = concordanciaEtiquetadores(TOMAS, ETIQUETAS, CLASES_ERROR);
    const b = filas.find((f) => f.origen === "real" && f.clase === "ER-B")!;
    expect(b.n).toBe(3);
    expect(b.concordancia.acuerdo).toBeCloseTo(2 / 3);
    expect(
      filas.find((f) => f.origen === "actuado" && f.clase === "ER-A")!.concordancia.kappa,
    ).toBeNull();
    const md = tablaEtiquetadores(filas);
    expect(md).toContain("κ de Fleiss");
    expect(md).toMatch(/\| ER-A \| 1 \| 100\.0 % \| no aplica \| n chico \(< 8\) \|/);
  });
});

describe("V2 por origen", () => {
  it("PU-research-77: cada origen se valida con sus propios docentes y avisa con menos de 5 docentes", () => {
    const de = (docente: string, origen: Origen, zona: number) => ({
      docente,
      origen,
      resultado: resultado(
        `${docente}-${origen}`,
        escala({ 0: { tecla: { midi: 60, zona, modalidad: "V" } } }),
      ),
    });
    const tomas = [
      de("D01", "real", 0.3),
      de("D02", "real", 0.31),
      de("D03", "real", 0.32),
      de("D04", "actuado", 0.3),
    ];
    const ref = construirReferencia({
      tomas: tomas.filter((t) => t.origen === "real"),
      parametros: ParametrosBandas.parse(JSON.parse(readFileSync(PLANTILLA, "utf8"))),
      version: 1,
      versionEjercicio: "EJ-01@1",
      generadaEn: "2026-11-12T00:00:00Z",
    });
    const grupos = v2PorOrigen(tomas, ref);
    expect(grupos.map((g) => [g.origen, g.n_tomas, g.informe.n_docentes])).toEqual([
      ["real", 3, 3],
      ["actuado", 1, 1],
    ]);
    const md = tablaV2(grupos);
    expect(md).toContain("> Aviso: n chico, 3 docentes (la referencia pide al menos 5).");
    expect(md).toContain("## Origen: actuado");
    expect(md).toMatch(/\| D01 \| tecla\.zona \| \d+ \/ \d+ \| [\d.]+ % \|/);
  });
});

describe("lecturas de la base de investigación", () => {
  let pg: PGlite;
  let base: Base;
  beforeAll(async () => {
    pg = new PGlite();
    base = {
      consulta: (sql, p) => pg.query(sql, p) as ReturnType<Base["consulta"]>,
    };
    await prepararEsquema(base);
    await ingerir({
      entrada: FIXTURES,
      salida: mkdtempSync(join(tmpdir(), "validacion-")),
      fecha: "2026-11-09",
      base,
    });
  }, 60_000);
  afterAll(() => pg.close());

  it("PU-research-78: las tomas llegan con su origen y las etiquetas con su etiquetador y su ronda", async () => {
    const tomas = await tomasDelEjercicio(base, "EJ-01@1");
    expect(tomas.length).toBeGreaterThan(0);
    expect(new Set(tomas.map((t) => t.origen))).toContain("real");
    const etiquetas = await etiquetasDelEjercicio(base, "EJ-01@1");
    expect(etiquetas.length).toBeGreaterThan(0);
    for (const e of etiquetas) {
      expect(CLASES_ERROR).toContain(e.clase_error);
      expect(["simple", "doble", "desempate", "piloto"]).toContain(e.ronda);
      expect(tomas.map((t) => t.codigo_toma)).toContain(e.codigo_toma);
    }
  });
});

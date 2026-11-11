import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { appendFile, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { ResultadoReproceso } from "@skilltrack/contracts";
import { VERSION_NUCLEO, type RespuestaAnalisis } from "@skilltrack/core";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { prepararEsquema, type Base } from "../ingesta/registro.ts";
import { leerCodecs } from "./codecs.ts";
import { crearServidorReproceso } from "./servidor.ts";
import {
  ErrorReproceso,
  reprocesar,
  type Comprobacion,
  type PedidoProceso,
  type Procesador,
  type SalidaProceso,
} from "./reprocesar.ts";

const CLIP = resolve(import.meta.dirname, "../../fixtures/calibracion/CAL-digital-1.mp4");
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

let carpeta: string;
let db: PGlite;
let base: Base;

const analisis = (detectadas: number, total: number): RespuestaAnalisis => ({
  visuales: [],
  acustico: null,
  porMano: null,
  eventos: [],
  duracionAnalisisMs: 1,
  notas: Array.from({ length: total }, (_, idx) => ({
    idx,
    mano: "MD" as const,
    midiEsperado: 60,
    resultado:
      idx < detectadas
        ? { estado: "detectada" as const, dedo: "indice" as const, t: idx }
        : {
            estado: "no-evaluable" as const,
            motivo: "sin evento visual" as const,
          },
  })),
});

const salida = (detectadas = 10, total = 10): SalidaProceso => ({
  ancho: 640,
  alto: 400,
  duracion_s: 1,
  delegado: "CPU",
  perdidos: 0,
  fotogramas: [
    { t: 0, manos: [] },
    { t: 0.033, manos: [] },
  ],
  analisis: analisis(detectadas, total),
  audio: { pista: false, motivo: "sin pista", tasa_hz: null },
});

function falso(opciones: {
  salida?: (ruta: string) => SalidaProceso;
  comprobar?: (ruta: string) => Comprobacion;
  version?: string;
}) {
  const procesadas: string[] = [];
  const pedidos: PedidoProceso[] = [];
  const procesador: Procesador = {
    version_modelo: opciones.version ?? "modelo@1",
    comprobar: async (ruta) =>
      opciones.comprobar?.(ruta) ?? {
        decodificable: true,
        ancho: 640,
        alto: 400,
        duracion_s: 1,
      },
    procesar: async (ruta, pedido) => {
      procesadas.push(ruta);
      pedidos.push(pedido);
      return (opciones.salida ?? (() => salida()))(ruta);
    },
    cerrar: async () => {},
  };
  return { procesador, procesadas, pedidos };
}

async function crearToma(codigo: string, evaluable = "si"): Promise<void> {
  const ruta = join(carpeta, `PAQ-${codigo}`);
  await mkdir(ruta);
  await copyFile(CLIP, join(ruta, "video.mp4"));
  const video = await readFile(join(ruta, "video.mp4"));
  const meta = `${JSON.stringify({
    tipo: "ejecucion",
    codigo_toma: codigo,
    origen: "real",
    campos: { instrumento: "digital", hora: "18:00", evaluable, tempo: "60" },
    video: { archivo: "video.mp4", sha256: sha(video) },
    versiones: { ejercicio: "EJ-01@1" },
  })}\n`;
  await writeFile(join(ruta, "meta.json"), meta);
  await writeFile(join(ruta, "sha256.txt"), `${sha(video)}  video.mp4\n${sha(meta)}  meta.json\n`);
  await db.query(
    `INSERT INTO ejecucion (codigo_toma, participante, version_ejercicio, sesion, campana, manos,
       tempo_elegido_bpm, modo_metronomo, paquete_sha256, ruta, evaluable, origen)
     VALUES ($1, 'E01', 'EJ-01@1', 1, 'B', 'juntas', 60, 'sin', 'x', 'y', $2, 'real')`,
    [codigo, evaluable === "si"],
  );
}

async function calibrar(tomas: string[], ancho = 640, alto = 400): Promise<void> {
  const punto = { x: 1, y: 2 };
  await writeFile(
    join(carpeta, "calibracion-2026-11-09-digital-1.json"),
    JSON.stringify({
      version: 1,
      sesion: "2026-11-09-digital-1",
      clip: "CAL-digital-1",
      instrumento: "digital",
      video: {
        archivo: "CAL-digital-1.mp4",
        sha256: "a".repeat(64),
        ancho,
        alto,
      },
      tiempo_fotograma_s: 0,
      rango: { min: 48, max: 84 },
      toques: {
        frenteIzquierda: punto,
        frenteDerecha: punto,
        negrasIzquierda: punto,
        negrasDerecha: punto,
      },
      homografia: [1, 0, 0, 0, 1, 0, 0, 0, 1],
      version_nucleo: VERSION_NUCLEO,
      guardada_en: "2026-11-09T18:00:00.000Z",
      tomas,
    }),
  );
}

const evaluableEnBase = async (codigo: string) =>
  (
    await db.query<{ evaluable: boolean }>("SELECT evaluable FROM ejecucion WHERE codigo_toma=$1", [
      codigo,
    ])
  ).rows[0]!.evaluable;

const leerResultado = (codigo: string) =>
  ResultadoReproceso.parse(
    JSON.parse(readFileSync(join(carpeta, `PAQ-${codigo}`, "resultado.json"), "utf8")),
  );

const A = "E01-EJ01-JUN-60-R1";
const B = "E01-EJ01-JUN-60-R2";
const C = "E01-EJ01-JUN-60-R3";

beforeAll(async () => {
  db = new PGlite();
  base = { consulta: (sql, p) => db.query(sql, p) as never };
  await prepararEsquema(base);
}, 60_000);

afterAll(async () => {
  await db.close();
});

beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), "reproceso-"));
  await db.exec(`
    TRUNCATE ejecucion, sesion_grabacion, participante RESTART IDENTITY CASCADE;
    INSERT INTO participante (seudonimo, rol) VALUES ('E01', 'estudiante');
    INSERT INTO sesion_grabacion (fecha, instrumento) VALUES ('2026-11-09', 'digital');
  `);
});

afterEach(async () => {
  await rm(carpeta, { recursive: true, force: true });
});

describe("códec del video", () => {
  it("PU-research-47: lee el formato de las pistas de un MP4", async () => {
    const codecs = await leerCodecs(CLIP);
    expect(codecs).toMatchObject({ video: "avc1", audio: "mp4a" });
    // El clip sintético dura 1 s a 30 fotogramas por segundo.
    expect(codecs.tiempos).toHaveLength(30);
    expect(codecs.tiempos![0]).toBeCloseTo(1 / 60, 6);
    expect(codecs.tiempos![29]).toBeCloseTo(59 / 60, 6);
  });

  it("PU-research-48: en otro contenedor no adivina y deja decidir al navegador", async () => {
    const otro = join(carpeta, "video.webm");
    await writeFile(otro, Buffer.alloc(64, 7));
    expect(await leerCodecs(otro)).toEqual({ video: null, audio: null, tiempos: null });
  });
});

describe("reprocesamiento", () => {
  it("PU-research-49: escribe los tres archivos con sus versiones y actualiza la base", async () => {
    await crearToma(A);
    await calibrar([A]);
    const r = await reprocesar({
      carpeta,
      base,
      procesador: falso({}).procesador,
    });
    expect(r.procesadas.map((p) => p.codigo)).toEqual([A]);
    const paquete = join(carpeta, `PAQ-${A}`);
    const lineas = readFileSync(join(paquete, "landmarks.jsonl"), "utf8").trim().split("\n");
    expect(lineas).toHaveLength(2);
    expect(JSON.parse(readFileSync(join(paquete, "audio_events.json"), "utf8")).pista).toBe(false);
    const resultado = leerResultado(A);
    expect(resultado.versiones).toMatchObject({
      nucleo: VERSION_NUCLEO,
      modelo_mano: "modelo@1",
      ejercicio: "EJ-01@1",
      referencia: null,
    });
    expect(resultado.video.codec_video).toBe("avc1");
    expect(resultado.landmarks_sha256).toBe(sha(readFileSync(join(paquete, "landmarks.jsonl"))));
    expect(resultado.evaluable).toEqual({
      planilla: true,
      analisis: true,
      final: true,
    });
    expect(await evaluableEnBase(A)).toBe(true);
  });

  it("PU-research-50: por debajo del 70 % la toma deja de ser evaluable", async () => {
    await crearToma(A);
    await calibrar([A]);
    const procesador = falso({ salida: () => salida(6, 10) }).procesador;
    await reprocesar({ carpeta, base, procesador });
    expect(leerResultado(A).porcentaje_evaluable).toBe(60);
    expect(await evaluableEnBase(A)).toBe(false);
  });

  it("PU-research-51: una toma marcada no evaluable en la planilla nunca pasa a serlo", async () => {
    await crearToma(A, "no");
    await calibrar([A]);
    await reprocesar({ carpeta, base, procesador: falso({}).procesador });
    expect(leerResultado(A).evaluable).toEqual({
      planilla: false,
      analisis: true,
      final: false,
    });
    expect(await evaluableEnBase(A)).toBe(false);
  });

  it("PU-research-52: si una toma falla sigue con las demás y al reanudar repite solo esa", async () => {
    for (const c of [A, B, C]) await crearToma(c);
    await calibrar([A, B, C]);
    let falla = true;
    const primero = falso({
      salida: (ruta) => {
        if (falla && ruta.includes(B)) throw new Error("se cortó");
        return salida();
      },
    });
    const r1 = await reprocesar({
      carpeta,
      base,
      procesador: primero.procesador,
    });
    expect(r1.procesadas.map((p) => p.codigo)).toEqual([A, C]);
    expect(r1.fallidas).toEqual([{ codigo: B, motivo: "se cortó" }]);
    expect(existsSync(join(carpeta, `PAQ-${B}`, "resultado.json"))).toBe(false);

    falla = false;
    const segundo = falso({});
    const r2 = await reprocesar({
      carpeta,
      base,
      procesador: segundo.procesador,
    });
    expect(r2.procesadas.map((p) => p.codigo)).toEqual([B]);
    expect(r2.ya_hechas).toEqual([A, C]);
    expect(segundo.procesadas).toHaveLength(1);
  });

  it("PU-research-53: un corte antes de resultado.json no deja la toma como terminada", async () => {
    await crearToma(A);
    await calibrar([A]);
    const baseCaida: Base = {
      consulta: async () => {
        throw new Error("sin conexión");
      },
    };
    const r1 = await reprocesar({
      carpeta,
      base: baseCaida,
      procesador: falso({}).procesador,
    });
    expect(r1.fallidas.map((f) => f.codigo)).toEqual([A]);
    const paquete = join(carpeta, `PAQ-${A}`);
    expect(existsSync(join(paquete, "resultado.json"))).toBe(false);
    expect(existsSync(join(paquete, "resultado.json.tmp"))).toBe(false);
    const r2 = await reprocesar({ carpeta, procesador: falso({}).procesador });
    expect(r2.procesadas.map((p) => p.codigo)).toEqual([A]);
  });

  it("PU-research-54: con otra versión del modelo la toma se repite", async () => {
    await crearToma(A);
    await calibrar([A]);
    await reprocesar({ carpeta, procesador: falso({}).procesador });
    const r = await reprocesar({
      carpeta,
      procesador: falso({ version: "modelo@2" }).procesador,
    });
    expect(r.procesadas.map((p) => p.codigo)).toEqual([A]);
  });

  it("PU-research-55: un video que no se decodifica se informa con su códec y no se procesa", async () => {
    await crearToma(A);
    await crearToma(B);
    await calibrar([A, B]);
    const f = falso({
      comprobar: (ruta) =>
        ruta.includes(A)
          ? { decodificable: false, motivo: "formato o códec no admitido" }
          : { decodificable: true, ancho: 640, alto: 400, duracion_s: 1 },
    });
    const r = await reprocesar({ carpeta, base, procesador: f.procesador });
    expect(r.no_decodificables).toEqual([
      {
        codigo: A,
        codec_video: "avc1",
        codec_audio: "mp4a",
        motivo: "formato o códec no admitido",
      },
    ]);
    expect(r.procesadas.map((p) => p.codigo)).toEqual([B]);
    expect(existsSync(join(carpeta, `PAQ-${A}`, "landmarks.jsonl"))).toBe(false);
    expect(await evaluableEnBase(A)).toBe(true);
  });

  it("PU-research-56: sin calibración o con otro tamaño de imagen se informa y no se procesa", async () => {
    await crearToma(A);
    await crearToma(B);
    await calibrar([A], 1920, 1080);
    const f = falso({});
    const r = await reprocesar({ carpeta, procesador: f.procesador });
    expect(r.procesadas).toEqual([]);
    expect(r.sin_calibracion.map((s) => s.codigo)).toEqual([A, B]);
    expect(r.sin_calibracion[0]!.motivo).toContain("1920x1080");
    expect(f.procesadas).toEqual([]);
  });

  it("PU-research-57: un paquete alterado se rechaza", async () => {
    await crearToma(A);
    await calibrar([A]);
    await appendFile(join(carpeta, `PAQ-${A}`, "video.mp4"), "x");
    const f = falso({});
    const r = await reprocesar({ carpeta, procesador: f.procesador });
    expect(r.paquetes_rechazados.map((p) => p.codigo)).toEqual([A]);
    expect(f.procesadas).toEqual([]);
  });

  it("PU-research-58: --solo procesa esa toma aunque ya esté hecha, y solo esa", async () => {
    await crearToma(A);
    await crearToma(B);
    await calibrar([A, B]);
    await reprocesar({ carpeta, procesador: falso({}).procesador, solo: A });
    expect(existsSync(join(carpeta, `PAQ-${B}`, "resultado.json"))).toBe(false);
    const f = falso({});
    const r = await reprocesar({ carpeta, procesador: f.procesador, solo: A });
    expect(r.procesadas.map((p) => p.codigo)).toEqual([A]);
    await expect(
      reprocesar({
        carpeta,
        procesador: falso({}).procesador,
        solo: "E09-EJ01-JUN-60-R1",
      }),
    ).rejects.toBeInstanceOf(ErrorReproceso);
  });

  it("PU-research-59: el reporte queda escrito aunque el lote no termine bien", async () => {
    await crearToma(A);
    await reprocesar({ carpeta, procesador: falso({}).procesador });
    const reporte = JSON.parse(readFileSync(join(carpeta, "reporte-reproceso.json"), "utf8"));
    expect(reporte.sin_calibracion.map((s: { codigo: string }) => s.codigo)).toEqual([A]);
  });
});

describe("servidor local del reprocesamiento", () => {
  async function conServidor(
    prueba: (url: string, publicar: (r: string) => string) => Promise<void>,
  ) {
    const { servidor, publicar } = crearServidorReproceso();
    await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
    const { port } = servidor.address() as AddressInfo;
    try {
      await prueba(`http://127.0.0.1:${port}`, publicar);
    } finally {
      await new Promise((ok) => servidor.close(ok));
    }
  }

  it("PU-research-60: entrega el núcleo sin tipos y nada fuera de él", async () => {
    await conServidor(async (url) => {
      const r = await fetch(`${url}/nucleo/rasgos/manos.ts`);
      expect(r.headers.get("content-type")).toContain("javascript");
      const fuente = await r.text();
      expect(fuente).toContain("class SeguidorManos");
      expect(fuente).not.toContain("export interface");
      expect((await fetch(`${url}/nucleo/rasgos/manos.test.ts`)).status).toBe(404);
      expect((await fetch(`${url}/nucleo/..%2F..%2Fpackage.json`)).status).toBe(404);
    });
  });

  it("PU-research-61: solo entrega los videos publicados, por tramos", async () => {
    await conServidor(async (url, publicar) => {
      expect((await fetch(`${url}/video/otro`)).status).toBe(404);
      const r = await fetch(`${url}${publicar(CLIP)}`, {
        headers: { range: "bytes=0-9" },
      });
      expect(r.status).toBe(206);
      expect((await r.arrayBuffer()).byteLength).toBe(10);
    });
  });
});

describe("notas esperadas del reprocesamiento", () => {
  const catalogo = (eventos: unknown[]) =>
    [
      {
        id: 1,
        codigo: "EJ-01",
        nombre: "Escala de Do mayor",
        fuente: "Panel",
        tonalidad: "Do mayor",
        compas: "2/4",
        figura: "semicorchea",
        orden: 1,
        variantes_manos: ["MI", "MD", "juntas"],
        version_vigente: {
          id: 5,
          version: 2,
          tempo_min_permitido_bpm: 60,
          tempo_max_permitido_bpm: 75,
          rango_octavas: 2,
          nota_min_midi: 48,
          nota_max_midi: 60,
          eventos_esperados: eventos,
          partitura_svg: null,
          transcripcion: eventos.length ? "importada" : "pendiente",
        },
      },
    ] as never;

  it("PU-research-63: con la partitura importada usa sus notas, con dedo, y su versión", async () => {
    await crearToma(A);
    await calibrar([A]);
    const f = falso({});
    const eventos = [
      { idx: 0, tiempo_beats: 0, mano: "MI", dedo: 5, clase_altura: 0, midi: 48 },
      { idx: 1, tiempo_beats: 0, mano: "MD", dedo: 1, clase_altura: 0, midi: 60 },
    ];
    await reprocesar({ carpeta, procesador: f.procesador, catalogo: catalogo(eventos) });
    expect(f.pedidos[0]!.esperadas.map((n) => [n.mano, n.midi, n.dedo])).toEqual([
      ["MI", 48, 5],
      ["MD", 60, 1],
    ]);
    const resultado = leerResultado(A);
    expect(resultado.secuencia_esperada).toBe("partitura");
    expect(resultado.versiones.ejercicio).toBe("EJ-01@2");
  });

  it("PU-research-64: sin partitura importada usa la escala provisional y lo registra", async () => {
    await crearToma(A);
    await calibrar([A]);
    const f = falso({});
    await reprocesar({ carpeta, procesador: f.procesador, catalogo: catalogo([]) });
    expect(f.pedidos[0]!.esperadas.every((n) => n.dedo === undefined)).toBe(true);
    const resultado = leerResultado(A);
    expect(resultado.secuencia_esperada).toBe("provisional");
    expect(resultado.versiones.ejercicio).toBe("EJ-01@1");
  });
});

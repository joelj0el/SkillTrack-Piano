import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { chromium, expect, test } from "@playwright/test";
import {
  calibracion,
  modeloTeclado,
  rangoDe,
  secuenciaEscala,
} from "../packages/core/src/index.ts";

const RAIZ = resolve(import.meta.dirname, "..");
const CLIP_SINTETICO = resolve(RAIZ, "research/node/fixtures/calibracion/CAL-digital-1.mp4");
const CLIP_AUTOR = resolve(RAIZ, "fixtures/autor/EJ01-JUN-60.mp4");
const CODIGO = "A01-EJ01-JUN-60-R1";
const correr = promisify(execFile);
const sha = (b: Buffer | string) => createHash("sha256").update(b).digest("hex");

interface Toques {
  frenteIzquierda: { x: number; y: number };
  frenteDerecha: { x: number; y: number };
  negrasIzquierda: { x: number; y: number };
  negrasDerecha: { x: number; y: number };
}

async function tamanoDelVideo(ruta: string): Promise<{ ancho: number; alto: number }> {
  const navegador = await chromium.launch({ channel: "msedge" });
  try {
    const pagina = await navegador.newPage();
    await pagina.goto(pathToFileURL(ruta).href);
    await pagina.waitForFunction(() => (document.querySelector("video")?.videoWidth ?? 0) > 0);
    return await pagina.evaluate(() => {
      const v = document.querySelector("video")!;
      return { ancho: v.videoWidth, alto: v.videoHeight };
    });
  } finally {
    await navegador.close();
  }
}

async function armarSesion(video: string, toques: (a: number, h: number) => Toques) {
  const carpeta = await mkdtemp(join(tmpdir(), "reproceso-e2e-"));
  const paquete = join(carpeta, `PAQ-${CODIGO}`);
  await mkdir(paquete);
  await copyFile(video, join(paquete, "video.mp4"));
  const bytes = readFileSync(join(paquete, "video.mp4"));
  const meta = `${JSON.stringify({
    tipo: "ejecucion",
    codigo_toma: CODIGO,
    origen: "actuado",
    campos: {
      instrumento: "digital",
      hora: "18:00",
      evaluable: "si",
      tempo: "60",
    },
    video: { archivo: "video.mp4", sha256: sha(bytes) },
    versiones: { ejercicio: "EJ-01@1" },
  })}\n`;
  await writeFile(join(paquete, "meta.json"), meta);
  await writeFile(
    join(paquete, "sha256.txt"),
    `${sha(bytes)}  video.mp4\n${sha(meta)}  meta.json\n`,
  );

  const { ancho, alto } = await tamanoDelVideo(video);
  const puntos = toques(ancho, alto);
  const rango = rangoDe(secuenciaEscala("Do mayor", "juntas"));
  await writeFile(
    join(carpeta, "calibracion-2026-11-09-prueba.json"),
    JSON.stringify({
      version: 1,
      sesion: "2026-11-09-prueba",
      clip: "CAL-prueba",
      instrumento: "digital",
      video: { archivo: "CAL-prueba.mp4", sha256: "a".repeat(64), ancho, alto },
      tiempo_fotograma_s: 0,
      rango,
      toques: puntos,
      homografia: [...calibracion(puntos, modeloTeclado(rango.min, rango.max))],
      version_nucleo: "prueba",
      guardada_en: "2026-11-09T18:00:00.000Z",
      tomas: [CODIGO],
    }),
  );
  return { carpeta, paquete };
}

async function reprocesar(carpeta: string): Promise<string> {
  const { stdout } = await correr(
    process.execPath,
    [
      "--experimental-transform-types",
      "--disable-warning=ExperimentalWarning",
      "research/node/src/reprocesar/cli.ts",
      "--sesion",
      carpeta,
      "--sin-base",
    ],
    { cwd: RAIZ },
  );
  return stdout;
}

interface Linea {
  t: number;
  manos: unknown[];
}

function leer(paquete: string) {
  const lineas = readFileSync(join(paquete, "landmarks.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l) as Linea);
  return {
    lineas,
    resultado: JSON.parse(readFileSync(join(paquete, "resultado.json"), "utf8")),
    audio: JSON.parse(readFileSync(join(paquete, "audio_events.json"), "utf8")),
  };
}

test("PU-research-62: recorre un video sin manos en el navegador y deja los tres archivos", async () => {
  test.setTimeout(180_000);
  // Teclado dibujado en el clip sintético, igual que en la prueba de la calibración.
  const { carpeta, paquete } = await armarSesion(CLIP_SINTETICO, () => ({
    frenteIzquierda: { x: 20, y: 320 },
    frenteDerecha: { x: 620, y: 320 },
    negrasIzquierda: { x: 20, y: 220 },
    negrasDerecha: { x: 620, y: 220 },
  }));
  try {
    await reprocesar(carpeta);
    const { lineas, resultado, audio } = leer(paquete);
    expect(lineas.length).toBeGreaterThanOrEqual(28);
    expect(lineas.every((l) => l.manos.length === 0)).toBe(true);
    expect(resultado.video.codec_video).toBe("avc1");
    expect(resultado.deteccion.perdidos).toBe(0);
    expect(resultado.evaluable.analisis).toBe(false);
    expect(audio.pista).toBe(true);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
});

test("PA-HU18-02: el clip del autor se procesa completo y se detectan manos", async () => {
  test.skip(!existsSync(CLIP_AUTOR), "Falta fixtures/autor/EJ01-JUN-60.mp4");
  test.setTimeout(1_800_000);
  // Calibración de relleno: aquí se comprueba la cadena, no la tecla bajo cada dedo.
  const { carpeta, paquete } = await armarSesion(CLIP_AUTOR, (a, h) => ({
    frenteIzquierda: { x: a * 0.05, y: h * 0.9 },
    frenteDerecha: { x: a * 0.95, y: h * 0.9 },
    negrasIzquierda: { x: a * 0.05, y: h * 0.5 },
    negrasDerecha: { x: a * 0.95, y: h * 0.5 },
  }));
  try {
    const inicio = performance.now();
    const salida = await reprocesar(carpeta);
    console.log(salida);
    console.log(`Duración total: ${Math.round((performance.now() - inicio) / 1000)} s`);
    const { lineas, resultado } = leer(paquete);
    expect(existsSync(join(paquete, "audio_events.json"))).toBe(true);
    expect(lineas.some((l) => l.manos.length > 0)).toBe(true);
    expect(resultado.deteccion.con_manos).toBeGreaterThan(0);
    expect(resultado.deteccion.fotogramas).toBe(lineas.length);
    expect(lineas.at(-1)!.t).toBeGreaterThan(resultado.video.duracion_s - 0.5);
  } finally {
    await rm(carpeta, { recursive: true, force: true });
  }
});

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { aplicar, modeloTeclado, teclaBajo, type Homografia } from "@skilltrack/core";
import { CalibracionSesion, type EntradaCalibracion } from "@skilltrack/contracts";
import { afterEach, describe, expect, it } from "vitest";
import {
  ErrorCalibracion,
  guardarCalibracion,
  leerCalibracion,
  previsualizar,
} from "./calibracion.ts";
import { crearServidor } from "./servidor.ts";
import {
  asociarTomas,
  leerSesion,
  rangoDeTomas,
  type ClipSesion,
  type TomaSesion,
} from "./sesion.ts";

// Clip sintético: un teclado dibujado de Do4 a Do6, con cada blanca de 40 px desde x = 20.
const CLIP_SINTETICO = resolve(import.meta.dirname, "../../fixtures/calibracion/CAL-digital-1.mp4");
const AHORA = () => new Date("2026-11-10T12:00:00.000Z");
const ANCHO = 640;
const ALTO = 400;
const TOQUES = {
  frenteIzquierda: { x: 20, y: 320 },
  frenteDerecha: { x: 620, y: 320 },
  negrasIzquierda: { x: 20, y: 220 },
  negrasDerecha: { x: 620, y: 220 },
};
const RANGO = { min: 60, max: 84 };
const ENTRADA: EntradaCalibracion = {
  clip: "CAL-digital-1",
  ancho: ANCHO,
  alto: ALTO,
  tiempo_fotograma_s: 0.5,
  rango: RANGO,
  toques: TOQUES,
};

const clip = (codigo: string, instrumento: string, hora: string | null): ClipSesion => ({
  codigo,
  instrumento: instrumento as ClipSesion["instrumento"],
  fecha: "2026-11-09",
  hora,
  archivo: `${codigo}.mp4`,
  sha256: "a".repeat(64),
});
const toma = (codigo: string, instrumento: string | null, hora: string | null): TomaSesion => ({
  codigo,
  instrumento: instrumento as TomaSesion["instrumento"],
  hora,
  ejercicio: "EJ-01",
  manos: "MD",
});

/** Carpeta de sesión como la deja la ingesta: el clip con su ficha y los paquetes. */
function carpetaDeSesion(): string {
  const carpeta = mkdtempSync(join(tmpdir(), "sesion-"));
  const calibracion = join(carpeta, "calibracion");
  mkdirSync(calibracion);
  copyFileSync(CLIP_SINTETICO, join(calibracion, "CAL-digital-1.mp4"));
  writeFileSync(
    join(calibracion, "CAL-digital-1.json"),
    JSON.stringify({
      codigo: "CAL-digital-1",
      instrumento: "digital",
      fecha: "2026-11-09",
      hora: "17:50",
      archivo: "CAL-digital-1.mp4",
      sha256: "b".repeat(64),
    }),
  );
  const paquete = (codigo: string, instrumento: string, ejercicio: string) => {
    mkdirSync(join(carpeta, `PAQ-${codigo}`));
    writeFileSync(
      join(carpeta, `PAQ-${codigo}`, "meta.json"),
      JSON.stringify({
        codigo_toma: codigo,
        campos: { instrumento, hora: "18:00" },
        versiones: { ejercicio: `${ejercicio}@1` },
      }),
    );
  };
  paquete("D01-EJ01-MD-60-R1", "digital", "EJ-01");
  paquete("D01-EJ01-MD-60-R1-ACT", "digital", "EJ-01");
  paquete("E01-EJ01-MD-60-R1", "acustico", "EJ-01");
  return carpeta;
}

describe("carga de la sesión", () => {
  it("PU-research-31: lee los clips y las tomas que dejó la ingesta", async () => {
    const sesion = await leerSesion(carpetaDeSesion());

    expect(sesion.clips.map((c) => c.codigo)).toEqual(["CAL-digital-1"]);
    expect(sesion.clips[0]).toMatchObject({ instrumento: "digital", hora: "17:50" });
    expect(sesion.tomas).toContainEqual({
      codigo: "D01-EJ01-MD-60-R1",
      instrumento: "digital",
      hora: "18:00",
      ejercicio: "EJ-01",
      manos: "MD",
    });
  });

  it("PU-research-32: con un solo clip del instrumento, todas sus tomas lo usan", () => {
    const r = asociarTomas(
      [clip("CAL-digital-1", "digital", "17:50")],
      [toma("A", "digital", "18:00"), toma("B", "digital", null)],
    );
    expect(r.porClip).toEqual({ "CAL-digital-1": ["A", "B"] });
    expect(r.sinCalibracion).toEqual([]);
  });

  it("PU-research-33: si se recalibró, cada toma usa el último clip anterior a su hora", () => {
    const r = asociarTomas(
      [clip("CAL-digital-1", "digital", "17:50"), clip("CAL-digital-2", "digital", "19:00")],
      [toma("A", "digital", "18:00"), toma("B", "digital", "19:10")],
    );
    expect(r.porClip).toEqual({ "CAL-digital-1": ["A"], "CAL-digital-2": ["B"] });
  });

  it("PU-research-34: sin clip del instrumento o con varios y sin hora, no adivina", () => {
    const r = asociarTomas(
      [clip("CAL-digital-1", "digital", "17:50"), clip("CAL-digital-2", "digital", "19:00")],
      [toma("A", "teclado", "18:00"), toma("B", "digital", null), toma("C", "digital", "17:00")],
    );
    expect(r.porClip).toEqual({ "CAL-digital-1": [], "CAL-digital-2": [] });
    expect(r.sinCalibracion.map((s) => s.codigo)).toEqual(["A", "B", "C"]);
  });

  it("PU-research-35: el rango sugerido cubre todas las tomas del clip", () => {
    expect(rangoDeTomas([toma("A", "digital", null)])).toEqual({ min: 60, max: 84 });
    expect(
      rangoDeTomas([
        toma("A", "digital", null),
        { ...toma("B", "digital", null), manos: "juntas" },
      ]),
    ).toEqual({ min: 48, max: 84 });
    expect(rangoDeTomas([])).toBeNull();
  });
});

describe("calibración sobre el fotograma", () => {
  it("PU-research-36: las teclas caen donde están en el clip sintético", () => {
    const r = previsualizar({ rango: RANGO, ancho: ANCHO, alto: ALTO, toques: TOQUES });

    expect(r.grave).toBe("Do4");
    expect(r.aguda).toBe("Do6");
    expect(r.cubre).toBe(true);
    const modelo = modeloTeclado(RANGO.min, RANGO.max);
    const homografia = r.homografia as Homografia;
    expect(teclaBajo(modelo, aplicar(homografia, { x: 120, y: 270 }))?.midi).toBe(64);
    expect(teclaBajo(modelo, aplicar(homografia, { x: 60, y: 150 }))).toMatchObject({
      midi: 61,
      negra: true,
    });
    const miCuatro = r.teclas?.find((t) => t.midi === 64);
    expect(miCuatro?.puntos[0]?.x).toBeCloseTo(100);
    expect(miCuatro?.puntos[0]?.y).toBeCloseTo(320);
  });

  it("PU-research-37: sin toques solo informa las teclas de los extremos", () => {
    const r = previsualizar({ rango: { min: 61, max: 70 }, ancho: ANCHO, alto: ALTO });
    expect(r).toEqual({ grave: "Do4", aguda: "Si4" });
  });

  it("PU-research-38: guarda el JSON con las tomas asociadas y se puede volver a cargar", async () => {
    const carpeta = carpetaDeSesion();

    const { ruta, tomas } = await guardarCalibracion(carpeta, ENTRADA, AHORA);

    expect(ruta).toBe(join(carpeta, "calibracion-2026-11-09-digital-1.json"));
    expect(tomas).toEqual(["D01-EJ01-MD-60-R1", "D01-EJ01-MD-60-R1-ACT"]);
    const guardada = await leerCalibracion(ruta);
    expect(CalibracionSesion.safeParse(guardada).success).toBe(true);
    expect(guardada).toMatchObject({
      sesion: "2026-11-09-digital-1",
      clip: "CAL-digital-1",
      instrumento: "digital",
      video: { archivo: "CAL-digital-1.mp4", ancho: ANCHO, alto: ALTO },
      rango: RANGO,
      toques: TOQUES,
      guardada_en: "2026-11-10T12:00:00.000Z",
      tomas,
    });
  });

  it("PU-research-39: no guarda si el rango se sale de la imagen", async () => {
    const carpeta = carpetaDeSesion();
    const fuera = {
      ...TOQUES,
      frenteDerecha: { x: 700, y: 320 },
      negrasDerecha: { x: 700, y: 220 },
    };

    await expect(guardarCalibracion(carpeta, { ...ENTRADA, toques: fuera }, AHORA)).rejects.toThrow(
      /no cubre.*agudas/,
    );
    expect(existsSync(join(carpeta, "calibracion-2026-11-09-digital-1.json"))).toBe(false);
  });

  it("PU-research-40: no guarda si el rango no alcanza para las tomas asociadas", async () => {
    await expect(
      guardarCalibracion(carpetaDeSesion(), { ...ENTRADA, rango: { min: 60, max: 72 } }, AHORA),
    ).rejects.toThrow(ErrorCalibracion);
  });

  it("PU-research-41: un clip que no existe se rechaza", async () => {
    await expect(
      guardarCalibracion(carpetaDeSesion(), { ...ENTRADA, clip: "CAL-digital-9" }, AHORA),
    ).rejects.toThrow(/No existe el clip/);
  });
});

describe("herramienta local", () => {
  let cerrar: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cerrar?.();
    cerrar = undefined;
  });

  async function iniciar(carpeta: string): Promise<string> {
    const servidor = crearServidor(carpeta, AHORA);
    await new Promise<void>((listo) => servidor.listen(0, "127.0.0.1", listo));
    cerrar = () => new Promise((listo) => servidor.close(() => listo()));
    return `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  }

  const enviar = (url: string, cuerpo: unknown) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(cuerpo),
    });

  it("PU-research-42: sirve la página y la sesión con su rango sugerido", async () => {
    const base = await iniciar(carpetaDeSesion());

    expect((await fetch(base)).headers.get("content-type")).toContain("text/html");
    expect(await (await fetch(`${base}/tokens.css`)).text()).toContain("--color-acento");
    const sesion = (await (await fetch(`${base}/api/sesion`)).json()) as {
      clips: { codigo: string; tomas: string[]; rango_sugerido: unknown }[];
      sin_calibracion: { codigo: string }[];
    };
    expect(sesion.clips[0]).toMatchObject({
      codigo: "CAL-digital-1",
      rango_sugerido: RANGO,
    });
    expect(sesion.clips[0]?.tomas).toHaveLength(2);
    expect(sesion.sin_calibracion.map((s) => s.codigo)).toEqual(["E01-EJ01-MD-60-R1"]);
  });

  it("PU-research-43: sirve el video por tramos para poder elegir el fotograma", async () => {
    const base = await iniciar(carpetaDeSesion());
    const tamano = readFileSync(CLIP_SINTETICO).length;

    const r = await fetch(`${base}/video/CAL-digital-1`, { headers: { range: "bytes=0-99" } });

    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe(`bytes 0-99/${tamano}`);
    expect((await r.arrayBuffer()).byteLength).toBe(100);
  });

  it("PU-research-44: calibra el fotograma del clip y deja el JSON", async () => {
    const carpeta = carpetaDeSesion();
    const base = await iniciar(carpeta);

    const vista = await enviar(`${base}/api/previsualizar`, {
      rango: RANGO,
      ancho: ANCHO,
      alto: ALTO,
      toques: TOQUES,
    });
    expect(vista.status).toBe(200);
    const r = await enviar(`${base}/api/guardar`, ENTRADA);

    expect(r.status).toBe(200);
    expect(existsSync(join(carpeta, "calibracion-2026-11-09-digital-1.json"))).toBe(true);
  });

  it("PU-research-45: un error de calibración responde 422 con su mensaje", async () => {
    const base = await iniciar(carpetaDeSesion());

    const r = await enviar(`${base}/api/guardar`, { ...ENTRADA, clip: "CAL-digital-9" });

    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ error: expect.stringContaining("No existe el clip") });
  });

  it("PU-research-46: solo sirve clips de la sesión y solo atiende al equipo local", async () => {
    const base = await iniciar(carpetaDeSesion());

    expect((await fetch(`${base}/video/..%2F..%2Fsecreto`)).status).toBe(404);
    expect((await fetch(`${base}/video/CAL-digital-9`)).status).toBe(404);
    const texto = await fetch(`${base}/api/guardar`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "{}",
    });
    expect(texto.status).toBe(415);
    const { hostname, port } = new URL(base);
    const http = await import("node:http");
    const estado = await new Promise<number | undefined>((listo) => {
      http
        .get({ hostname, port, path: "/api/sesion", headers: { host: "malicioso.test" } }, (r) => {
          r.resume();
          listo(r.statusCode);
        })
        .end();
    });
    expect(estado).toBe(403);
  });
});

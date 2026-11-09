import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import { VERSION_NUCLEO } from "@skilltrack/core";
import type { MetodoAsociacion } from "./asociar.ts";
import type { ClipCalibracion, TomaEjecucion } from "./validar.ts";

export const VERSION_INGESTA = "1.0.0";
const MANIFIESTO = "sha256.txt";

export class PaqueteRechazado extends Error {}

export async function sha256Archivo(ruta: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(ruta), hash);
  return hash.digest("hex");
}

function sha256Texto(texto: string): string {
  return createHash("sha256").update(texto).digest("hex");
}

function metaDe(
  toma: TomaEjecucion,
  asociacion: MetodoAsociacion,
  video: { archivo_original: string; archivo: string; sha256: string; bytes: number },
): string {
  const meta = {
    tipo: toma.tipo,
    codigo_toma: toma.codigo,
    origen: toma.origen,
    asociacion,
    campos: toma.campos,
    video,
    versiones: {
      ingesta: VERSION_INGESTA,
      nucleo: VERSION_NUCLEO,
      ejercicio: toma.versionEjercicio,
    },
  };
  return `${JSON.stringify(meta, null, 2)}\n`;
}

/** Comprueba cada archivo contra el manifiesto del paquete; devuelve el manifiesto. */
async function verificar(directorio: string): Promise<string> {
  const manifiesto = await readFile(join(directorio, MANIFIESTO), "utf8");
  for (const linea of manifiesto.trim().split("\n")) {
    const [esperado, nombre] = linea.split(/\s+/);
    const real = await sha256Archivo(join(directorio, nombre!));
    if (real !== esperado) {
      throw new PaqueteRechazado(`Paquete alterado: ${nombre} no coincide con su sha256`);
    }
  }
  return manifiesto;
}

export interface PaqueteListo {
  ruta: string;
  sha256: string;
}

/** Idempotente: un paquete existente se verifica y nunca se sobrescribe. */
export async function crearPaquete(
  toma: TomaEjecucion,
  origenVideo: string,
  nombreOriginal: string,
  asociacion: MetodoAsociacion,
  salida: string,
): Promise<PaqueteListo> {
  const nombre = `PAQ-${toma.codigo}`;
  const destino = join(salida, nombre);
  const archivo = `video${extname(nombreOriginal).toLowerCase()}`;
  const shaOrigen = await sha256Archivo(origenVideo);
  const { size: bytes } = await stat(origenVideo);
  const meta = metaDe(toma, asociacion, {
    archivo_original: nombreOriginal,
    archivo,
    sha256: shaOrigen,
    bytes,
  });

  if (existsSync(destino)) {
    const manifiesto = await verificar(destino);
    if ((await readFile(join(destino, "meta.json"), "utf8")) !== meta) {
      throw new PaqueteRechazado(
        "El paquete existente no coincide con la planilla o con el video actual",
      );
    }
    return { ruta: destino, sha256: sha256Texto(manifiesto) };
  }

  // Se arma aparte y se renombra al final: una copia interrumpida nunca parece un paquete.
  const temporal = join(salida, `.tmp-${nombre}`);
  await rm(temporal, { recursive: true, force: true });
  await mkdir(temporal, { recursive: true });
  try {
    await copyFile(origenVideo, join(temporal, archivo));
    if ((await sha256Archivo(join(temporal, archivo))) !== shaOrigen) {
      throw new PaqueteRechazado("La copia del video no coincide con el original");
    }
    await writeFile(join(temporal, "meta.json"), meta);
    const manifiesto = `${shaOrigen}  ${archivo}\n${sha256Texto(meta)}  meta.json\n`;
    await writeFile(join(temporal, MANIFIESTO), manifiesto);
    await rename(temporal, destino);
    return { ruta: destino, sha256: sha256Texto(manifiesto) };
  } finally {
    await rm(temporal, { recursive: true, force: true });
  }
}

export interface ClipGuardado {
  ruta: string;
  sha256: string;
}

/** Copia el clip a calibracion/; igual que un paquete, si ya existe se verifica y no se toca. */
export async function guardarClip(
  clip: ClipCalibracion,
  origenVideo: string,
  nombreOriginal: string,
  salida: string,
): Promise<ClipGuardado> {
  const carpeta = join(salida, "calibracion");
  const ruta = join(carpeta, `${clip.codigo}${extname(nombreOriginal).toLowerCase()}`);
  const sha256 = await sha256Archivo(origenVideo);
  const ficha = `${JSON.stringify(
    {
      codigo: clip.codigo,
      instrumento: clip.instrumento,
      fecha: clip.fecha,
      hora: clip.campos.hora || null,
      archivo: basename(ruta),
      archivo_original: nombreOriginal,
      sha256,
    },
    null,
    2,
  )}\n`;
  const rutaFicha = join(carpeta, `${clip.codigo}.json`);
  if (existsSync(ruta)) {
    if ((await sha256Archivo(ruta)) !== sha256) {
      throw new PaqueteRechazado(`Clip alterado: ${clip.codigo} no coincide con su sha256`);
    }
    await writeFile(rutaFicha, ficha);
    return { ruta, sha256 };
  }
  await mkdir(carpeta, { recursive: true });
  const temporal = `${ruta}.tmp`;
  try {
    await copyFile(origenVideo, temporal);
    if ((await sha256Archivo(temporal)) !== sha256) {
      throw new PaqueteRechazado("La copia del clip no coincide con el original");
    }
    await rename(temporal, ruta);
    await writeFile(rutaFicha, ficha);
    return { ruta, sha256 };
  } finally {
    await rm(temporal, { force: true });
  }
}

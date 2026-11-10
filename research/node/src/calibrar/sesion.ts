import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { rangoDe, secuenciaEscala, type NotaEsperada } from "@skilltrack/core";
import { instrumentoDe, type Instrumento } from "../ingesta/validar.ts";

export interface ClipSesion {
  codigo: string;
  instrumento: Instrumento;
  fecha: string;
  hora: string | null;
  archivo: string;
  sha256: string;
}

export interface TomaSesion {
  codigo: string;
  instrumento: Instrumento | null;
  hora: string | null;
  ejercicio: string;
  manos: "MI" | "MD" | "juntas";
}

export interface Sesion {
  clips: ClipSesion[];
  tomas: TomaSesion[];
}

// Tonalidad de cada ejercicio del repertorio publicado.
const TONALIDADES: Record<string, string> = {
  "EJ-01": "Do mayor",
  "EJ-02": "Fa mayor",
  "EJ-03": "Si♭ mayor",
  "EJ-04": "Mi♭ mayor",
};

function manosDelCodigo(codigo: string): TomaSesion["manos"] {
  const m = /-(MI|MD)-/i.exec(codigo);
  return m ? (m[1]!.toUpperCase() as "MI" | "MD") : "juntas";
}

async function leerJson<T>(ruta: string): Promise<T> {
  return JSON.parse(await readFile(ruta, "utf8")) as T;
}

/** Lee lo que dejó la ingesta en la carpeta de la sesión. */
export async function leerSesion(carpeta: string): Promise<Sesion> {
  const dirCalibracion = join(carpeta, "calibracion");
  const fichas = existsSync(dirCalibracion)
    ? (await readdir(dirCalibracion)).filter((n) => n.endsWith(".json")).sort()
    : [];
  const clips = await Promise.all(
    fichas.map(async (nombre) => {
      const f = await leerJson<ClipSesion>(join(dirCalibracion, nombre));
      return {
        codigo: f.codigo,
        instrumento: f.instrumento,
        fecha: f.fecha,
        hora: f.hora || null,
        archivo: f.archivo,
        sha256: f.sha256,
      };
    }),
  );

  const tomas: TomaSesion[] = [];
  for (const nombre of (await readdir(carpeta)).sort()) {
    const ruta = join(carpeta, nombre, "meta.json");
    if (!nombre.startsWith("PAQ-") || !existsSync(ruta)) continue;
    const meta = await leerJson<{
      codigo_toma: string;
      campos: Record<string, string>;
      versiones: { ejercicio: string };
    }>(ruta);
    tomas.push({
      codigo: meta.codigo_toma,
      instrumento: instrumentoDe(meta.campos.instrumento ?? ""),
      hora: meta.campos.hora || null,
      ejercicio: meta.versiones.ejercicio.split("@")[0]!,
      manos: manosDelCodigo(meta.codigo_toma),
    });
  }
  return { clips, tomas };
}

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h! * 60 + m!;
}

export interface AsociacionTomas {
  porClip: Record<string, string[]>;
  sinCalibracion: { codigo: string; motivo: string }[];
}

/**
 * Cada toma usa el clip de su instrumento. Si el teléfono se movió y se recalibró, hay varios:
 * vale el último anterior a la toma. Ante la duda la toma queda sin calibración y se informa.
 */
export function asociarTomas(clips: ClipSesion[], tomas: TomaSesion[]): AsociacionTomas {
  const porClip = Object.fromEntries(clips.map((c) => [c.codigo, [] as string[]]));
  const sinCalibracion: AsociacionTomas["sinCalibracion"] = [];
  for (const toma of tomas) {
    const candidatos = clips.filter((c) => c.instrumento === toma.instrumento);
    let elegido: ClipSesion | undefined;
    let motivo = "No hay un clip CAL- de su instrumento";
    if (candidatos.length === 1) {
      elegido = candidatos[0];
    } else if (candidatos.length > 1) {
      motivo = "Hay varios clips de su instrumento y ninguno es anterior a su hora";
      if (toma.hora) {
        const hora = minutos(toma.hora);
        elegido = candidatos
          .filter((c) => c.hora !== null && minutos(c.hora) <= hora)
          .sort((a, b) => minutos(b.hora!) - minutos(a.hora!))[0];
      }
    }
    if (elegido) porClip[elegido.codigo]!.push(toma.codigo);
    else sinCalibracion.push({ codigo: toma.codigo, motivo });
  }
  return { porClip, sinCalibracion };
}

/** Secuencia que se espera oír y ver en la toma; null si no se conoce su ejercicio. */
export function esperadasDe(toma: TomaSesion): NotaEsperada[] | null {
  const tonalidad = TONALIDADES[toma.ejercicio];
  return tonalidad ? secuenciaEscala(tonalidad, toma.manos) : null;
}

/** Tramo de teclas que debe cubrir la calibración para servir a todas estas tomas. */
export function rangoDeTomas(tomas: TomaSesion[]): { min: number; max: number } | null {
  const notas = tomas.flatMap((t) => esperadasDe(t) ?? []);
  return notas.length ? rangoDe(notas) : null;
}

export function nombreSesion(clip: ClipSesion): string {
  return `${clip.fecha}-${clip.codigo.replace(/^CAL-/i, "")}`;
}

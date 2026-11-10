import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  EventosAudio,
  FotogramaReproceso,
  ResultadoReproceso,
  type CalibracionSesion,
} from "@skilltrack/contracts";
import {
  MINIMO_EVALUABLE,
  VERSION_NUCLEO,
  fraccionEvaluable,
  type NotaEsperada,
  type RespuestaAnalisis,
} from "@skilltrack/core";
import { leerCalibracion } from "../calibrar/calibracion.ts";
import { asociarTomas, esperadasDe, leerSesion, type TomaSesion } from "../calibrar/sesion.ts";
import { PaqueteRechazado, verificarPaquete } from "../ingesta/paquetes.ts";
import type { Base } from "../ingesta/registro.ts";
import { booleano } from "../ingesta/validar.ts";
import { leerCodecs, type Codecs } from "./codecs.ts";

export const VERSION_REPROCESO = "1.0.0";
const RESULTADO = "resultado.json";
const LANDMARKS = "landmarks.jsonl";
const AUDIO = "audio_events.json";

export type Comprobacion =
  | { decodificable: true; ancho: number; alto: number; duracion_s: number }
  | { decodificable: false; motivo: string };

export interface PedidoProceso {
  homografia: readonly number[];
  rango: { min: number; max: number };
  esperadas: NotaEsperada[];
  metronomo: "con" | "sin";
  tempo: number | null;
  /** Instantes a los que saltar, uno por fotograma; null si el contenedor no los da. */
  tiempos: number[] | null;
}

export interface SalidaProceso {
  ancho: number;
  alto: number;
  duracion_s: number;
  delegado: "GPU" | "CPU";
  perdidos: number;
  fotogramas: FotogramaReproceso[];
  analisis: RespuestaAnalisis;
  audio: { pista: boolean; motivo: string | null; tasa_hz: number | null };
}

export interface Procesador {
  version_modelo: string;
  comprobar(ruta: string): Promise<Comprobacion>;
  procesar(ruta: string, pedido: PedidoProceso): Promise<SalidaProceso>;
  cerrar(): Promise<void>;
}

interface Meta {
  codigo_toma: string;
  origen: ResultadoReproceso["origen"];
  campos: Record<string, string>;
  video: { archivo: string; sha256: string };
  versiones: { ejercicio: string };
}

interface Paquete {
  ruta: string;
  meta: Meta;
  toma: TomaSesion;
}

export interface ReporteReproceso {
  procesadas: {
    codigo: string;
    duracion_video_s: number;
    duracion_proceso_s: number;
    fotogramas: number;
    con_manos: number;
    perdidos: number;
    porcentaje_evaluable: number;
    evaluable: boolean;
  }[];
  ya_hechas: string[];
  no_decodificables: {
    codigo: string;
    codec_video: string | null;
    codec_audio: string | null;
    motivo: string;
  }[];
  sin_calibracion: { codigo: string; motivo: string }[];
  paquetes_rechazados: { codigo: string; motivo: string }[];
  fallidas: { codigo: string; motivo: string }[];
  sin_registro: string[];
}

export class ErrorReproceso extends Error {}

export interface OpcionesReproceso {
  carpeta: string;
  procesador: Procesador;
  base?: Base;
  /** Procesa solo esta toma, aunque ya esté hecha. */
  solo?: string;
  reloj?: () => number;
  avisar?: (mensaje: string) => void;
}

async function leerPaquetes(carpeta: string): Promise<Paquete[]> {
  const { tomas } = await leerSesion(carpeta);
  const paquetes: Paquete[] = [];
  for (const toma of tomas) {
    const ruta = join(carpeta, `PAQ-${toma.codigo}`);
    const meta = JSON.parse(await readFile(join(ruta, "meta.json"), "utf8")) as Meta;
    paquetes.push({ ruta, meta, toma });
  }
  return paquetes;
}

async function leerCalibraciones(carpeta: string): Promise<Map<string, CalibracionSesion>> {
  const nombres = (await readdir(carpeta)).filter((n) => /^calibracion-.+\.json$/.test(n)).sort();
  const porToma = new Map<string, CalibracionSesion>();
  for (const nombre of nombres) {
    const documento = await leerCalibracion(join(carpeta, nombre));
    for (const codigo of documento.tomas) porToma.set(codigo, documento);
  }
  return porToma;
}

/** Terminada solo si resultado.json, que se escribe al final, es de estas versiones y este video. */
async function yaHecha(p: Paquete, versionModelo: string): Promise<boolean> {
  const ruta = join(p.ruta, RESULTADO);
  if (
    !existsSync(ruta) ||
    !existsSync(join(p.ruta, LANDMARKS)) ||
    !existsSync(join(p.ruta, AUDIO))
  ) {
    return false;
  }
  try {
    const r = ResultadoReproceso.parse(JSON.parse(await readFile(ruta, "utf8")));
    return (
      r.versiones.nucleo === VERSION_NUCLEO &&
      r.versiones.modelo_mano === versionModelo &&
      r.versiones.reprocesamiento === VERSION_REPROCESO &&
      r.video.sha256 === p.meta.video.sha256
    );
  } catch {
    return false;
  }
}

const sha256 = (texto: string) => createHash("sha256").update(texto).digest("hex");
const seisDecimales = (_clave: string, v: unknown) =>
  typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v;
const porcentaje = (fraccion: number) => Math.round(fraccion * 1000) / 10;

function tempoDe(p: Paquete): number | null {
  const tempo = Number(p.meta.campos.tempo || /-(\d+)-R\d+/.exec(p.meta.codigo_toma)?.[1]);
  return Number.isFinite(tempo) && tempo > 0 ? tempo : null;
}

function documentos(
  p: Paquete,
  calibracion: CalibracionSesion,
  codecs: Codecs,
  versionModelo: string,
  s: SalidaProceso,
) {
  const landmarks =
    s.fotogramas.map((f) => JSON.stringify(FotogramaReproceso.parse(f), seisDecimales)).join("\n") +
    "\n";
  const audio = `${JSON.stringify(
    EventosAudio.parse({
      version: 1,
      codigo_toma: p.meta.codigo_toma,
      pista: s.audio.pista,
      motivo: s.audio.motivo,
      tasa_hz: s.audio.tasa_hz,
      ataques: s.analisis.acustico?.oidas ?? [],
    }),
    seisDecimales,
    2,
  )}\n`;
  const pct = porcentaje(fraccionEvaluable(s.analisis));
  const planilla = booleano(p.meta.campos.evaluable ?? "") === true;
  const analisis = pct >= Math.round(MINIMO_EVALUABLE * 100);
  const { acustico } = s.analisis;
  const resultado = ResultadoReproceso.parse({
    version: 1,
    codigo_toma: p.meta.codigo_toma,
    origen: p.meta.origen,
    versiones: {
      nucleo: VERSION_NUCLEO,
      modelo_mano: versionModelo,
      ejercicio: p.meta.versiones.ejercicio,
      referencia: null,
      reglas: null,
      clasificador: null,
      reprocesamiento: VERSION_REPROCESO,
    },
    calibracion: { sesion: calibracion.sesion, clip: calibracion.clip },
    video: {
      archivo: p.meta.video.archivo,
      sha256: p.meta.video.sha256,
      codec_video: codecs.video,
      codec_audio: codecs.audio,
      ancho: s.ancho,
      alto: s.alto,
      duracion_s: s.duracion_s,
    },
    deteccion: {
      delegado: s.delegado,
      fotogramas: s.fotogramas.length,
      con_manos: s.fotogramas.filter((f) => f.manos.length > 0).length,
      perdidos: s.perdidos,
    },
    landmarks_sha256: sha256(landmarks),
    audio_events_sha256: sha256(audio),
    analisis: {
      notas: s.analisis.notas,
      visuales: s.analisis.visuales,
      acustico: acustico
        ? {
            ataques: acustico.ataques,
            notas: acustico.notas,
            tempo: acustico.tempo,
            fusion: acustico.fusion,
          }
        : null,
    },
    porcentaje_evaluable: pct,
    // Una toma que el docente marcó como no evaluable nunca pasa a serlo por el análisis.
    evaluable: { planilla, analisis, final: planilla && analisis },
  });
  return { landmarks, audio, resultado };
}

async function actualizarEvaluable(
  base: Base,
  codigo: string,
  evaluable: boolean,
): Promise<boolean> {
  const { rows } = await base.consulta(
    "UPDATE ejecucion SET evaluable = $1 WHERE codigo_toma = $2 RETURNING codigo_toma",
    [evaluable, codigo],
  );
  return rows.length > 0;
}

/** resultado.json va al final: mientras no exista, la toma se repite al reanudar. */
async function escribir(
  p: Paquete,
  docs: ReturnType<typeof documentos>,
  antesDeTerminar: () => Promise<void>,
): Promise<void> {
  const contenidos: [string, string][] = [
    [LANDMARKS, docs.landmarks],
    [AUDIO, docs.audio],
    [RESULTADO, `${JSON.stringify(docs.resultado, seisDecimales, 2)}\n`],
  ];
  const temporal = (nombre: string) => join(p.ruta, `${nombre}.tmp`);
  await rm(join(p.ruta, RESULTADO), { force: true });
  try {
    for (const [nombre, contenido] of contenidos) await writeFile(temporal(nombre), contenido);
    await rename(temporal(LANDMARKS), join(p.ruta, LANDMARKS));
    await rename(temporal(AUDIO), join(p.ruta, AUDIO));
    await antesDeTerminar();
    await rename(temporal(RESULTADO), join(p.ruta, RESULTADO));
  } finally {
    for (const [nombre] of contenidos) await rm(temporal(nombre), { force: true });
  }
}

export async function reprocesar(op: OpcionesReproceso): Promise<ReporteReproceso> {
  const { carpeta, procesador, base, solo } = op;
  const reloj = op.reloj ?? (() => performance.now() / 1000);
  const avisar = op.avisar ?? (() => {});
  const reporte: ReporteReproceso = {
    procesadas: [],
    ya_hechas: [],
    no_decodificables: [],
    sin_calibracion: [],
    paquetes_rechazados: [],
    fallidas: [],
    sin_registro: [],
  };
  const guardar = () =>
    writeFile(join(carpeta, "reporte-reproceso.json"), `${JSON.stringify(reporte, null, 2)}\n`);

  const todos = await leerPaquetes(carpeta);
  const paquetes = solo ? todos.filter((p) => p.meta.codigo_toma === solo) : todos;
  if (solo && paquetes.length === 0) throw new ErrorReproceso(`No existe la toma ${solo}`);
  const calibraciones = await leerCalibraciones(carpeta);
  const { clips, tomas } = await leerSesion(carpeta);
  const { sinCalibracion } = asociarTomas(clips, tomas);

  // Primero se revisa todo: lo que no se pueda procesar se informa antes de las horas de cálculo.
  const listas: {
    p: Paquete;
    calibracion: CalibracionSesion;
    codecs: Codecs;
  }[] = [];
  for (const p of paquetes) {
    const codigo = p.meta.codigo_toma;
    if (!solo && (await yaHecha(p, procesador.version_modelo))) {
      reporte.ya_hechas.push(codigo);
      continue;
    }
    try {
      await verificarPaquete(p.ruta);
    } catch (error) {
      if (!(error instanceof PaqueteRechazado)) throw error;
      reporte.paquetes_rechazados.push({ codigo, motivo: error.message });
      continue;
    }
    const video = join(p.ruta, p.meta.video.archivo);
    const codecs = await leerCodecs(video);
    const comprobacion = await procesador.comprobar(video);
    if (!comprobacion.decodificable) {
      reporte.no_decodificables.push({
        codigo,
        codec_video: codecs.video,
        codec_audio: codecs.audio,
        motivo: comprobacion.motivo,
      });
      continue;
    }
    const calibracion = calibraciones.get(codigo);
    if (!calibracion) {
      reporte.sin_calibracion.push({
        codigo,
        motivo:
          sinCalibracion.find((s) => s.codigo === codigo)?.motivo ??
          "Su clip de calibración todavía no se marcó",
      });
      continue;
    }
    const { ancho, alto } = calibracion.video;
    if (ancho !== comprobacion.ancho || alto !== comprobacion.alto) {
      reporte.sin_calibracion.push({
        codigo,
        motivo: `La calibración es de ${ancho}x${alto} y el video de ${comprobacion.ancho}x${comprobacion.alto}`,
      });
      continue;
    }
    listas.push({ p, calibracion, codecs });
  }
  await guardar();

  for (const [i, { p, calibracion, codecs }] of listas.entries()) {
    const codigo = p.meta.codigo_toma;
    const inicio = reloj();
    try {
      const esperadas = esperadasDe(p.toma);
      if (!esperadas) throw new ErrorReproceso(`Ejercicio desconocido: ${p.toma.ejercicio}`);
      const salida = await procesador.procesar(join(p.ruta, p.meta.video.archivo), {
        homografia: calibracion.homografia,
        rango: calibracion.rango,
        esperadas,
        metronomo: p.meta.campos.modo_metronomo === "con" ? "con" : "sin",
        tempo: tempoDe(p),
        tiempos: codecs.tiempos,
      });
      const docs = documentos(p, calibracion, codecs, procesador.version_modelo, salida);
      await escribir(p, docs, async () => {
        if (base && !(await actualizarEvaluable(base, codigo, docs.resultado.evaluable.final))) {
          reporte.sin_registro.push(codigo);
        }
      });
      const duracion = reloj() - inicio;
      reporte.procesadas.push({
        codigo,
        duracion_video_s: salida.duracion_s,
        duracion_proceso_s: Math.round(duracion * 10) / 10,
        fotogramas: docs.resultado.deteccion.fotogramas,
        con_manos: docs.resultado.deteccion.con_manos,
        perdidos: docs.resultado.deteccion.perdidos,
        porcentaje_evaluable: docs.resultado.porcentaje_evaluable,
        evaluable: docs.resultado.evaluable.final,
      });
      avisar(
        `[${i + 1}/${listas.length}] ${codigo}: ${Math.round(duracion)} s para ${Math.round(salida.duracion_s)} s de video`,
      );
    } catch (error) {
      reporte.fallidas.push({
        codigo,
        motivo: String((error as Error).message ?? error),
      });
      avisar(`[${i + 1}/${listas.length}] ${codigo}: FALLÓ`);
    }
    await guardar();
  }
  return reporte;
}

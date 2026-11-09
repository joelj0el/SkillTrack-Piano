import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { asociar, type MetodoAsociacion, type VideoParaAsociar } from "./asociar.ts";
import {
  crearPaquete,
  guardarClip,
  PaqueteRechazado,
  type ClipGuardado,
  type PaqueteListo,
} from "./paquetes.ts";
import { leerPlanilla } from "./planilla.ts";
import {
  prepararEsquema,
  registrarClip,
  registrarParticipantes,
  registrarToma,
  type Base,
} from "./registro.ts";
import {
  interpretar,
  type ClipCalibracion,
  type FilaInterpretada,
  type Problema,
  type TomaEjecucion,
} from "./validar.ts";

const EXTENSIONES_VIDEO = new Set([".mp4", ".mov", ".m4v", ".3gp", ".mkv", ".webm"]);

export interface OpcionesIngesta {
  entrada: string;
  salida: string;
  /** Fecha de la sesión (AAAA-MM-DD) para las filas que no traen la suya. */
  fecha: string;
  /** Sin base solo se verifica: no se copian videos ni se registra nada. */
  base?: Base;
}

export interface Reporte {
  solo_verificar: boolean;
  columnas: string[];
  columnas_faltantes: string[];
  tomas_validas: string[];
  /** Códigos de los clips del teclado vacío, por instrumento. No son tomas. */
  clips_calibracion: Record<string, string[]>;
  filas_sin_video: { fila: number; codigo: string; motivo: string }[];
  videos_sin_fila: string[];
  valores_invalidos: Problema[];
  paquetes_rechazados: { codigo: string; motivo: string }[];
  asociacion: Record<MetodoAsociacion, number>;
  etiquetadores_sin_identificar: number;
}

function segundoDeHora(hora: string | undefined): number | undefined {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(hora ?? "");
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3] ?? 0) : undefined;
}

/** La hora del nombre del archivo sobrevive a la copia por USB; la de modificación, no siempre. */
async function listarVideos(carpeta: string): Promise<VideoParaAsociar[]> {
  const nombres = (await readdir(carpeta)).filter((n) =>
    EXTENSIONES_VIDEO.has(extname(n).toLowerCase()),
  );
  return Promise.all(
    nombres.map(async (nombre) => {
      const m = /(?:^|\D)\d{8}[_-]?(\d{2})(\d{2})(\d{2})(?:\D|$)/.exec(nombre);
      if (m) return { nombre, segundo: Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) };
      const { mtime } = await stat(join(carpeta, nombre));
      return {
        nombre,
        segundo: mtime.getHours() * 3600 + mtime.getMinutes() * 60 + mtime.getSeconds(),
      };
    }),
  );
}

export async function ingerir({ entrada, salida, fecha, base }: OpcionesIngesta): Promise<Reporte> {
  const planilla = await leerPlanilla(join(entrada, "PLANILLA_TOMAS.xlsx"));
  const videos = await listarVideos(entrada);

  const valores_invalidos: Problema[] = [];
  const interpretadas = new Map<number, FilaInterpretada>();
  const vistos = new Set<string>();
  planilla.tomas.forEach((fila, indice) => {
    const { interpretada, problemas } = interpretar(fila, planilla.valores, fecha);
    valores_invalidos.push(...problemas);
    if (!interpretada) return;
    if (vistos.has(interpretada.codigo)) {
      valores_invalidos.push({
        fila: fila.fila,
        codigo: interpretada.codigo,
        campo: "codigo_toma",
        valor: interpretada.codigo,
        motivo: "Código repetido en la planilla",
      });
      return;
    }
    vistos.add(interpretada.codigo);
    interpretadas.set(indice, interpretada);
  });

  // También las filas inválidas: su video existe y no debe contarse como "sin fila".
  const asociados = asociar(
    planilla.tomas.map((f, indice) => {
      const hora = segundoDeHora(f.campos.hora);
      return {
        indice,
        ...(f.campos.archivo_video ? { archivo: f.campos.archivo_video } : {}),
        ...(hora !== undefined ? { hora } : {}),
      };
    }),
    videos,
  );

  const reporte: Reporte = {
    solo_verificar: !base,
    columnas: planilla.columnas,
    columnas_faltantes: planilla.columnasFaltantes,
    tomas_validas: [],
    clips_calibracion: {},
    filas_sin_video: asociados.filasSinVideo.map(({ indice, motivo }) => ({
      fila: planilla.tomas[indice]!.fila,
      codigo: planilla.tomas[indice]!.campos.codigo_toma ?? "",
      motivo,
    })),
    videos_sin_fila: asociados.videosSinFila,
    valores_invalidos,
    paquetes_rechazados: [],
    asociacion: { nombre: 0, hora: 0, orden: 0 },
    etiquetadores_sin_identificar: 0,
  };

  await mkdir(salida, { recursive: true });
  const listas: { toma: TomaEjecucion; paquete: PaqueteListo }[] = [];
  const clips: { clip: ClipCalibracion; archivo: string; guardado: ClipGuardado }[] = [];
  for (const [indice, fila] of interpretadas) {
    const par = asociados.pares.get(indice);
    if (!par) continue;
    const video = join(entrada, par.nombre);
    try {
      if (fila.tipo === "calibracion") {
        if (base) {
          const guardado = await guardarClip(fila, video, par.nombre, salida);
          clips.push({ clip: fila, archivo: par.nombre, guardado });
        }
        (reporte.clips_calibracion[fila.instrumento] ??= []).push(fila.codigo);
      } else {
        if (base) {
          const paquete = await crearPaquete(fila, video, par.nombre, par.metodo, salida);
          listas.push({ toma: fila, paquete });
        }
        reporte.tomas_validas.push(fila.codigo);
        reporte.etiquetadores_sin_identificar += fila.etiquetas.filter((e) =>
          e.etiquetador.startsWith("ETQ-"),
        ).length;
      }
      reporte.asociacion[par.metodo]++;
    } catch (error) {
      if (!(error instanceof PaqueteRechazado)) throw error;
      reporte.paquetes_rechazados.push({ codigo: fila.codigo, motivo: error.message });
    }
  }

  if (base) {
    await prepararEsquema(base);
    await registrarParticipantes(
      base,
      listas.map((l) => l.toma),
    );
    for (const { toma, paquete } of listas) await registrarToma(base, toma, paquete);
    for (const { clip, archivo, guardado } of clips) {
      await registrarClip(base, clip, archivo, guardado);
    }
  }

  await writeFile(join(salida, "reporte-ingesta.json"), `${JSON.stringify(reporte, null, 2)}\n`);
  return reporte;
}

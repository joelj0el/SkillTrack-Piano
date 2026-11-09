import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { asociar, type MetodoAsociacion, type VideoParaAsociar } from "./asociar.ts";
import { crearPaquete, PaqueteRechazado, type PaqueteListo } from "./paquetes.ts";
import { leerPlanilla } from "./planilla.ts";
import { prepararEsquema, registrarParticipantes, registrarToma, type Base } from "./registro.ts";
import { interpretar, type Problema, type Toma, type TomaEjecucion } from "./validar.ts";

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
  tomas_validas: string[];
  tomas_cal: string[];
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
  const tomas = new Map<number, Toma>();
  const vistos = new Set<string>();
  planilla.tomas.forEach((fila, indice) => {
    const { toma, problemas } = interpretar(fila, planilla.valores, fecha);
    valores_invalidos.push(...problemas);
    if (!toma) return;
    if (vistos.has(toma.codigo)) {
      valores_invalidos.push({
        fila: fila.fila,
        codigo: toma.codigo,
        campo: "codigo_toma",
        valor: toma.codigo,
        motivo: "Código repetido en la planilla",
      });
      return;
    }
    vistos.add(toma.codigo);
    tomas.set(indice, toma);
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
    tomas_validas: [],
    tomas_cal: [],
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
  for (const [indice, toma] of tomas) {
    const par = asociados.pares.get(indice);
    if (!par) continue;
    let paquete: PaqueteListo | null = null;
    if (base) {
      try {
        paquete = await crearPaquete(
          toma,
          join(entrada, par.nombre),
          par.nombre,
          par.metodo,
          salida,
        );
      } catch (error) {
        if (!(error instanceof PaqueteRechazado)) throw error;
        reporte.paquetes_rechazados.push({ codigo: toma.codigo, motivo: error.message });
        continue;
      }
    }
    reporte.asociacion[par.metodo]++;
    if (toma.tipo === "calibracion") {
      reporte.tomas_cal.push(toma.codigo);
      continue;
    }
    reporte.tomas_validas.push(toma.codigo);
    reporte.etiquetadores_sin_identificar += toma.etiquetas.filter((e) =>
      e.etiquetador.startsWith("ETQ-"),
    ).length;
    if (paquete) listas.push({ toma, paquete });
  }

  if (base) {
    await prepararEsquema(base);
    await registrarParticipantes(
      base,
      listas.map((l) => l.toma),
    );
    for (const { toma, paquete } of listas) await registrarToma(base, toma, paquete);
  }

  await writeFile(join(salida, "reporte-ingesta.json"), `${JSON.stringify(reporte, null, 2)}\n`);
  return reporte;
}

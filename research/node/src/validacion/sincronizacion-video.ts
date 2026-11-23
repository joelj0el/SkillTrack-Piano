/**
 * TI-HU11-05 sobre un video suelto (p. ej., un clip de palmadas del autor): se procesa con el
 * mismo procesador del reprocesamiento, pero sin paquete, sin sesión y sin base. No se registra
 * como toma ni se escribe nada junto al video, así que nunca entra en las bandas, el conjunto de
 * datos ni las demás validaciones: lo único que queda es la tabla de sincronización.
 */
import { basename, extname } from "node:path";
import { leerCalibracion } from "../calibrar/calibracion.ts";
import { leerCodecs } from "../reprocesar/codecs.ts";
import type { Procesador } from "../reprocesar/reprocesar.ts";
import type { TomaSincronizacion } from "./sincronizacion.ts";

/** Con un clip sin marcar no hay homografía; la medida no usa el teclado (solo manos y audio). */
const IDENTIDAD = [1, 0, 0, 0, 1, 0, 0, 0, 1];
const PIANO_COMPLETO = { min: 21, max: 108 };

export class ErrorVideoSuelto extends Error {}

export async function tomaDeVideoSuelto(o: {
  video: string;
  /** Clip de calibración (mismo encuadre) o calibracion-*.json marcado con pnpm calibrar. */
  calibracion: string;
  procesador: Procesador;
}): Promise<TomaSincronizacion> {
  const { procesador } = o;
  const video = await procesador.comprobar(o.video);
  if (!video.decodificable) {
    throw new ErrorVideoSuelto(`No se puede decodificar ${o.video}: ${video.motivo}`);
  }
  let encuadre: { ancho: number; alto: number };
  let homografia = IDENTIDAD;
  let rango = PIANO_COMPLETO;
  if (extname(o.calibracion).toLowerCase() === ".json") {
    const cal = await leerCalibracion(o.calibracion);
    encuadre = cal.video;
    homografia = cal.homografia;
    rango = cal.rango;
  } else {
    const clip = await procesador.comprobar(o.calibracion);
    if (!clip.decodificable) {
      throw new ErrorVideoSuelto(`No se puede decodificar ${o.calibracion}: ${clip.motivo}`);
    }
    encuadre = clip;
  }
  if (encuadre.ancho !== video.ancho || encuadre.alto !== video.alto) {
    throw new ErrorVideoSuelto(
      `La calibración es de ${encuadre.ancho}x${encuadre.alto} y el video de ${video.ancho}x${video.alto}: no son del mismo encuadre`,
    );
  }
  const salida = await procesador.procesar(o.video, {
    homografia,
    rango,
    esperadas: [],
    metronomo: "sin",
    tempo: null,
    tiempos: (await leerCodecs(o.video)).tiempos,
  });
  if (!salida.audio.pista) {
    throw new ErrorVideoSuelto(`${o.video} no tiene audio (${salida.audio.motivo ?? "sin pista"})`);
  }
  return {
    codigo_toma: basename(o.video),
    origen: "real",
    fotogramas: salida.fotogramas,
    ataques: (salida.analisis.acustico?.oidas ?? []).map((a) => a.t),
  };
}

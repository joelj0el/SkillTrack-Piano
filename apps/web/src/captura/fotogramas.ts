import { agregarAlBufer, muestrasDelFotograma, type Series } from "@skilltrack/core";

/** Lo que se usa del elemento de video (así se prueba sin cámara). */
export type VideoConFotogramas = Partial<
  Pick<HTMLVideoElement, "requestVideoFrameCallback" | "cancelVideoFrameCallback" | "currentTime">
>;

/**
 * Llama a `alFotograma` una sola vez por fotograma de video nuevo, con su instante (ms, mismo
 * reloj que performance.now): el de captura si el navegador lo da; si no, el de presentación.
 * Sin requestVideoFrameCallback, cada cuadro de pantalla en que el video avanzó. Devuelve la
 * función que detiene el bucle.
 */
export function cadaFotograma(
  video: VideoConFotogramas,
  alFotograma: (tMs: number) => void,
): () => void {
  let ultimo = -Infinity;
  let activo = true;
  const entregar = (t: number) => {
    if (!activo || t <= ultimo) return;
    ultimo = t;
    alFotograma(t);
  };
  if (video.requestVideoFrameCallback) {
    let id = 0;
    const paso: VideoFrameRequestCallback = (_ahora, datos) => {
      if (!activo) return;
      id = video.requestVideoFrameCallback!(paso);
      entregar(datos.captureTime ?? datos.presentationTime);
    };
    id = video.requestVideoFrameCallback(paso);
    return () => {
      activo = false;
      video.cancelVideoFrameCallback?.(id);
    };
  }
  let cuadro = 0;
  let tiempoVideo = -1;
  const paso = (ahora: number) => {
    if (!activo) return;
    cuadro = requestAnimationFrame(paso);
    if (video.currentTime === tiempoVideo) return;
    tiempoVideo = video.currentTime ?? -1;
    entregar(ahora);
  };
  cuadro = requestAnimationFrame(paso);
  return () => {
    activo = false;
    cancelAnimationFrame(cuadro);
  };
}

/** Lo que el búfer usa del fotograma de la vista (Fotograma en Practica.tsx). */
export interface FotogramaDetectado {
  deteccion: { t: number };
  asignacion: Parameters<typeof muestrasDelFotograma>[0];
  ancho: number;
  alto: number;
}

/**
 * Agrega al búfer las muestras del fotograma de detección con la marca de tiempo de su fotograma
 * de video (relativa a `inicioMs`), no con la del cuadro de pantalla que lo lee: leído otra vez,
 * no avanza en el tiempo y el búfer lo descarta.
 */
export function agregarFotograma(series: Series, f: FotogramaDetectado, inicioMs: number): number {
  const t = (f.deteccion.t * 1000 - inicioMs) / 1000;
  return agregarAlBufer(series, muestrasDelFotograma(f.asignacion, f.ancho, f.alto, t));
}

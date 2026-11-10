export type MetodoAsociacion = "nombre" | "hora" | "orden";

export interface FilaParaAsociar {
  indice: number;
  archivo?: string;
  /** Segundo del día anotado en la planilla. */
  hora?: number;
}

export interface VideoParaAsociar {
  nombre: string;
  /** Segundo del día en que se grabó. */
  segundo?: number;
}

export interface Asociacion {
  pares: Map<number, { nombre: string; metodo: MetodoAsociacion }>;
  filasSinVideo: { indice: number; motivo: string }[];
  videosSinFila: string[];
}

// La hora se anota al terminar la toma: 5 min separan una toma de la siguiente sin ambigüedad.
export const TOLERANCIA_HORA_S = 300;

function sinExtension(nombre: string): string {
  return nombre.toLowerCase().replace(/\.[^.]+$/, "");
}

/**
 * Asociar mal un video atribuiría una ejecución a otra persona: ante la duda la fila queda sin
 * video y se informa, nunca se elige uno por descarte.
 */
export function asociar(filas: FilaParaAsociar[], videos: VideoParaAsociar[]): Asociacion {
  const pares: Asociacion["pares"] = new Map();
  const filasSinVideo: Asociacion["filasSinVideo"] = [];
  const usados = new Set<string>();

  for (const fila of filas.filter((f) => f.archivo)) {
    const buscado = fila.archivo!.toLowerCase();
    const video =
      videos.find((v) => v.nombre.toLowerCase() === buscado) ??
      videos.find((v) => sinExtension(v.nombre) === sinExtension(buscado));
    if (!video) {
      filasSinVideo.push({ indice: fila.indice, motivo: `No existe el archivo ${fila.archivo}` });
    } else if (usados.has(video.nombre)) {
      filasSinVideo.push({ indice: fila.indice, motivo: `${video.nombre} ya está asociado` });
    } else {
      usados.add(video.nombre);
      pares.set(fila.indice, { nombre: video.nombre, metodo: "nombre" });
    }
  }

  const porTiempo = [...videos].sort(
    (a, b) => (a.segundo ?? 0) - (b.segundo ?? 0) || a.nombre.localeCompare(b.nombre),
  );
  const pendientes = filas.filter((f) => !f.archivo);
  const conHora = pendientes.filter((f) => f.hora !== undefined).sort((a, b) => a.hora! - b.hora!);
  for (const fila of conHora) {
    const video = porTiempo.find(
      (v) =>
        !usados.has(v.nombre) &&
        v.segundo !== undefined &&
        Math.abs(v.segundo - fila.hora!) <= TOLERANCIA_HORA_S,
    );
    if (video) {
      usados.add(video.nombre);
      pares.set(fila.indice, { nombre: video.nombre, metodo: "hora" });
    } else {
      filasSinVideo.push({ indice: fila.indice, motivo: "Ningún video coincide con su hora" });
    }
  }

  const sinHora = pendientes.filter((f) => f.hora === undefined);
  const libres = porTiempo.filter((v) => !usados.has(v.nombre));
  if (sinHora.length === libres.length) {
    sinHora.forEach((fila, i) => {
      const video = libres[i]!;
      usados.add(video.nombre);
      pares.set(fila.indice, { nombre: video.nombre, metodo: "orden" });
    });
  } else {
    for (const fila of sinHora) {
      filasSinVideo.push({
        indice: fila.indice,
        motivo: "Sin archivo ni hora, y la cantidad de videos libres no coincide",
      });
    }
  }

  return {
    pares,
    filasSinVideo: filasSinVideo.sort((a, b) => a.indice - b.indice),
    videosSinFila: videos
      .map((v) => v.nombre)
      .filter((n) => !usados.has(n))
      .sort((a, b) => a.localeCompare(b)),
  };
}

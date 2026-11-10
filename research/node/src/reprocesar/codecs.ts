import { open, type FileHandle } from "node:fs/promises";

export interface Codecs {
  video: string | null;
  audio: string | null;
  /** Centro de cada fotograma (s), de la tabla de tiempos de la pista de video. */
  tiempos: number[] | null;
}

const CAJAS_CON_HIJOS = new Set(["moov", "trak", "mdia", "minf", "stbl"]);

interface Caja {
  tipo: string;
  datos: number;
  fin: number;
}

async function leerCaja(
  archivo: FileHandle,
  posicion: number,
  limite: number,
): Promise<Caja | null> {
  if (posicion + 8 > limite) return null;
  const cabecera = Buffer.alloc(16);
  await archivo.read(cabecera, 0, 16, posicion);
  const tamano32 = cabecera.readUInt32BE(0);
  const tipo = cabecera.toString("latin1", 4, 8);
  let tamano = tamano32;
  let datos = posicion + 8;
  if (tamano32 === 1) {
    tamano = Number(cabecera.readBigUInt64BE(8));
    datos = posicion + 16;
  } else if (tamano32 === 0) {
    tamano = limite - posicion;
  }
  if (tamano < 8) return null;
  return { tipo, datos, fin: Math.min(posicion + tamano, limite) };
}

async function texto4(archivo: FileHandle, posicion: number): Promise<string> {
  const b = Buffer.alloc(4);
  await archivo.read(b, 0, 4, posicion);
  return b.toString("latin1");
}

async function escalaDeTiempo(archivo: FileHandle, datos: number): Promise<number> {
  const b = Buffer.alloc(24);
  await archivo.read(b, 0, 24, datos);
  return b.readUInt32BE(b[0] === 1 ? 20 : 12);
}

async function tiemposDeMuestras(
  archivo: FileHandle,
  datos: number,
  escala: number,
): Promise<number[]> {
  const cabecera = Buffer.alloc(8);
  await archivo.read(cabecera, 0, 8, datos);
  const entradas = cabecera.readUInt32BE(4);
  const tabla = Buffer.alloc(entradas * 8);
  await archivo.read(tabla, 0, tabla.length, datos + 8);
  const tiempos: number[] = [];
  let acumulado = 0;
  for (let i = 0; i < entradas; i++) {
    const cuantas = tabla.readUInt32BE(i * 8);
    const delta = tabla.readUInt32BE(i * 8 + 4);
    for (let k = 0; k < cuantas; k++) {
      tiempos.push((acumulado + delta / 2) / escala);
      acumulado += delta;
    }
  }
  return tiempos;
}

/**
 * Formato de las pistas de video y audio de un MP4 o MOV ("avc1", "hvc1", "mp4a"…), leído de su
 * tabla de muestras. Otro contenedor devuelve null: lo que decide es la prueba en el navegador.
 */
export async function leerCodecs(ruta: string): Promise<Codecs> {
  const archivo = await open(ruta, "r");
  try {
    const { size } = await archivo.stat();
    const codecs: Codecs = { video: null, audio: null, tiempos: null };
    const primera = await leerCaja(archivo, 0, size);
    if (primera?.tipo !== "ftyp") return codecs;

    let pista: "vide" | "soun" | null = null;
    let escala = 0;
    const recorrer = async (inicio: number, fin: number): Promise<void> => {
      let posicion = inicio;
      for (let caja = await leerCaja(archivo, posicion, fin); caja;) {
        if (caja.tipo === "trak") pista = null;
        if (caja.tipo === "mdhd") {
          escala = await escalaDeTiempo(archivo, caja.datos);
        } else if (caja.tipo === "stts" && pista === "vide" && escala > 0) {
          codecs.tiempos ??= await tiemposDeMuestras(archivo, caja.datos, escala);
        } else if (caja.tipo === "hdlr") {
          const manejador = await texto4(archivo, caja.datos + 8);
          pista = manejador === "vide" || manejador === "soun" ? manejador : null;
        } else if (caja.tipo === "stsd" && pista) {
          const formato = await texto4(archivo, caja.datos + 12);
          if (pista === "vide") codecs.video ??= formato;
          else codecs.audio ??= formato;
        } else if (CAJAS_CON_HIJOS.has(caja.tipo)) {
          await recorrer(caja.datos, caja.fin);
        }
        posicion = caja.fin;
        caja = await leerCaja(archivo, posicion, fin);
      }
    };
    await recorrer(0, size);
    return codecs;
  } finally {
    await archivo.close();
  }
}

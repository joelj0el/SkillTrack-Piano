import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CalibracionSesion, type EntradaCalibracion } from "@skilltrack/contracts";
import {
  VERSION_NUCLEO,
  aplicar,
  calibracion,
  coberturaDelRango,
  invertir,
  modeloTeclado,
  nombreNota,
  rangoEnCuadro,
  type Homografia,
  type ToquesCalibracion,
} from "@skilltrack/core";
import { asociarTomas, leerSesion, nombreSesion, rangoDeTomas } from "./sesion.ts";

export class ErrorCalibracion extends Error {}

export interface PedidoVista {
  rango: { min: number; max: number };
  ancho: number;
  alto: number;
  toques?: ToquesCalibracion | undefined;
}

export interface Vista {
  grave: string;
  aguda: string;
  homografia?: readonly number[];
  teclas?: { midi: number; negra: boolean; puntos: { x: number; y: number }[] }[];
  cubre?: boolean;
  faltan?: string[];
}

function modeloDe(rango: PedidoVista["rango"]) {
  if (rango.min > rango.max) throw new ErrorCalibracion("La nota grave supera a la aguda");
  return modeloTeclado(rango.min, rango.max);
}

function homografiaDe(toques: ToquesCalibracion, modelo: ReturnType<typeof modeloTeclado>) {
  try {
    return calibracion(toques, modelo);
  } catch {
    throw new ErrorCalibracion("Los 4 puntos no forman un cuadrilátero válido. Repítelos.");
  }
}

/** Misma geometría que la calibración de la app, sobre el fotograma del teclado vacío. */
export function previsualizar({ rango, ancho, alto, toques }: PedidoVista): Vista {
  const modelo = modeloDe(rango);
  const extremos = {
    grave: nombreNota(modelo.primeraBlanca),
    aguda: nombreNota(modelo.ultimaBlanca),
  };
  if (!toques) return extremos;
  const aPlano = homografiaDe(toques, modelo);
  const aImagen: Homografia = invertir(aPlano);
  const cobertura = rangoEnCuadro(aImagen, modelo, ancho, alto);
  return {
    ...extremos,
    homografia: aPlano,
    cubre: cobertura.cubre,
    faltan: cobertura.faltan,
    teclas: modelo.teclas.map((tecla) => {
      const [y0, y1] = tecla.negra ? [1, 3] : [0, 3];
      return {
        midi: tecla.midi,
        negra: tecla.negra,
        puntos: [
          { x: tecla.x0, y: y0! },
          { x: tecla.x1, y: y0! },
          { x: tecla.x1, y: y1! },
          { x: tecla.x0, y: y1! },
        ].map((p) => aplicar(aImagen, p)),
      };
    }),
  };
}

export async function guardarCalibracion(
  carpeta: string,
  entrada: EntradaCalibracion,
  ahora: () => Date,
): Promise<{ ruta: string; tomas: string[] }> {
  const { clips, tomas } = await leerSesion(carpeta);
  const clip = clips.find((c) => c.codigo === entrada.clip);
  if (!clip) throw new ErrorCalibracion(`No existe el clip ${entrada.clip} en esta sesión`);

  const vista = previsualizar(entrada);
  if (!vista.cubre) {
    throw new ErrorCalibracion(
      `El encuadre no cubre las teclas del rango: faltan las ${vista.faltan?.join(" y ")}.`,
    );
  }
  const asociadas = asociarTomas(clips, tomas).porClip[clip.codigo] ?? [];
  const necesario = rangoDeTomas(tomas.filter((t) => asociadas.includes(t.codigo)));
  if (necesario) {
    const cobertura = coberturaDelRango(modeloDe(entrada.rango), necesario.min, necesario.max);
    if (!cobertura.cubre) {
      throw new ErrorCalibracion(
        `El rango no alcanza para las tomas de este clip: faltan las ${cobertura.faltan.join(" y ")}.`,
      );
    }
  }

  const sesion = nombreSesion(clip);
  const documento = CalibracionSesion.parse({
    version: 1,
    sesion,
    clip: clip.codigo,
    instrumento: clip.instrumento,
    video: {
      archivo: clip.archivo,
      sha256: clip.sha256,
      ancho: entrada.ancho,
      alto: entrada.alto,
    },
    tiempo_fotograma_s: entrada.tiempo_fotograma_s,
    rango: entrada.rango,
    toques: entrada.toques,
    homografia: [...vista.homografia!],
    version_nucleo: VERSION_NUCLEO,
    guardada_en: ahora().toISOString(),
    tomas: asociadas,
  });
  const ruta = join(carpeta, `calibracion-${sesion}.json`);
  await writeFile(ruta, `${JSON.stringify(documento, null, 2)}\n`);
  return { ruta, tomas: asociadas };
}

export async function leerCalibracion(ruta: string): Promise<CalibracionSesion> {
  return CalibracionSesion.parse(JSON.parse(await readFile(ruta, "utf8")));
}

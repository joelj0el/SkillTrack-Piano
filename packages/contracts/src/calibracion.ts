import { z } from "zod";

const Punto = z.strictObject({ x: z.number(), y: z.number() });

const Toques = z.strictObject({
  frenteIzquierda: Punto,
  frenteDerecha: Punto,
  negrasIzquierda: Punto,
  negrasDerecha: Punto,
});

const Rango = z.strictObject({ min: z.int().min(0).max(127), max: z.int().min(0).max(127) });

/** Lo que marca el investigador sobre el fotograma del teclado vacío. */
export const EntradaCalibracion = z.strictObject({
  clip: z.string().min(1),
  ancho: z.int().positive(),
  alto: z.int().positive(),
  tiempo_fotograma_s: z.number().nonnegative(),
  rango: Rango,
  toques: Toques,
});
export type EntradaCalibracion = z.infer<typeof EntradaCalibracion>;

/** calibracion-<sesion>.json: homografía de una sesión de grabación y las tomas que la usan. */
export const CalibracionSesion = z.strictObject({
  version: z.literal(1),
  sesion: z.string().min(1),
  clip: z.string().min(1),
  instrumento: z.enum(["acustico", "digital", "teclado"]),
  video: z.strictObject({
    archivo: z.string().min(1),
    sha256: z.string().length(64),
    ancho: z.int().positive(),
    alto: z.int().positive(),
  }),
  tiempo_fotograma_s: z.number().nonnegative(),
  rango: Rango,
  toques: Toques,
  /** Imagen → plano del teclado, 3×3 por filas. */
  homografia: z.array(z.number()).length(9),
  version_nucleo: z.string().min(1),
  guardada_en: z.iso.datetime(),
  tomas: z.array(z.string().min(1)),
});
export type CalibracionSesion = z.infer<typeof CalibracionSesion>;

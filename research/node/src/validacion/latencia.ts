/**
 * TI-HU19-03: latencia del metrónomo medida en una grabación externa del conteo previo.
 * Cada repetición es: el toque en "Empezar" (audible cerca del micrófono) y los 4 clics del
 * conteo. La app programa el primer clic 50 ms después del toque; lo que pasa de eso es la
 * latencia desde el toque (incluye la de la pantalla táctil y la de salida del audio). Sin el
 * toque grabado solo se informan los intervalos entre clics, nunca una latencia supuesta.
 */
import { detectarAtaques, PULSOS_CONTEO, reducirTasa } from "@skilltrack/core";
import { avisoTomas, num } from "./v1-informe.ts";
import { mediana } from "./v1.ts";

/** Margen con el que la app programa el primer clic tras el toque (PaginaPractica.tsx). */
export const MARGEN_PROGRAMADO_S = 0.05;

/** WAV PCM (8, 16, 24 o 32 bits, o flotante de 32 bits), mezclado a mono. */
export function leerWav(bytes: Uint8Array): { muestras: Float32Array; tasa: number } {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const etiqueta = (o: number) => String.fromCharCode(...bytes.subarray(o, o + 4));
  if (bytes.length < 44 || etiqueta(0) !== "RIFF" || etiqueta(8) !== "WAVE") {
    throw new Error("No es un archivo WAV (RIFF/WAVE)");
  }
  let formato = 0;
  let canales = 0;
  let tasa = 0;
  let bits = 0;
  let o = 12;
  while (o + 8 <= bytes.length) {
    const id = etiqueta(o);
    const largo = v.getUint32(o + 4, true);
    if (id === "fmt ") {
      formato = v.getUint16(o + 8, true);
      canales = v.getUint16(o + 10, true);
      tasa = v.getUint32(o + 12, true);
      bits = v.getUint16(o + 22, true);
      // WAVE_FORMAT_EXTENSIBLE: el formato real va en el subformato.
      if (formato === 0xfffe) formato = v.getUint16(o + 32, true);
    } else if (id === "data") {
      if (!tasa) throw new Error("WAV sin bloque fmt antes de los datos");
      const paso = bits / 8;
      const n = Math.floor(Math.min(largo, bytes.length - o - 8) / (paso * canales));
      const muestras = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        let suma = 0;
        for (let c = 0; c < canales; c++) {
          const p = o + 8 + (i * canales + c) * paso;
          suma +=
            formato === 3
              ? v.getFloat32(p, true)
              : bits === 8
                ? (v.getUint8(p) - 128) / 128
                : bits === 16
                  ? v.getInt16(p, true) / 32768
                  : bits === 24
                    ? (v.getUint8(p) | (v.getUint8(p + 1) << 8) | (v.getInt8(p + 2) << 16)) /
                      8388608
                    : v.getInt32(p, true) / 2147483648;
        }
        muestras[i] = suma / canales;
      }
      return { muestras, tasa };
    }
    o += 8 + largo + (largo % 2);
  }
  throw new Error("WAV sin bloque de datos");
}

export interface Repeticion {
  inicio_s: number;
  clics: number;
  /** null si el toque no quedó grabado. */
  latencia_ms: number | null;
  /** Intervalo medido − intervalo del tempo, entre clics consecutivos. */
  error_intervalos_ms: number[];
}

export interface ResultadoLatencia {
  tempo: number;
  repeticiones: Repeticion[];
}

export function latenciaMetronomo(
  muestras: Float32Array,
  tasa: number,
  tempo: number,
): ResultadoLatencia {
  const pulso = 60 / tempo;
  const reducida = reducirTasa(muestras, tasa);
  const ataques = detectarAtaques(reducida.muestras, reducida.tasa);
  // Las repeticiones quedan separadas por silencios largos.
  const grupos: number[][] = [];
  for (const t of ataques) {
    const ultimo = grupos.at(-1);
    if (ultimo && t - ultimo.at(-1)! <= 2.5 * pulso) ultimo.push(t);
    else grupos.push([t]);
  }
  const repeticiones = grupos
    .filter((g) => g.length >= PULSOS_CONTEO)
    .map((g) => {
      const clics = g.slice(-PULSOS_CONTEO);
      const antes = g.at(-PULSOS_CONTEO - 1);
      const toque = antes !== undefined && clics[0]! - antes < pulso ? antes : null;
      return {
        inicio_s: g[0]!,
        clics: clics.length,
        latencia_ms: toque === null ? null : (clics[0]! - toque - MARGEN_PROGRAMADO_S) * 1000,
        error_intervalos_ms: clics.slice(1).map((c, i) => (c - clics[i]! - pulso) * 1000),
      };
    });
  return { tempo, repeticiones };
}

export function tablaLatencia(r: ResultadoLatencia): string {
  const lat = r.repeticiones.flatMap((x) => (x.latencia_ms === null ? [] : [x.latencia_ms]));
  const intervalos = r.repeticiones.flatMap((x) => x.error_intervalos_ms);
  const p = [
    `# Latencia del metrónomo (♩ = ${r.tempo})`,
    "",
    "Latencia desde el toque = primer clic − toque − 50 ms programados por la app; incluye la latencia de la pantalla táctil y la de salida del audio.",
    "",
  ];
  const aviso = avisoTomas(r.repeticiones.length, "repeticiones");
  if (aviso) p.push(aviso, "");
  p.push(
    "| Repetición | Inicio (s) | Clics | Latencia desde el toque (ms) | Error de los intervalos (ms) |",
    "| --- | --- | --- | --- | --- |",
    ...r.repeticiones.map(
      (x, i) =>
        `| ${i + 1} | ${num(x.inicio_s, 2)} | ${x.clics} | ${x.latencia_ms === null ? "sin toque grabado" : num(x.latencia_ms)} | ${x.error_intervalos_ms.map((e) => num(e)).join(" · ")} |`,
    ),
    "",
    `Latencia mediana: ${num(mediana(lat))} ms (n = ${lat.length}) · máxima: ${num(lat.length ? Math.max(...lat) : null)} ms. Error de intervalo mediano: ${num(mediana(intervalos))} ms; máximo en valor absoluto: ${num(intervalos.length ? Math.max(...intervalos.map(Math.abs)) : null)} ms (n = ${intervalos.length}).`,
  );
  return `${p.join("\n").trimEnd()}\n`;
}

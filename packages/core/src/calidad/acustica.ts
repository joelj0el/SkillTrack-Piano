/**
 * Puerta de calidad acústica de la prueba de micrófono, en dos tramos: primero en silencio
 * (ruido de fondo: la resonancia del piano no se confunde con ruido) y luego tocando.
 * - ruido de fondo: dBFS de la mediana de la energía por bloque del tramo en silencio;
 * - nivel: dBFS del percentil 95 de la energía por bloque del tramo tocando;
 * - saturación: fracción de muestras con |x| ≥ 0,99 del tramo tocando.
 * PROPUESTA provisional de umbrales: se ratifican en S2 con los tres instrumentos.
 */
export const UMBRALES_ACUSTICOS = {
  nivelMinimoDb: -40,
  ruidoMaximoDbAmbar: -50,
  ruidoMaximoDbRojo: -35,
  saturacionMaxima: 0.001,
};

const BLOQUE = 1024;

function dbfs(rms: number): number {
  return 20 * Math.log10(Math.max(rms, 1e-10));
}

function percentil(valores: number[], p: number): number {
  const o = [...valores].sort((a, b) => a - b);
  return o[Math.min(o.length - 1, Math.floor(p * o.length))] ?? 0;
}

export interface MedidasAudio {
  nivelDb: number;
  ruidoDb: number;
  saturacion: number;
}

function rmsPorBloque(muestras: ArrayLike<number>): number[] {
  const rms: number[] = [];
  for (let i = 0; i + BLOQUE <= muestras.length; i += BLOQUE) {
    let suma = 0;
    for (let j = i; j < i + BLOQUE; j++) suma += muestras[j]! * muestras[j]!;
    rms.push(Math.sqrt(suma / BLOQUE));
  }
  return rms;
}

export function medirAudio(silencio: ArrayLike<number>, muestras: ArrayLike<number>): MedidasAudio {
  let saturadas = 0;
  for (let i = 0; i < muestras.length; i++) if (Math.abs(muestras[i]!) >= 0.99) saturadas++;
  return {
    nivelDb: dbfs(percentil(rmsPorBloque(muestras), 0.95)),
    ruidoDb: dbfs(percentil(rmsPorBloque(silencio), 0.5)),
    saturacion: muestras.length ? saturadas / muestras.length : 0,
  };
}

export interface SemaforoAudio {
  nivel: "verde" | "ambar" | "rojo";
  mensajes: string[];
}

export function evaluarAudio(m: MedidasAudio, u = UMBRALES_ACUSTICOS): SemaforoAudio {
  const mensajes: string[] = [];
  let nivel: SemaforoAudio["nivel"] = "verde";
  const subir = (n: "ambar" | "rojo") => {
    if (n === "rojo" || nivel === "verde") nivel = n;
  };
  if (m.saturacion > u.saturacionMaxima) {
    mensajes.push("Aleja el teléfono del instrumento o baja su volumen");
    subir("rojo");
  }
  if (m.ruidoDb > u.ruidoMaximoDbAmbar) {
    mensajes.push("Hay mucho ruido alrededor");
    subir(m.ruidoDb > u.ruidoMaximoDbRojo ? "rojo" : "ambar");
  }
  if (m.nivelDb < u.nivelMinimoDb) {
    mensajes.push("No se escucha el piano: acerca el teléfono");
    subir("ambar");
  }
  return { nivel, mensajes };
}

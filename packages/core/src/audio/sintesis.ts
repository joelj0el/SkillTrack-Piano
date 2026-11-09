/** Señales sintéticas deterministas para las pruebas del núcleo de audio (sin azar). */

/** Nota de piano simplificada: fundamental + 2 armónicos con caída exponencial. */
export function nota(
  muestras: Float32Array,
  frecuencia: number,
  inicio: number,
  tasa: number,
  amplitud = 0.5,
): void {
  const desde = Math.round(inicio * tasa);
  for (let i = desde; i < muestras.length; i++) {
    const t = (i - desde) / tasa;
    const envolvente = amplitud * Math.exp(-t * 6);
    if (envolvente < 1e-4) break;
    muestras[i]! +=
      envolvente *
      (Math.sin(2 * Math.PI * frecuencia * t) +
        0.5 * Math.sin(2 * Math.PI * 2 * frecuencia * t) +
        0.25 * Math.sin(2 * Math.PI * 3 * frecuencia * t));
  }
}

export function midiAHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Secuencia de notas en los instantes dados (s). */
export function secuencia(
  notas: readonly { midi: number; t: number; amplitud?: number }[],
  duracion: number,
  tasa: number,
): Float32Array {
  const muestras = new Float32Array(Math.ceil(duracion * tasa));
  for (const n of notas) nota(muestras, midiAHz(n.midi), n.t, tasa, n.amplitud);
  return muestras;
}

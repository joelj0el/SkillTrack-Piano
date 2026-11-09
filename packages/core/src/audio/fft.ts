/** FFT radix-2 iterativa (in situ) y espectro de magnitud por ventanas (STFT). */

export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if ((n & (n - 1)) !== 0) throw new Error("El tamaño de la FFT debe ser potencia de 2");
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j]!, re[i]!];
      [im[i], im[j]] = [im[j]!, im[i]!];
    }
  }
  for (let largo = 2; largo <= n; largo <<= 1) {
    const angulo = (-2 * Math.PI) / largo;
    for (let i = 0; i < n; i += largo) {
      for (let k = 0; k < largo / 2; k++) {
        const wr = Math.cos(angulo * k);
        const wi = Math.sin(angulo * k);
        const a = i + k;
        const b = a + largo / 2;
        const tr = re[b]! * wr - im[b]! * wi;
        const ti = re[b]! * wi + im[b]! * wr;
        re[b] = re[a]! - tr;
        im[b] = im[a]! - ti;
        re[a] = re[a]! + tr;
        im[a] = im[a]! + ti;
      }
    }
  }
}

export interface Stft {
  tamano: number;
  salto: number;
  tasa: number;
  /** Magnitud por ventana: cuadros[k][bin], bins 0 … tamano/2. */
  cuadros: Float64Array[];
}

/** STFT con ventana de Hann. El cuadro k empieza en la muestra k·salto. */
export function stft(senal: ArrayLike<number>, tasa: number, tamano = 1024, salto = 128): Stft {
  const hann = Float64Array.from(
    { length: tamano },
    (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / tamano),
  );
  const cuadros: Float64Array[] = [];
  for (let inicio = 0; inicio + tamano <= senal.length; inicio += salto) {
    const re = new Float64Array(tamano);
    const im = new Float64Array(tamano);
    for (let i = 0; i < tamano; i++) re[i] = senal[inicio + i]! * hann[i]!;
    fft(re, im);
    const magnitud = new Float64Array(tamano / 2 + 1);
    for (let b = 0; b <= tamano / 2; b++) magnitud[b] = Math.hypot(re[b]!, im[b]!);
    cuadros.push(magnitud);
  }
  return { tamano, salto, tasa, cuadros };
}

export function frecuenciaDeBin(bin: number, tamano: number, tasa: number): number {
  return (bin * tasa) / tamano;
}

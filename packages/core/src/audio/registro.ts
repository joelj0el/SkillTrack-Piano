/**
 * Banda de registro de un ataque (E9b, IND-B3): ¿la nota que acaba de entrar es la grave o la
 * aguda del par esperado? A manos juntas en octava, la mano izquierda suena una octava más grave.
 * Se compara cuánta energía aparece en la fundamental de cada nota justo después del ataque,
 * frente a justo antes. La nota aguda no aporta energía en la fundamental de la grave (está por
 * debajo de todos sus armónicos); la grave sí aporta en la aguda (su segundo armónico), por eso
 * basta con que la grave crezca con claridad.
 */
export const VENTANA_REGISTRO = 1024;
/** Fracción del aumento en la aguda que debe alcanzar la grave para atribuirle el ataque. */
const PROPORCION_GRAVE = 0.5;
const AUMENTO_MINIMO = 1e-6;

function energia(senal: ArrayLike<number>, tasa: number, inicio: number, frecuencia: number) {
  // Goertzel con ventana de Hann sobre VENTANA_REGISTRO muestras.
  const w = (2 * Math.PI * frecuencia) / tasa;
  const coef = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < VENTANA_REGISTRO; i++) {
    const hann = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (VENTANA_REGISTRO - 1));
    const s0 = (senal[inicio + i] ?? 0) * hann + coef * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return s1 * s1 + s2 * s2 - coef * s1 * s2;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

export function bandaEnAtaque(
  senal: ArrayLike<number>,
  tasa: number,
  ataque: number,
  midiGrave: number,
  midiAgudo: number,
): "grave" | "aguda" | null {
  const muestra = Math.round(ataque * tasa);
  const antes = Math.max(0, muestra - VENTANA_REGISTRO);
  const aumento = (midi: number) =>
    energia(senal, tasa, muestra, hz(midi)) - energia(senal, tasa, antes, hz(midi));
  const grave = aumento(midiGrave);
  const aguda = aumento(midiAgudo);
  if (grave <= AUMENTO_MINIMO && aguda <= AUMENTO_MINIMO) return null;
  return grave > PROPORCION_GRAVE * Math.max(aguda, 0) && grave > AUMENTO_MINIMO
    ? "grave"
    : "aguda";
}

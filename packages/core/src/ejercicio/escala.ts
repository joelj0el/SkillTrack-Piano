/**
 * Secuencia PROVISIONAL de una escala mayor mientras no exista la partitura transcrita:
 * tónica, 2 octavas de subida y de bajada (15 + 14 = 29 notas por mano), semicorcheas y, a manos
 * juntas, en octava paralela. No incluye digitación: esa sale solo de la partitura del panel.
 */
const PASOS_MAYOR = [2, 2, 1, 2, 2, 2, 1];

/** Clase de altura de la tónica por nombre (notación española). */
export const TONICAS: Record<string, number> = {
  Do: 0,
  "Do♯": 1,
  "Re♭": 1,
  Re: 2,
  "Mi♭": 3,
  Mi: 4,
  Fa: 5,
  "Fa♯": 6,
  Sol: 7,
  "La♭": 8,
  La: 9,
  "Si♭": 10,
  Si: 11,
};

export const NOMBRES_NOTA = [
  "Do",
  "Do♯",
  "Re",
  "Mi♭",
  "Mi",
  "Fa",
  "Fa♯",
  "Sol",
  "La♭",
  "La",
  "Si♭",
  "Si",
];

export function nombreNota(midi: number): string {
  return `${NOMBRES_NOTA[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

export interface NotaEsperada {
  idx: number;
  mano: "MI" | "MD";
  midi: number;
  claseAltura: number;
  /** Pulsos desde el inicio (semicorcheas: 0,25 por nota). */
  tiempoBeats: number;
}

/** "Do mayor", "Si♭ mayor"… → clase de altura de la tónica. */
export function tonicaDe(tonalidad: string): number {
  const nombre = tonalidad.replace(/\s*mayor\s*$/i, "").trim();
  const clase = TONICAS[nombre];
  if (clase === undefined) throw new Error(`Tonalidad no reconocida: ${tonalidad}`);
  return clase;
}

/** MIDI de la tónica de la mano derecha: la primera entre La3 (57) y Sol♯4 (68). */
export function tonicaManoDerecha(clase: number): number {
  const midi = 60 + clase;
  return midi > 68 ? midi - 12 : midi;
}

export function secuenciaEscala(
  tonalidad: string,
  manos: "MI" | "MD" | "juntas",
  octavas = 2,
): NotaEsperada[] {
  const inicioMd = tonicaManoDerecha(tonicaDe(tonalidad));
  const subida = [0];
  for (let i = 0; i < 7 * octavas; i++) subida.push(subida.at(-1)! + PASOS_MAYOR[i % 7]!);
  const offsets = [...subida, ...subida.slice(0, -1).reverse()];
  const notas: NotaEsperada[] = [];
  const agregar = (mano: "MI" | "MD", base: number) =>
    offsets.forEach((o, i) =>
      notas.push({
        idx: notas.length,
        mano,
        midi: base + o,
        claseAltura: (((base + o) % 12) + 12) % 12,
        tiempoBeats: i * 0.25,
      }),
    );
  if (manos !== "MD") agregar("MI", inicioMd - 12);
  if (manos !== "MI") agregar("MD", inicioMd);
  return notas;
}

export function rangoDe(notas: readonly NotaEsperada[]): { min: number; max: number } {
  const midis = notas.map((n) => n.midi);
  return { min: Math.min(...midis), max: Math.max(...midis) };
}

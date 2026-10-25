// Teclado que marca las teclas del ejercicio con el número de dedo esperado.
import type { ExpectedNote } from '../types';
import { NOTE_LABEL } from '../lib/format';

const WHITE = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const HAS_BLACK_AFTER = new Set(['C', 'D', 'F', 'G', 'A']);
const KEY_W = 44;

export default function KeyboardDiagram({ notes }: { notes: ExpectedNote[] }) {
  const naturals = notes.filter((n) => WHITE.includes(n.note));
  if (naturals.length === 0) return null;

  const minOct = Math.min(...naturals.map((n) => n.octave));
  const maxOct = Math.max(...naturals.map((n) => n.octave));
  const keys: { note: string; octave: number }[] = [];
  for (let oct = minOct; oct <= maxOct; oct++) {
    for (const note of WHITE) keys.push({ note, octave: oct });
  }
  // Se recorta el teclado al rango usado, con una tecla de margen a cada lado.
  const idx = (n: { note: string; octave: number }) => keys.findIndex((k) => k.note === n.note && k.octave === n.octave);
  const used = naturals.map(idx);
  const from = Math.max(0, Math.min(...used) - 1);
  const to = Math.min(keys.length - 1, Math.max(...used) + 1);
  const visible = keys.slice(from, to + 1);

  return (
    <div className="keyboard-wrap">
      <div className="keyboard" role="img" aria-label="Teclado con la digitación del ejercicio">
        {visible.map((key, i) => {
          const hits = naturals.filter((n) => n.note === key.note && n.octave === key.octave);
          const fingers = [...new Set(hits.map((h) => `${h.hand === 'left' ? 'I' : ''}${h.finger}`))];
          return (
            <div key={`${key.note}${key.octave}`} className={`white-key ${hits.length ? 'on' : ''}`}>
              {fingers.map((f) => (
                <span key={f} className="finger-dot" title={`Dedo ${f}`}>
                  {f}
                </span>
              ))}
              {NOTE_LABEL[key.note]}
              {key.note === 'C' && <sub>{key.octave}</sub>}
              {HAS_BLACK_AFTER.has(key.note) && i < visible.length - 1 && (
                <span className="black-key" style={{ left: KEY_W - 14 }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

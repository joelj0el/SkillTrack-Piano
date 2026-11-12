import type { EventoResultado } from "@skilltrack/contracts";

/**
 * Intento de ejemplo SINTÉTICO para revisar las reglas: ocho semicorcheas de la mano derecha
 * a 250 ms con un error de cada tipo que el núcleo mide. No viene de ninguna grabación.
 */
const ATAQUES_MS = [0, 250, 500, 750, 1060, 1250, 1500, 1750];
const MIDIS = [60, 62, 64, 65, 67, 69, 71, 72];

function evento(idx: number, cambios: Partial<EventoResultado> = {}): EventoResultado {
  return {
    idx,
    mano: "MD",
    midi_esperado: MIDIS[idx]!,
    dedo_esperado: (idx % 5) + 1,
    estado: "evaluado",
    motivo: null,
    ataque_ms: ATAQUES_MS[idx]!,
    modalidad: "VA",
    nota: { estado: "correcta", midi: MIDIS[idx]!, clase_oida: MIDIS[idx]! % 12, modalidad: "VA" },
    dedo: { valor: (idx % 5) + 1, estado: "correcto", modalidad: "V" },
    tecla: { midi: MIDIS[idx]!, zona: 0.4, modalidad: "V" },
    desfase_manos: null,
    rasgos: {},
    rasgos_modalidad: null,
    ...cambios,
  };
}

export const INTENTO_EJEMPLO = {
  descripcion: "Escala de Do mayor, mano derecha, 8 notas (sintético)",
  ejercicio: "EJ-01",
  cambio_tempo_pct: 1,
  eventos: [
    evento(0),
    evento(1),
    // Tecla equivocada.
    evento(2, { nota: { estado: "incorrecta", midi: 65, clase_oida: 5, modalidad: "A" } }),
    evento(3),
    // Llega 60 ms tarde: +24 % del intervalo local.
    evento(4),
    // Dedo distinto al indicado.
    evento(5, { dedo: { valor: 3, estado: "incorrecto", modalidad: "V" } }),
    // Toca en el borde delantero de la tecla.
    evento(6, { tecla: { midi: 71, zona: 0.05, modalidad: "V" } }),
    // La otra mano va una nota atrás.
    evento(7, {
      desfase_manos: { estado: "una-nota-atras", ms: null, mano_tarde: "MI", modalidad: "VA" },
    }),
  ],
};

import {
  CODIGOS_INDICADOR,
  type ConjuntoReglas,
  type EventoResultado,
} from "@skilltrack/contracts";

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

const PENDIENTE = "pendiente de aprobación del panel";
const NO_EVALUABLE = "No evaluable por diseño: el núcleo no registra este rasgo por evento";

/** Reglas y referencia de EJEMPLO para mostrar pantallas sin servidor (página de diseño). */
export const REGLAS_DE_EJEMPLO: ConjuntoReglas = {
  version: 1,
  version_taxonomia: "v0.1",
  indicadores: Object.fromEntries(
    CODIGOS_INDICADOR.map((c) => [
      c,
      ["IND-A1", "IND-B2", "IND-C1", "IND-D2"].includes(c)
        ? {
            clase: `ER-${c.charAt(4)}`,
            evaluable: true,
            motivo_no_evaluable: null,
            mensaje: PENDIENTE,
          }
        : {
            clase: `ER-${c.charAt(4)}`,
            evaluable: false,
            motivo_no_evaluable: NO_EVALUABLE,
            mensaje: PENDIENTE,
          },
    ]),
  ) as ConjuntoReglas["indicadores"],
  reglas: [
    {
      id: "R-A1-01",
      indicador: "IND-A1",
      alcance: "evento",
      modalidad: "A",
      condicion: { tipo: "estado", dato: "nota", valores: ["incorrecta", "faltante"] },
      minimo_eventos: 1,
    },
    {
      id: "R-B2-01",
      indicador: "IND-B2",
      alcance: "evento",
      modalidad: "A",
      condicion: { tipo: "fuera_de_banda", rasgo: "ataque.desvio_pct", lado: "cualquiera" },
      minimo_eventos: 1,
    },
    {
      id: "R-C1-01",
      indicador: "IND-C1",
      alcance: "evento",
      modalidad: "V",
      condicion: { tipo: "estado", dato: "dedo", valores: ["incorrecto"] },
      minimo_eventos: 1,
    },
    {
      id: "R-D2-01",
      indicador: "IND-D2",
      alcance: "evento",
      modalidad: "V",
      condicion: { tipo: "fuera_de_banda", rasgo: "tecla.zona", lado: "debajo" },
      minimo_eventos: 1,
    },
  ],
};

export const BANDAS_DE_EJEMPLO = INTENTO_EJEMPLO.eventos.flatMap((e) => [
  { unidad: `e${e.idx}`, rasgo: "tecla.zona", inferior: 0.2, superior: 0.6, centro: 0.4 },
  { unidad: `e${e.idx}`, rasgo: "ataque.desvio_pct", inferior: -15, superior: 15, centro: 0 },
]);

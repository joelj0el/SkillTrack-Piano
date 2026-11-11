/**
 * Registro por evento del intento (ResultadoIntento v2): un registro por nota esperada, con la
 * modalidad de cada dato. A = audio, V = visión, VA = ambos. Lo que no se midió queda en null:
 * nunca se completa con un valor supuesto.
 */
import type { AlineamientoPorMano, Modalidad } from "../alineacion/manos.ts";
import type { NotaEsperada } from "../ejercicio/escala.ts";
import { atribuirDedo, type DesfaseManos } from "../medidas/desfase.ts";
import type { EventoVisual } from "../rasgos/dedos.ts";
import type { IdMano } from "../rasgos/manos.ts";
import type { Dedo } from "../rasgos/rasgos.ts";

const NUMERO_DEDO: Record<Dedo, number> = {
  pulgar: 1,
  indice: 2,
  medio: 3,
  anular: 4,
  menique: 5,
};

export interface EventoRegistrado {
  idx: number;
  mano: IdMano;
  midi_esperado: number;
  dedo_esperado: number | null;
  estado: "evaluado" | "no-evaluable";
  motivo: string | null;
  ataque_ms: number | null;
  modalidad: Modalidad | null;
  nota: {
    estado: "correcta" | "incorrecta" | "dudosa" | "faltante";
    midi: number | null;
    clase_oida: number | null;
    modalidad: Modalidad | null;
  };
  dedo: {
    valor: number | null;
    estado: "correcto" | "incorrecto" | "sin-esperado" | "no-detectado";
    modalidad: "V" | null;
  };
  tecla: { midi: number | null; zona: number | null; modalidad: "V" | null };
  desfase_manos: {
    estado: DesfaseManos["estado"];
    ms: number | null;
    mano_tarde: IdMano | null;
    modalidad: Modalidad | null;
  } | null;
  rasgos: Record<string, number>;
  rasgos_modalidad: "V" | null;
}

const MOTIVO: Partial<Record<EventoRegistrado["nota"]["estado"], string>> = {
  faltante: "sin ataque",
  dudosa: "nota dudosa",
};

const redondear = (x: number) => Math.round(x * 10) / 10;

export function registrarEventos({
  esperadas,
  alineado,
  desfases,
  visuales,
  rasgosEn,
}: {
  esperadas: readonly NotaEsperada[];
  alineado: AlineamientoPorMano;
  desfases: ReadonlyMap<number, DesfaseManos>;
  visuales: readonly EventoVisual[];
  /** Rasgos de la mano en un instante (solo visión); por defecto, ninguno. */
  rasgosEn?: (mano: IdMano, t: number) => Record<string, number>;
}): EventoRegistrado[] {
  const porIdx = new Map(alineado.eventos.map((e) => [e.idx, e]));
  return esperadas.map((n) => {
    const evento = porIdx.get(n.idx) ?? {
      idx: n.idx,
      mano: n.mano,
      golpe: null,
      estado: "faltante" as const,
    };
    const golpe = evento.golpe;
    const atribuido = atribuirDedo(evento, n, visuales);
    const valor = atribuido.dedo ? NUMERO_DEDO[atribuido.dedo] : null;
    const estadoDedo =
      valor === null
        ? "no-detectado"
        : n.dedo === undefined
          ? "sin-esperado"
          : valor === n.dedo
            ? "correcto"
            : "incorrecto";
    const desfase = desfases.get(n.idx);
    const rasgos = golpe && rasgosEn ? rasgosEn(n.mano, golpe.t) : {};
    const motivo = MOTIVO[evento.estado] ?? null;
    return {
      idx: n.idx,
      mano: n.mano,
      midi_esperado: n.midi,
      dedo_esperado: n.dedo ?? null,
      estado: motivo ? "no-evaluable" : "evaluado",
      motivo,
      ataque_ms: golpe ? Math.round(golpe.t * 1000) : null,
      modalidad: golpe?.modalidad ?? null,
      nota: {
        estado: evento.estado,
        midi: golpe?.midi ?? null,
        clase_oida: golpe && golpe.ataque !== null ? golpe.clase : null,
        modalidad: golpe?.modalidad ?? null,
      },
      dedo: { valor, estado: estadoDedo, modalidad: valor === null ? null : "V" },
      tecla: {
        midi: atribuido.tecla,
        zona: atribuido.zona,
        modalidad: atribuido.visual === null ? null : "V",
      },
      desfase_manos: desfase
        ? {
            estado: desfase.estado,
            ms: desfase.ms === null ? null : redondear(desfase.ms),
            mano_tarde: desfase.manoTarde,
            modalidad: desfase.modalidad,
          }
        : null,
      rasgos,
      rasgos_modalidad: Object.keys(rasgos).length ? "V" : null,
    };
  });
}

/**
 * Máquina de estados del intento. Función pura: (estado, evento) → estado.
 * El tiempo llega en los eventos (segundos desde el inicio de la sesión de captura).
 */

export type Nivel = "verde" | "ambar" | "rojo";

export type Estado =
  | { fase: "encuadre"; nivel: Nivel; calibrado: boolean }
  | { fase: "conteo"; desde: number }
  | {
      fase: "tocando";
      desde: number;
      ultimaActividad: number;
      eventos: number;
    }
  | { fase: "analizando"; incompleta: boolean; eventos: number }
  | { fase: "no-evaluable"; motivo: string }
  | { fase: "cancelado" };

export type Evento =
  | { tipo: "semaforo"; nivel: Nivel }
  | { tipo: "calibrado" }
  | { tipo: "iniciar"; t: number }
  | { tipo: "fin-conteo"; t: number }
  | { tipo: "actividad"; t: number; eventos: number }
  | { tipo: "tick"; t: number }
  | { tipo: "camara-movida" }
  | { tipo: "cancelar" };

export interface Plan {
  /** Eventos esperados del ejercicio con las manos de la tarea. */
  eventosEsperados: number;
  /** Duración esperada de la ejecución (s) al tempo elegido. */
  duracionEsperada: number;
}

// PRM-15: quietud tras el último evento esperado y límite relativo a la duración esperada.
export const QUIETUD_FINAL = 1.5;
export const LIMITE_RELATIVO = 1.5;

/** Semicorcheas en 2/4: cuatro notas por pulso. */
export function duracionEsperada(eventos: number, tempoBpm: number): number {
  return (eventos * 60) / (tempoBpm * 4);
}

export const INICIAL: Estado = { fase: "encuadre", nivel: "rojo", calibrado: false };

/** "Continuar" solo con el semáforo en verde y la calibración hecha (PA-HU03-01, PA-HU03-02). */
export function puedeIniciar(e: Estado): boolean {
  return e.fase === "encuadre" && e.nivel === "verde" && e.calibrado;
}

export function transicion(e: Estado, ev: Evento, plan: Plan): Estado {
  if (ev.tipo === "cancelar" && (e.fase === "conteo" || e.fase === "tocando")) {
    return { fase: "cancelado" };
  }
  switch (e.fase) {
    case "encuadre":
      if (ev.tipo === "semaforo") return { ...e, nivel: ev.nivel };
      if (ev.tipo === "calibrado") return { ...e, calibrado: true };
      if (ev.tipo === "iniciar" && puedeIniciar(e)) return { fase: "conteo", desde: ev.t };
      return e;
    case "conteo":
      if (ev.tipo === "fin-conteo") {
        return { fase: "tocando", desde: ev.t, ultimaActividad: ev.t, eventos: 0 };
      }
      return e;
    case "tocando": {
      if (ev.tipo === "camara-movida") {
        return { fase: "no-evaluable", motivo: "Se movió la cámara" };
      }
      const actual =
        ev.tipo === "actividad"
          ? { ...e, ultimaActividad: ev.t, eventos: Math.max(e.eventos, ev.eventos) }
          : e;
      if (ev.tipo !== "actividad" && ev.tipo !== "tick") return e;
      const cubiertos = actual.eventos >= plan.eventosEsperados;
      if (cubiertos && ev.t - actual.ultimaActividad >= QUIETUD_FINAL) {
        return { fase: "analizando", incompleta: false, eventos: actual.eventos };
      }
      if (ev.t - actual.desde >= LIMITE_RELATIVO * plan.duracionEsperada) {
        return { fase: "analizando", incompleta: !cubiertos, eventos: actual.eventos };
      }
      return actual;
    }
    default:
      return e;
  }
}

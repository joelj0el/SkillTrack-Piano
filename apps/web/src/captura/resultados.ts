import type { Clase, Diagnostico, EventoDiagnosticable } from "@skilltrack/core";

/** Nombres de la taxonomía v0.1 (indicadores para el estudiante). */
export const NOMBRE_INDICADOR: Record<string, string> = {
  "IND-A1": "Tecla equivocada",
  "IND-B1": "Cambio de tempo (aceleras o frenas)",
  "IND-B2": "Tropiezo o pausa",
  "IND-B3": "Manos desfasadas",
  "IND-C1": "Dedo incorrecto",
  "IND-D1": "Dedo al fondo de la tecla",
  "IND-D2": "Dedo en el borde delantero",
  "IND-E1": "Dedos sin curvatura",
  "IND-F1": "Muñeca rígida",
  "IND-F2": "Dedos libres encogidos",
  "IND-F3": "Dedo libre levantado",
  "IND-F4": "Pulgar rígido",
};

/** Cada clase de error se califica como una variable con nombre neutro. */
export const NOMBRE_VARIABLE: Record<Clase, string> = {
  "ER-A": "Notas",
  "ER-B": "Ritmo",
  "ER-C": "Digitación",
  "ER-D": "Lugar del dedo en la tecla",
  "ER-E": "Curvatura de los dedos",
  "ER-F": "Soltura de mano y muñeca",
};

/** Orden de criticidad (§4.2, propuesta): la primera clase detectada es la corrección principal. */
const CRITICIDAD = ["ER-B", "ER-A", "ER-E", "ER-C", "ER-F", "ER-D"];

export function ordenarPorCriticidad(diagnosticos: readonly Diagnostico[]): Diagnostico[] {
  return [...diagnosticos].sort(
    (a, b) =>
      CRITICIDAD.indexOf(a.clase) - CRITICIDAD.indexOf(b.clase) ||
      b.eventos.length - a.eventos.length ||
      a.indicador.localeCompare(b.indicador),
  );
}

export type Familia = "correcto" | "nota" | "tiempo" | "mano" | "no-evaluable";

/** Familia de estado de una nota (DS-08): nota (A) · tiempo (B) · mano/dedo (C a F). */
export function familiaDeEvento(
  e: EventoDiagnosticable,
  diagnosticos: readonly Diagnostico[],
): Familia {
  if (e.estado === "no-evaluable") return "no-evaluable";
  const clases = new Set(diagnosticos.filter((d) => d.eventos.includes(e.idx)).map((d) => d.clase));
  if (clases.has("ER-A")) return "nota";
  if (clases.has("ER-B")) return "tiempo";
  if ([...clases].some((c) => ["ER-C", "ER-D", "ER-E", "ER-F"].includes(c))) return "mano";
  return "correcto";
}

/** HU-27: qué hacer cuando el intento no se pudo evaluar. */
export function accionSugerida(motivo: string, eventos: readonly EventoDiagnosticable[]): string {
  if (motivo === "Ejecución incompleta") return "Toca el ejercicio completo, hasta la última nota.";
  const sinEvaluar = eventos.filter(
    (e) => e.estado === "no-evaluable" || e.nota.estado === "dudosa",
  );
  const dudosas = sinEvaluar.filter((e) => e.nota.estado === "dudosa").length;
  if (sinEvaluar.length && dudosas * 2 >= sinEvaluar.length) {
    return "Busca un lugar más silencioso y vuelve a probar el micrófono.";
  }
  return "Vuelve a calibrar el teclado y revisa que tus manos se vean completas.";
}

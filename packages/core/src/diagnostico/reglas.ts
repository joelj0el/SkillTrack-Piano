/**
 * E13: motor de reglas declarativas. Las reglas (conjunto_reglas vN) son datos: comparan las
 * desviaciones respecto de la banda o el estado de cada evento y nombran el indicador y su clase.
 * Ante la falta de datos o de banda, el indicador queda "no evaluable", nunca dudoso.
 */
import type { Modalidad } from "../alineacion/manos.ts";
import {
  desviaciones,
  UNIDAD_EJECUCION,
  valoresDelIntento,
  type BandaDeReferencia,
  type Desviacion,
  type EventoMedible,
} from "./desviaciones.ts";

export interface CondicionBanda {
  tipo: "fuera_de_banda";
  rasgo: string;
  lado: "encima" | "debajo" | "cualquiera";
}

export interface CondicionEstado {
  tipo: "estado";
  dato: "nota" | "dedo" | "desfase_manos";
  valores: string[];
}

interface ReglaBase {
  id: string;
  indicador: string;
  modalidad: Modalidad;
}

/** Misma forma que una regla del contrato ConjuntoReglas. */
export type ReglaMotor =
  | (ReglaBase & {
      alcance: "evento";
      condicion: CondicionBanda | CondicionEstado;
      minimo_eventos: number;
    })
  | (ReglaBase & { alcance: "intento"; condicion: CondicionBanda });

export interface IndicadorMotor {
  clase: string;
  evaluable: boolean;
  motivo_no_evaluable: string | null;
  mensaje: string;
}

export interface ReglasMotor {
  version: number;
  indicadores: Record<string, IndicadorMotor>;
  reglas: ReglaMotor[];
}

export interface EventoDiagnosticable extends Omit<EventoMedible, "desfase_manos"> {
  nota: { estado: string };
  dedo: { estado: string };
  desfase_manos: { estado: string; ms: number | null; modalidad: Modalidad | null } | null;
}

export interface PedidoDiagnostico {
  eventos: readonly EventoDiagnosticable[];
  cambioTempoPct: number | null;
  referencia: { version: number; bandas: readonly BandaDeReferencia[] } | null;
  reglas: ReglasMotor;
}

export interface Diagnostico {
  indicador: string;
  clase: string;
  regla: string;
  /** idx de los eventos que lo evidencian; vacío para una regla de intento. */
  eventos: number[];
  mensaje: string;
}

export interface EstadoIndicador {
  estado: "detectado" | "sin-error" | "no-evaluable";
  motivo: string | null;
}

export interface ResultadoDiagnostico {
  version_reglas: number;
  version_referencia: number | null;
  diagnosticos: Diagnostico[];
  indicadores: Record<string, EstadoIndicador>;
}

type Evaluacion =
  | { estado: "dispara"; eventos: number[] }
  | { estado: "no-dispara" }
  | { estado: "no-evaluable"; motivo: string };

/** Un dato del evento se midió si su estado permite compararlo. */
function estadoMedido(e: EventoDiagnosticable, dato: CondicionEstado["dato"]): string | null {
  if (dato === "nota") return e.nota.estado;
  if (dato === "dedo")
    return ["correcto", "incorrecto"].includes(e.dedo.estado) ? e.dedo.estado : null;
  const d = e.desfase_manos;
  return d && d.estado !== "no-medible" ? d.estado : null;
}

function fueraDelLado(d: Desviacion, lado: CondicionBanda["lado"]): boolean {
  if (d.posicion === "encima") return lado !== "debajo";
  if (d.posicion === "debajo") return lado !== "encima";
  return false;
}

function evaluar(
  regla: ReglaMotor,
  eventos: readonly EventoDiagnosticable[],
  desvios: readonly Desviacion[],
  hayReferencia: boolean,
): Evaluacion {
  const minimo = regla.alcance === "evento" ? regla.minimo_eventos : 1;
  const c = regla.condicion;
  let disparan: number[];
  if (c.tipo === "estado") {
    const medidos = eventos.filter((e) => e.estado === "evaluado" && estadoMedido(e, c.dato));
    if (!medidos.length) return { estado: "no-evaluable", motivo: `Sin datos de ${c.dato}` };
    disparan = medidos
      .filter((e) => c.valores.includes(estadoMedido(e, c.dato)!))
      .map((e) => e.idx);
  } else {
    if (!hayReferencia) return { estado: "no-evaluable", motivo: "Sin referencia publicada" };
    const delAlcance = desvios.filter(
      (d) =>
        d.rasgo === c.rasgo && (regla.alcance === "intento") === (d.unidad === UNIDAD_EJECUCION),
    );
    const conBanda = delAlcance.filter((d) => d.posicion !== "sin-banda");
    if (!conBanda.length) {
      return {
        estado: "no-evaluable",
        motivo: delAlcance.length
          ? `La referencia no tiene banda para ${c.rasgo}`
          : `Sin datos de ${c.rasgo}`,
      };
    }
    disparan = conBanda.filter((d) => fueraDelLado(d, c.lado)).map((d) => d.idx ?? -1);
  }
  if (disparan.length < minimo) return { estado: "no-dispara" };
  return {
    estado: "dispara",
    eventos: regla.alcance === "intento" ? [] : disparan.sort((a, b) => a - b),
  };
}

export function diagnosticar(p: PedidoDiagnostico): ResultadoDiagnostico {
  const desvios = desviaciones(
    valoresDelIntento(p.eventos, p.cambioTempoPct),
    p.referencia?.bandas ?? [],
  );
  const diagnosticos: Diagnostico[] = [];
  const indicadores: Record<string, EstadoIndicador> = {};
  for (const codigo of Object.keys(p.reglas.indicadores).sort()) {
    const conf = p.reglas.indicadores[codigo]!;
    if (!conf.evaluable) {
      indicadores[codigo] = { estado: "no-evaluable", motivo: conf.motivo_no_evaluable };
      continue;
    }
    const evaluaciones = p.reglas.reglas
      .filter((r) => r.indicador === codigo)
      .map((r) => ({ regla: r, ev: evaluar(r, p.eventos, desvios, p.referencia !== null) }));
    for (const { regla, ev } of evaluaciones) {
      if (ev.estado === "dispara") {
        diagnosticos.push({
          indicador: codigo,
          clase: conf.clase,
          regla: regla.id,
          eventos: ev.eventos,
          mensaje: conf.mensaje,
        });
      }
    }
    const disparo = evaluaciones.some((x) => x.ev.estado === "dispara");
    const evaluada = evaluaciones.some((x) => x.ev.estado !== "no-evaluable");
    const sinEvaluar = evaluaciones.find((x) => x.ev.estado === "no-evaluable")?.ev;
    indicadores[codigo] = disparo
      ? { estado: "detectado", motivo: null }
      : evaluada
        ? { estado: "sin-error", motivo: null }
        : {
            estado: "no-evaluable",
            motivo: sinEvaluar?.estado === "no-evaluable" ? sinEvaluar.motivo : "Sin reglas",
          };
  }
  return {
    version_reglas: p.reglas.version,
    version_referencia: p.referencia?.version ?? null,
    diagnosticos,
    indicadores,
  };
}

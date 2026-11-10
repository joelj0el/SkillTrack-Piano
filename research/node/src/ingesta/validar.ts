import { normalizar, type FilaPlanilla } from "./planilla.ts";

export const CLASES_ERROR = ["ER-A", "ER-B", "ER-C", "ER-D", "ER-E", "ER-F"] as const;
// El repertorio tiene una única versión publicada de cada ejercicio.
const VERSION_DEL_EJERCICIO = 1;

export type Instrumento = "acustico" | "digital" | "teclado";
export type Ronda = "piloto" | "simple" | "doble" | "desempate";

export interface Problema {
  fila: number;
  codigo: string;
  campo: string;
  valor: string;
  motivo: string;
}

export interface EtiquetaDeToma {
  etiquetador: string;
  /** Clases marcadas por el etiquetador; "OK" deja la lista vacía. */
  clases: string[];
  /** El etiquetador escribió OK: sin errores y además aceptable. */
  aceptable: boolean;
  compasAprox: string | null;
  ronda: Ronda;
}

interface FilaBase {
  fila: number;
  codigo: string;
  campos: Record<string, string>;
  fecha: string;
  instrumento: Instrumento;
  institucion: string | null;
}

/** Fila CAL-: el teclado vacío de un instrumento. No es una toma. */
export interface ClipCalibracion extends FilaBase {
  tipo: "calibracion";
}

export interface TomaEjecucion extends FilaBase {
  tipo: "ejecucion";
  evaluable: boolean;
  origen: "real" | "actuado";
  dispositivo: string | null;
  condiciones: string | null;
  participante: string;
  rol: "docente_ref" | "estudiante";
  campana: "A" | "B" | "C";
  ejercicio: string;
  versionEjercicio: string;
  manos: "MI" | "MD" | "juntas";
  tempo: number;
  modoMetronomo: "con" | "sin";
  etiquetas: EtiquetaDeToma[];
}

export type FilaInterpretada = ClipCalibracion | TomaEjecucion;

const CODIGO_EJECUCION = /^([DE]\d+)-EJ-?(\d{2})-(MI|MD|JUN|JUNTAS)-(\d{2,3})-R(\d+)(-ACT)?$/i;
const CODIGO_CALIBRACION = /^CAL-([\p{L}]+)-(\d+)$/iu;
const SEUDONIMO_ETIQUETADOR = /^[A-Z]+-?\d+$/;

export function instrumentoDe(valor: string): Instrumento | null {
  const clave = normalizar(valor);
  if (clave.includes("acust")) return "acustico";
  if (clave.includes("digital")) return "digital";
  if (clave.includes("teclado")) return "teclado";
  return null;
}

function rolDe(valor: string): "docente_ref" | "estudiante" | null {
  const clave = normalizar(valor);
  if (clave.startsWith("docente")) return "docente_ref";
  if (clave === "estudiante") return "estudiante";
  return null;
}

function manosDe(valor: string): "MI" | "MD" | "juntas" | null {
  const clave = normalizar(valor);
  if (clave === "mi" || clave === "mano_izquierda") return "MI";
  if (clave === "md" || clave === "mano_derecha") return "MD";
  if (clave === "jun" || clave === "juntas" || clave === "manos_juntas") return "juntas";
  return null;
}

export function booleano(valor: string): boolean | null {
  const clave = normalizar(valor);
  if (["si", "s", "yes", "true", "1"].includes(clave)) return true;
  if (["no", "n", "false", "0"].includes(clave)) return false;
  return null;
}

/** Sin firma no se graba: solo pasan "si" y "firmado". Los clips CAL- no muestran a nadie. */
export function sinConsentimiento(campos: Record<string, string>): boolean {
  if (CODIGO_CALIBRACION.test(campos.codigo_toma ?? "")) return false;
  return !["si", "firmado"].includes(normalizar(campos.consentimiento ?? ""));
}

export function interpretar(
  { fila, campos }: FilaPlanilla,
  valores: Map<string, Set<string>>,
  fechaSesion: string,
): { interpretada: FilaInterpretada | null; problemas: Problema[] } {
  const codigo = campos.codigo_toma ?? "";
  const problemas: Problema[] = [];
  const reportar = (campo: string, valor: string, motivo: string) => {
    if (!problemas.some((p) => p.campo === campo)) {
      problemas.push({ fila, codigo, campo, valor, motivo });
    }
  };

  for (const [campo, permitidos] of valores) {
    const valor = campos[campo];
    if (!valor) continue;
    const normalizados = new Set([...permitidos].map(normalizar));
    if (!normalizados.has(normalizar(valor))) {
      reportar(campo, valor, "No está en la hoja Valores");
    }
  }

  const calibracion = CODIGO_CALIBRACION.exec(codigo);
  const ejecucion = CODIGO_EJECUCION.exec(codigo);
  if (!calibracion && !ejecucion) {
    reportar("codigo_toma", codigo, "No sigue el formato del protocolo");
    return { interpretada: null, problemas };
  }

  const instrumento = instrumentoDe(campos.instrumento || calibracion?.[1] || "");
  if (!instrumento) reportar("instrumento", campos.instrumento ?? "", "Instrumento no reconocido");

  const comunes = {
    fila,
    codigo,
    campos,
    fecha: campos.fecha || fechaSesion,
    instrumento: instrumento as Instrumento,
    institucion: campos.institucion || null,
  };

  if (calibracion) {
    const delCodigo = instrumentoDe(calibracion[1]!);
    if (delCodigo && instrumento && delCodigo !== instrumento) {
      reportar("instrumento", campos.instrumento ?? "", "Contradice el código del clip");
    }
    return {
      interpretada: problemas.length ? null : { ...comunes, tipo: "calibracion" },
      problemas,
    };
  }

  const evaluable = booleano(campos.evaluable ?? "");
  if (evaluable === null) reportar("evaluable", campos.evaluable ?? "", "Debe ser si o no");

  // La columna basta para marcarla actuada; solo hay contradicción si afirma real con -ACT.
  const actuadaPorCodigo = Boolean(ejecucion?.[6]);
  const origen = normalizar(campos.origen || (actuadaPorCodigo ? "actuado" : "real"));
  if (origen === "sintetico") {
    reportar("origen", campos.origen ?? "", "La ingesta solo produce tomas reales o actuadas");
  } else if (origen !== "real" && origen !== "actuado") {
    reportar("origen", campos.origen ?? "", "Debe ser real o actuado");
  } else if (origen === "real" && actuadaPorCodigo) {
    reportar("origen", campos.origen ?? "", "Contradice el sufijo -ACT del código");
  }

  const [, seudonimo, numero, manosCodigo, tempoCodigo, repeticion] = ejecucion!;
  const participante = seudonimo!.toUpperCase();
  const ejercicio = `EJ-${numero}`;
  const manos = manosDe(manosCodigo!)!;
  const tempo = Number(tempoCodigo);

  const contradice = (campo: string, igual: (valor: string) => boolean) => {
    const valor = campos[campo];
    if (valor && !igual(valor)) reportar(campo, valor, "Contradice el código de la toma");
  };
  contradice("seudonimo", (v) => v.toUpperCase() === participante);
  contradice("ejercicio", (v) => v.replace(/\D/g, "").padStart(2, "0") === numero);
  contradice("manos", (v) => manosDe(v) === manos);
  contradice("tempo", (v) => Number(v) === tempo);
  contradice("repeticion", (v) => Number(v.replace(/\D/g, "")) === Number(repeticion));
  const rol = participante.startsWith("D") ? "docente_ref" : "estudiante";
  contradice("rol", (v) => rolDe(v) === rol);

  const campana = (campos.campana || (participante.startsWith("D") ? "A" : "B")).toUpperCase();
  if (!["A", "B", "C"].includes(campana)) reportar("campana", campana, "Debe ser A, B o C");

  // El protocolo apaga el metrónomo tras el conteo: la ejecución es sin metrónomo.
  const modoMetronomo = normalizar(campos.modo_metronomo || "sin");
  if (modoMetronomo !== "con" && modoMetronomo !== "sin") {
    reportar("modo_metronomo", campos.modo_metronomo ?? "", "Debe ser con o sin");
  }

  const llenas = (["1", "2"] as const).filter((n) => campos[`etiquetas_${n}`]);
  const ronda = normalizar(campos.ronda || (llenas.length === 2 ? "doble" : "simple"));
  if (!["piloto", "simple", "doble", "desempate"].includes(ronda)) {
    reportar("ronda", campos.ronda ?? "", "Ronda no reconocida");
  }

  const etiquetas: EtiquetaDeToma[] = [];
  for (const n of llenas) {
    const campo = `etiquetas_${n}`;
    const tokens = campos[campo]!.toUpperCase()
      .split(/[\s,;]+/)
      .filter(Boolean);
    const invalido = tokens.find(
      (t) => t !== "OK" && !(CLASES_ERROR as readonly string[]).includes(t),
    );
    if (invalido) reportar(campo, invalido, "Clase de error fuera de la taxonomía");
    else if (tokens.includes("OK") && tokens.length > 1) {
      reportar(campo, campos[campo]!, "OK no se combina con errores");
    }
    const etiquetador = (campos[`etiquetador_${n}`] || `ETQ-${n}`).toUpperCase();
    if (!SEUDONIMO_ETIQUETADOR.test(etiquetador)) {
      reportar(`etiquetador_${n}`, etiquetador, "Debe ser un seudónimo");
    }
    etiquetas.push({
      etiquetador,
      clases: tokens.filter((t) => t !== "OK"),
      aceptable: tokens.includes("OK"),
      compasAprox: campos[`compas_aprox_${n}`] || campos.compas_aprox || null,
      ronda: ronda as Ronda,
    });
  }

  if (problemas.length) return { interpretada: null, problemas };
  return {
    interpretada: {
      ...comunes,
      tipo: "ejecucion",
      evaluable: evaluable as boolean,
      origen: origen as "real" | "actuado",
      dispositivo: campos.dispositivo || null,
      condiciones: campos.condiciones || null,
      participante,
      rol,
      campana: campana as "A" | "B" | "C",
      ejercicio,
      versionEjercicio: `${ejercicio}@${VERSION_DEL_EJERCICIO}`,
      manos,
      tempo,
      modoMetronomo: modoMetronomo as "con" | "sin",
      etiquetas,
    },
    problemas,
  };
}

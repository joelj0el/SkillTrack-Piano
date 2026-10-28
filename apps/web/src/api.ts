import type { z } from "zod";

// Debe coincidir con app/core/csrf.py de la API.
const CABECERA_CSRF = "x-skilltrack-csrf";

export class SinConexion extends Error {
  constructor() {
    super("Sin conexión");
  }
}

export class ErrorApi extends Error {
  readonly estado: number;
  readonly detalle: unknown;

  constructor(estado: number, detalle: unknown) {
    super(typeof detalle === "string" ? detalle : `Error ${estado}`);
    this.estado = estado;
    this.detalle = detalle;
  }

  /** Mensajes de validación por campo, si la API los devolvió con el formato de FastAPI. */
  campos(): Record<string, string> {
    if (!Array.isArray(this.detalle)) return {};
    const campos: Record<string, string> = {};
    for (const error of this.detalle as { loc?: unknown[]; msg?: string }[]) {
      const campo = error.loc?.at(-1);
      if (typeof campo === "string") campos[campo] = error.msg ?? "Valor no válido";
    }
    return campos;
  }
}

type Metodo = "GET" | "POST" | "PATCH";

export async function pedir<T>(
  metodo: Metodo,
  ruta: string,
  esquema: z.ZodType<T> | null,
  cuerpo?: unknown,
): Promise<T> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      credentials: "same-origin",
      headers: {
        ...(metodo === "GET" ? {} : { [CABECERA_CSRF]: "1" }),
        ...(cuerpo === undefined ? {} : { "content-type": "application/json" }),
      },
      body: cuerpo === undefined ? null : JSON.stringify(cuerpo),
    });
  } catch {
    throw new SinConexion();
  }
  if (respuesta.status === 204) return undefined as T;
  const datos: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const detalle = (datos as { detail?: unknown } | null)?.detail ?? null;
    throw new ErrorApi(respuesta.status, detalle);
  }
  return esquema ? esquema.parse(datos) : (datos as T);
}

import { ResultadoIntento } from "@skilltrack/contracts";
import { ErrorApi, SinConexion, pedir } from "../api.ts";

/**
 * Bandeja de salida: cada intento terminado se guarda primero en el teléfono y después se envía.
 * Solo guarda el ResultadoIntento (sin medios). El envío es idempotente por client_uuid.
 */
export type EstadoEnvio = "pendiente" | "guardado" | "rechazado";

export interface Entrada {
  client_uuid: string;
  resultado: ResultadoIntento;
  estado: EstadoEnvio;
  motivo?: string;
}

export interface Almacen {
  todas(): Promise<Entrada[]>;
  guardar(entrada: Entrada): Promise<void>;
}

export type Enviar = (resultado: ResultadoIntento) => Promise<void>;

export const enviarAlServidor: Enviar = async (resultado) => {
  await pedir("POST", "/intentos", null, resultado);
};

export async function encolar(almacen: Almacen, resultado: ResultadoIntento): Promise<void> {
  const valido = ResultadoIntento.parse(resultado);
  await almacen.guardar({
    client_uuid: valido.client_uuid,
    resultado: valido,
    estado: "pendiente",
  });
}

/** Envía los pendientes. Sin red, quedan pendientes; un 4xx los marca como rechazados. */
export async function vaciar(almacen: Almacen, enviar: Enviar = enviarAlServidor): Promise<void> {
  for (const entrada of await almacen.todas()) {
    if (entrada.estado !== "pendiente") continue;
    try {
      await enviar(entrada.resultado);
      await almacen.guardar({ ...entrada, estado: "guardado" });
    } catch (error) {
      if (error instanceof SinConexion) return;
      if (error instanceof ErrorApi && error.estado >= 400 && error.estado < 500) {
        await almacen.guardar({ ...entrada, estado: "rechazado", motivo: error.message });
      }
    }
  }
}

/** PRM-24: tras volver la red, el reenvío ocurre en ≤ 30 s (aquí, cada 10 s o al instante). */
export const INTERVALO_REINTENTO_MS = 10_000;

export function reintentarSolo(almacen: Almacen, enviar: Enviar = enviarAlServidor): () => void {
  const intentar = () => void vaciar(almacen, enviar);
  const temporizador = setInterval(intentar, INTERVALO_REINTENTO_MS);
  window.addEventListener("online", intentar);
  intentar();
  return () => {
    clearInterval(temporizador);
    window.removeEventListener("online", intentar);
  };
}

/** Almacén en IndexedDB del navegador. */
export function almacenIndexedDb(nombre = "skilltrack", tabla = "bandeja"): Almacen {
  const abrir = () =>
    new Promise<IDBDatabase>((ok, mal) => {
      const pedido = indexedDB.open(nombre, 1);
      pedido.onupgradeneeded = () =>
        pedido.result.createObjectStore(tabla, { keyPath: "client_uuid" });
      pedido.onsuccess = () => ok(pedido.result);
      pedido.onerror = () => mal(pedido.error);
    });
  const operar = <T>(modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>) =>
    abrir().then(
      (db) =>
        new Promise<T>((ok, mal) => {
          const pedido = f(db.transaction(tabla, modo).objectStore(tabla));
          pedido.onsuccess = () => ok(pedido.result);
          pedido.onerror = () => mal(pedido.error);
        }),
    );
  return {
    todas: () => operar<Entrada[]>("readonly", (s) => s.getAll() as IDBRequest<Entrada[]>),
    guardar: async (entrada) => {
      await operar("readwrite", (s) => s.put(entrada));
    },
  };
}

export function almacenEnMemoria(): Almacen & { datos: Map<string, Entrada> } {
  const datos = new Map<string, Entrada>();
  return {
    datos,
    todas: async () => [...datos.values()],
    guardar: async (e) => {
      datos.set(e.client_uuid, structuredClone(e));
    },
  };
}

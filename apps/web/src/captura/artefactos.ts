import { ReferenciaVigente, ReglasVigentes } from "@skilltrack/contracts";
import type { z } from "zod";
import { ErrorApi, pedir } from "../api.ts";

/**
 * Referencia y reglas vigentes: se descargan al abrir una tarea y se guardan en el teléfono para
 * practicar sin red. Su id viaja en el intento, que así registra con qué artefactos se analizó.
 */
export interface ArtefactosVigentes {
  referencia: ReferenciaVigente | null;
  reglas: ReglasVigentes | null;
}

export interface CacheArtefactos {
  leer(clave: string): Promise<unknown>;
  guardar(clave: string, valor: unknown): Promise<void>;
}

export type Descargar = <T>(ruta: string, esquema: z.ZodType<T>) => Promise<T>;

const descargarDelServidor: Descargar = (ruta, esquema) => pedir("GET", ruta, esquema);

async function vigente<T>(
  clave: string,
  ruta: string,
  esquema: z.ZodType<T>,
  cache: CacheArtefactos,
  descargar: Descargar,
): Promise<T | null> {
  try {
    const valor = await descargar(ruta, esquema);
    await cache.guardar(clave, valor);
    return valor;
  } catch (error) {
    if (error instanceof ErrorApi && error.estado === 404) {
      // Nada publicado todavía: se olvida lo que hubiera.
      await cache.guardar(clave, null);
      return null;
    }
    // Sin red o con el servidor caído, se practica con lo guardado.
    const guardado = esquema.safeParse(await cache.leer(clave));
    return guardado.success ? guardado.data : null;
  }
}

export async function artefactosVigentes(
  versionEjercicioId: number,
  cache: CacheArtefactos = cacheIndexedDB(),
  descargar: Descargar = descargarDelServidor,
): Promise<ArtefactosVigentes> {
  const referencia = await vigente(
    `referencia:${versionEjercicioId}`,
    `/catalogo/referencias/vigente?version_ejercicio_id=${versionEjercicioId}`,
    ReferenciaVigente,
    cache,
    descargar,
  );
  const reglas = await vigente(
    "reglas",
    "/catalogo/reglas/vigente",
    ReglasVigentes,
    cache,
    descargar,
  );
  return { referencia, reglas };
}

export function cacheEnMemoria(): CacheArtefactos {
  const datos = new Map<string, unknown>();
  return {
    leer: async (clave) => datos.get(clave),
    guardar: async (clave, valor) => void datos.set(clave, structuredClone(valor)),
  };
}

const BASE = "skilltrack-artefactos";
const TABLA = "vigentes";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(TABLA);
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => mal(pedido.error);
  });
}

export function cacheIndexedDB(): CacheArtefactos {
  return {
    async leer(clave) {
      const db = await abrir();
      return new Promise((ok, mal) => {
        const pedido = db.transaction(TABLA).objectStore(TABLA).get(clave);
        pedido.onsuccess = () => ok(pedido.result);
        pedido.onerror = () => mal(pedido.error);
      });
    },
    async guardar(clave, valor) {
      const db = await abrir();
      await new Promise<void>((ok, mal) => {
        const tx = db.transaction(TABLA, "readwrite");
        tx.objectStore(TABLA).put(valor, clave);
        tx.oncomplete = () => ok();
        tx.onerror = () => mal(tx.error);
      });
    },
  };
}

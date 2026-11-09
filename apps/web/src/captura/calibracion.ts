import type { ToquesCalibracion } from "@skilltrack/core";

/** Calibración guardada en el teléfono (IndexedDB), por rango de teclas y tamaño de imagen. */
export interface CalibracionGuardada {
  clave: string;
  toques: ToquesCalibracion;
  ancho: number;
  alto: number;
  guardada: string;
}

const BASE = "skilltrack-calibracion";
const TABLA = "calibraciones";

export function claveCalibracion(min: number, max: number, ancho: number, alto: number): string {
  return `${min}-${max}@${ancho}x${alto}`;
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, mal) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(TABLA, { keyPath: "clave" });
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => mal(pedido.error);
  });
}

export async function guardarCalibracion(c: CalibracionGuardada): Promise<void> {
  const db = await abrir();
  await new Promise<void>((ok, mal) => {
    const tx = db.transaction(TABLA, "readwrite");
    tx.objectStore(TABLA).put(c);
    tx.oncomplete = () => ok();
    tx.onerror = () => mal(tx.error);
  });
}

export async function leerCalibracion(clave: string): Promise<CalibracionGuardada | null> {
  const db = await abrir();
  return new Promise((ok, mal) => {
    const pedido = db.transaction(TABLA).objectStore(TABLA).get(clave);
    pedido.onsuccess = () => ok((pedido.result as CalibracionGuardada | undefined) ?? null);
    pedido.onerror = () => mal(pedido.error);
  });
}

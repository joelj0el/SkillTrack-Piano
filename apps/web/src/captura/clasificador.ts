import type { CargarClasificador } from "@skilltrack/core";

/**
 * HU-35: bandera del clasificador, apagada salvo que la compilación fije VITE_CLASIFICADOR=activo.
 * Con la bandera apagada la pantalla de resultados es la de las reglas, sin ningún cambio.
 */
export function banderaClasificador(entorno: { VITE_CLASIFICADOR?: string | undefined }): boolean {
  return entorno.VITE_CLASIFICADOR === "activo";
}

export const CLASIFICADOR_ACTIVO = banderaClasificador({
  VITE_CLASIFICADOR: import.meta.env.VITE_CLASIFICADOR as string | undefined,
});

/**
 * No hay modelo publicado: se exporta solo si supera a las reglas en el informe V3c (protocolo
 * congelado de la iteración 5). Mientras tanto, aun con la bandera encendida, no hay etiqueta.
 */
export const cargarClasificador: CargarClasificador = async () => null;

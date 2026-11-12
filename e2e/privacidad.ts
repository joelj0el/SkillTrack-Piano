/**
 * Revisión de privacidad de las E2E: ningún medio ni multipart, ningún cuerpo > 256 KB y ninguna
 * petición a otro origen. Cada petición se registra en el momento en que sale (evento "request"):
 * esperar sus cabeceras al final colgaba la prueba si la petición nunca terminaba.
 */
import { expect, type BrowserContext, type Page } from "@playwright/test";

export interface PeticionVista {
  url: string;
  tipo: string;
  bytes: number;
  origen: string;
}

const MEDIOS = /^(image|video|audio)\/|multipart\//i;
export const LIMITE_BYTES = 256 * 1024;

/** Registra lo que sale por `fuente` (la página o todo el contexto) desde este momento. */
export function registrarPeticiones(fuente: Page | BrowserContext): PeticionVista[] {
  const vistas: PeticionVista[] = [];
  fuente.on("request", (r) => {
    vistas.push({
      url: r.url(),
      tipo: r.headers()["content-type"] ?? "",
      bytes: r.postDataBuffer()?.length ?? 0,
      origen: new URL(r.url()).origin,
    });
  });
  return vistas;
}

export function verificarPrivacidad(peticiones: readonly PeticionVista[], origen: string): void {
  for (const p of peticiones) {
    expect(p.tipo, p.url).not.toMatch(MEDIOS);
    expect(p.bytes, p.url).toBeLessThanOrEqual(LIMITE_BYTES);
    expect(p.origen, p.url).toBe(origen);
  }
}

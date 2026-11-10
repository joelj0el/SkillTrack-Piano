import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type Server, type ServerResponse } from "node:http";
import { stripTypeScriptTypes } from "node:module";
import { extname, join, resolve, sep } from "node:path";
import { servirVideo } from "../calibrar/servidor.ts";

const RAIZ = resolve(import.meta.dirname, "../../../..");
const PAGINA = resolve(import.meta.dirname, "pagina.html");
const NUCLEO = join(RAIZ, "packages/core/src");
const MEDIAPIPE = join(RAIZ, "apps/web/public/mediapipe");
const VISION = join(RAIZ, "apps/web/node_modules/@mediapipe/tasks-vision/vision_bundle.mjs");
const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost"]);
const JS = "text/javascript; charset=utf-8";
const TIPOS: Record<string, string> = {
  ".js": JS,
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".task": "application/octet-stream",
};

// El núcleo usa propiedades de parámetro: hace falta el modo que Node admite y sus tipos omiten.
const TRANSFORMAR = { mode: "transform" } as unknown as { mode: "strip" };

function responder(res: ServerResponse, estado: number, tipo: string, cuerpo: string | Buffer) {
  res.writeHead(estado, { "content-type": tipo });
  res.end(cuerpo);
}

function noEncontrado(res: ServerResponse): void {
  responder(res, 404, "text/plain; charset=utf-8", "No encontrado");
}

function dentroDe(base: string, relativa: string): string | null {
  const ruta = resolve(base, relativa);
  return ruta.startsWith(base + sep) && existsSync(ruta) ? ruta : null;
}

export interface ServidorReproceso {
  servidor: Server;
  /** Autoriza un video y devuelve la ruta con la que la página lo pide. */
  publicar(ruta: string): string;
}

/**
 * Sirve la página, el núcleo tal como lo usa la app (se le quitan los tipos al vuelo, sin otra
 * compilación) y el detector autoalojado. De los videos, solo los que se publican.
 */
export function crearServidorReproceso(): ServidorReproceso {
  const videos = new Map<string, string>();
  const nucleo = new Map<string, string>();

  const atender = async (url: URL, req: Parameters<typeof servirVideo>[0], res: ServerResponse) => {
    const ruta = decodeURIComponent(url.pathname);
    if (ruta === "/") {
      responder(res, 200, "text/html; charset=utf-8", await readFile(PAGINA));
    } else if (ruta === "/vision.mjs") {
      responder(res, 200, JS, await readFile(VISION));
    } else if (ruta.startsWith("/nucleo/")) {
      const relativa = ruta.slice("/nucleo/".length);
      const archivo = relativa.endsWith(".test.ts") ? null : dentroDe(NUCLEO, relativa);
      if (!archivo || extname(archivo) !== ".ts") return noEncontrado(res);
      if (!nucleo.has(archivo)) {
        nucleo.set(archivo, stripTypeScriptTypes(await readFile(archivo, "utf8"), TRANSFORMAR));
      }
      responder(res, 200, JS, nucleo.get(archivo)!);
    } else if (ruta.startsWith("/mediapipe/")) {
      const archivo = dentroDe(MEDIAPIPE, ruta.slice("/mediapipe/".length));
      if (!archivo) return noEncontrado(res);
      const tipo = TIPOS[extname(archivo)] ?? "application/octet-stream";
      responder(res, 200, tipo, await readFile(archivo));
    } else if (ruta.startsWith("/video/")) {
      const archivo = videos.get(ruta.slice("/video/".length));
      if (!archivo) return noEncontrado(res);
      servirVideo(req, res, archivo);
    } else {
      noEncontrado(res);
    }
  };

  const servidor = createServer((req, res) => {
    const host = (req.headers.host ?? "").replace(/:\d+$/, "");
    if (!HOSTS_LOCALES.has(host)) {
      responder(res, 403, "text/plain; charset=utf-8", "Solo se atiende al equipo local");
      return;
    }
    if (req.method !== "GET") {
      responder(res, 405, "text/plain; charset=utf-8", "Solo lectura");
      return;
    }
    atender(new URL(req.url ?? "/", "http://local"), req, res).catch((error: unknown) => {
      console.error(error);
      responder(res, 500, "text/plain; charset=utf-8", "Error interno");
    });
  });

  return {
    servidor,
    publicar(ruta) {
      const id = randomUUID();
      videos.set(id, ruta);
      return `/video/${id}`;
    },
  };
}

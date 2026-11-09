import { createReadStream, existsSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { extname, join, resolve } from "node:path";
import { EntradaCalibracion } from "@skilltrack/contracts";
import { ErrorCalibracion, guardarCalibracion, previsualizar } from "./calibracion.ts";
import { asociarTomas, leerSesion, nombreSesion, rangoDeTomas } from "./sesion.ts";

const PAGINA = resolve(import.meta.dirname, "pagina.html");
const TOKENS = resolve(import.meta.dirname, "../../../../apps/web/src/design/tokens.css");
const LIMITE_CUERPO_BYTES = 64 * 1024;
const HOSTS_LOCALES = new Set(["127.0.0.1", "localhost"]);
const TIPOS_DE_VIDEO: Record<string, string> = { ".webm": "video/webm", ".mkv": "video/webm" };

const PedidoVista = EntradaCalibracion.pick({
  rango: true,
  ancho: true,
  alto: true,
  toques: true,
}).partial({ toques: true });

function json(res: ServerResponse, estado: number, cuerpo: unknown): void {
  res.writeHead(estado, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(cuerpo));
}

class ErrorDePedido extends Error {
  readonly estado: number;

  constructor(estado: number, mensaje: string) {
    super(mensaje);
    this.estado = estado;
  }
}

async function leerCuerpo(req: IncomingMessage): Promise<unknown> {
  // Un sitio ajeno no puede enviar JSON aquí sin una petición previa de CORS, que no se autoriza.
  if ((req.headers["content-type"] ?? "").split(";")[0] !== "application/json") {
    throw new ErrorDePedido(415, "Solo se acepta application/json");
  }
  const partes: Buffer[] = [];
  let total = 0;
  for await (const parte of req as AsyncIterable<Buffer>) {
    total += parte.length;
    if (total > LIMITE_CUERPO_BYTES) throw new ErrorDePedido(413, "El cuerpo es demasiado grande");
    partes.push(parte);
  }
  try {
    return JSON.parse(Buffer.concat(partes).toString("utf8"));
  } catch {
    throw new ErrorDePedido(400, "JSON no válido");
  }
}

function validar<T>(
  esquema: { safeParse(v: unknown): { success: boolean; data?: T } },
  v: unknown,
): T {
  const r = esquema.safeParse(v);
  if (!r.success) throw new ErrorDePedido(400, "Datos no válidos");
  return r.data as T;
}

async function datosDeSesion(carpeta: string) {
  const { clips, tomas } = await leerSesion(carpeta);
  const { porClip, sinCalibracion } = asociarTomas(clips, tomas);
  return {
    clips: clips.map((clip) => {
      const asociadas = porClip[clip.codigo] ?? [];
      const sesion = nombreSesion(clip);
      return {
        codigo: clip.codigo,
        instrumento: clip.instrumento,
        hora: clip.hora,
        sesion,
        tomas: asociadas,
        rango_sugerido: rangoDeTomas(tomas.filter((t) => asociadas.includes(t.codigo))),
        guardada: existsSync(join(carpeta, `calibracion-${sesion}.json`)),
      };
    }),
    sin_calibracion: sinCalibracion,
  };
}

/** Sirve por tramos: el navegador los necesita para saltar al fotograma elegido. */
function servirVideo(req: IncomingMessage, res: ServerResponse, ruta: string): void {
  const tamano = statSync(ruta).size;
  const tipo = TIPOS_DE_VIDEO[extname(ruta).toLowerCase()] ?? "video/mp4";
  const tramo = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (!tramo) {
    res.writeHead(200, {
      "content-type": tipo,
      "content-length": tamano,
      "accept-ranges": "bytes",
    });
    createReadStream(ruta).pipe(res);
    return;
  }
  const inicio = tramo[1] ? Number(tramo[1]) : 0;
  const fin = tramo[2] ? Math.min(Number(tramo[2]), tamano - 1) : tamano - 1;
  if (inicio > fin || inicio >= tamano) {
    res.writeHead(416, { "content-range": `bytes */${tamano}` });
    res.end();
    return;
  }
  res.writeHead(206, {
    "content-type": tipo,
    "content-length": fin - inicio + 1,
    "content-range": `bytes ${inicio}-${fin}/${tamano}`,
    "accept-ranges": "bytes",
  });
  createReadStream(ruta, { start: inicio, end: fin }).pipe(res);
}

async function atender(
  carpeta: string,
  ahora: () => Date,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const url = new URL(req.url ?? "/", "http://local");
  const ruta = url.pathname;
  if (req.method === "GET" && ruta === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(await readFile(PAGINA));
  } else if (req.method === "GET" && ruta === "/tokens.css") {
    res.writeHead(200, { "content-type": "text/css; charset=utf-8" });
    res.end(await readFile(TOKENS));
  } else if (req.method === "GET" && ruta === "/api/sesion") {
    json(res, 200, await datosDeSesion(carpeta));
  } else if (req.method === "GET" && ruta.startsWith("/video/")) {
    // Solo los clips que lista la sesión: el nombre nunca se usa para armar una ruta.
    const codigo = decodeURIComponent(ruta.slice("/video/".length));
    const clip = (await leerSesion(carpeta)).clips.find((c) => c.codigo === codigo);
    if (!clip) throw new ErrorDePedido(404, "Clip no encontrado");
    servirVideo(req, res, join(carpeta, "calibracion", clip.archivo));
  } else if (req.method === "POST" && ruta === "/api/previsualizar") {
    json(res, 200, previsualizar(validar(PedidoVista, await leerCuerpo(req))));
  } else if (req.method === "POST" && ruta === "/api/guardar") {
    const entrada = validar<EntradaCalibracion>(EntradaCalibracion, await leerCuerpo(req));
    json(res, 200, await guardarCalibracion(carpeta, entrada, ahora));
  } else {
    throw new ErrorDePedido(404, "No encontrado");
  }
}

export function crearServidor(carpeta: string, ahora: () => Date = () => new Date()): Server {
  return createServer((req, res) => {
    // Rechaza otros nombres de host: una página externa no puede alcanzar la sesión por DNS.
    const host = (req.headers.host ?? "").replace(/:\d+$/, "");
    if (!HOSTS_LOCALES.has(host)) {
      json(res, 403, { error: "Solo se atiende al equipo local" });
      return;
    }
    atender(carpeta, ahora, req, res).catch((error: unknown) => {
      if (error instanceof ErrorDePedido) json(res, error.estado, { error: error.message });
      else if (error instanceof ErrorCalibracion) json(res, 422, { error: error.message });
      else {
        console.error(error);
        json(res, 500, { error: "Error interno" });
      }
    });
  });
}

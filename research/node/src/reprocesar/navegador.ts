import { readFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import { chromium, type Browser, type Page } from "@playwright/test";
import { crearServidorReproceso } from "./servidor.ts";
import type { Comprobacion, PedidoProceso, Procesador, SalidaProceso } from "./reprocesar.ts";

const VERSION_MEDIAPIPE = resolve(
  import.meta.dirname,
  "../../../../apps/web/public/mediapipe/version.json",
);

interface Pagina {
  comprobar(url: string): Promise<Comprobacion>;
  procesar(datos: PedidoProceso & { url: string }): Promise<SalidaProceso>;
}

// El Chromium que trae Playwright no lee H.264: hacen falta los navegadores instalados.
async function lanzar(): Promise<Browser> {
  try {
    return await chromium.launch({ channel: "msedge" });
  } catch {
    return await chromium.launch({ channel: "chrome" });
  }
}

/** Abre el navegador sin interfaz y el servidor local del que carga la página. */
export async function abrirProcesador(): Promise<Procesador> {
  const { servidor, publicar } = crearServidorReproceso();
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  const { port } = servidor.address() as AddressInfo;
  const registro = JSON.parse(await readFile(VERSION_MEDIAPIPE, "utf8")) as {
    tasksVision: string;
    modelo: string;
  };
  const navegador = await lanzar();

  // Una página por video: si una toma agota la memoria, no arrastra a las demás.
  const enPagina = async <T>(accion: (pagina: Page) => Promise<T>): Promise<T> => {
    const pagina = await navegador.newPage();
    try {
      await pagina.goto(`http://127.0.0.1:${port}/`);
      await pagina.waitForFunction("window.listo === true");
      return await accion(pagina);
    } finally {
      await pagina.close();
    }
  };

  return {
    version_modelo: `${registro.modelo}@tasks-vision-${registro.tasksVision}`,
    comprobar: (ruta) =>
      enPagina((p) =>
        p.evaluate<Comprobacion, string>(
          (url) => (globalThis as unknown as Pagina).comprobar(url),
          publicar(ruta),
        ),
      ),
    procesar: (ruta, pedido) =>
      enPagina((p) =>
        p.evaluate<SalidaProceso, PedidoProceso & { url: string }>(
          (datos) => (globalThis as unknown as Pagina).procesar(datos),
          { ...pedido, url: publicar(ruta) },
        ),
      ),
    cerrar: async () => {
      await navegador.close();
      await new Promise((ok) => servidor.close(ok));
    },
  };
}

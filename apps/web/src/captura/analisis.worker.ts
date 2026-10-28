/// <reference lib="webworker" />
import { analizar, type PedidoAnalisis } from "./analisis.ts";

// El análisis corre fuera del hilo principal: la interfaz no se congela al terminar de tocar.
self.onmessage = (evento: MessageEvent<PedidoAnalisis>) => {
  self.postMessage(analizar(evento.data, () => performance.now()));
};

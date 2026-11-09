// AudioWorklet: copia cada bloque PCM del micrófono al hilo principal con su instante en el reloj
// del AudioContext. No procesa ni envía nada fuera del teléfono.
declare const currentTime: number;
declare function registerProcessor(nombre: string, clase: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

class CapturaPcm extends AudioWorkletProcessor {
  process(entradas: Float32Array[][]): boolean {
    const canal = entradas[0]?.[0];
    if (canal) this.port.postMessage({ t: currentTime, muestras: canal.slice() });
    return true;
  }
}

registerProcessor("captura-pcm", CapturaPcm);

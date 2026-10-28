import { useCallback, useEffect, useRef, useState } from "react";
import urlWorklet from "./captura.worklet.ts?worker&url";

export type EstadoMicrofono =
  | { tipo: "pidiendo" }
  | { tipo: "activo"; tasa: number; audioSinProcesar: boolean }
  | { tipo: "denegado" }
  | { tipo: "error"; detalle: string };

export interface Bloque {
  /** Instante del bloque en el reloj del AudioContext (s). */
  t: number;
  muestras: Float32Array;
}

// PA-HU20-02: el análisis necesita el sonido sin procesar por el navegador.
const RESTRICCIONES: MediaTrackConstraints = {
  echoCancellation: false,
  noiseSuppression: false,
  autoGainControl: false,
};

export interface Microfono {
  estado: EstadoMicrofono;
  /** Nivel actual (dBFS) para el medidor en vivo. */
  nivelDb: number;
  contexto: React.RefObject<AudioContext | null>;
  /** Empieza a acumular bloques; devuelve el instante de inicio en el reloj del AudioContext. */
  grabar(): number;
  /** Deja de acumular y devuelve los bloques grabados. */
  detener(): Bloque[];
  /** Bloques grabados hasta ahora (sin detener la grabación). */
  grabado(): readonly Bloque[];
  reintentar(): void;
}

export function useMicrofono(): Microfono {
  const [estado, setEstado] = useState<EstadoMicrofono>({ tipo: "pidiendo" });
  const [nivelDb, setNivelDb] = useState(-100);
  const contexto = useRef<AudioContext | null>(null);
  const grabando = useRef<Bloque[] | null>(null);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vivo = true;
    let flujo: MediaStream | null = null;
    let ctx: AudioContext | null = null;
    (async () => {
      try {
        flujo = await navigator.mediaDevices.getUserMedia({ audio: RESTRICCIONES, video: false });
      } catch (error) {
        const nombre = error instanceof DOMException ? error.name : "";
        if (vivo)
          setEstado(
            nombre === "NotAllowedError"
              ? { tipo: "denegado" }
              : { tipo: "error", detalle: String(error) },
          );
        return;
      }
      ctx = new AudioContext();
      contexto.current = ctx;
      // Chrome crea el contexto suspendido hasta un gesto del usuario: se reanuda al primer toque.
      const reanudar = () => void ctx?.resume();
      document.addEventListener("pointerdown", reanudar, { once: true });
      await ctx.audioWorklet.addModule(urlWorklet);
      const fuente = ctx.createMediaStreamSource(flujo);
      const nodo = new AudioWorkletNode(ctx, "captura-pcm");
      let acumulado = 0;
      let cuenta = 0;
      nodo.port.onmessage = (e: MessageEvent<Bloque>) => {
        grabando.current?.push(e.data);
        let suma = 0;
        for (const v of e.data.muestras) suma += v * v;
        acumulado += suma / e.data.muestras.length;
        if (++cuenta >= 20) {
          setNivelDb(10 * Math.log10(Math.max(acumulado / cuenta, 1e-10)));
          acumulado = 0;
          cuenta = 0;
        }
      };
      fuente.connect(nodo);
      const ajustes = flujo.getAudioTracks()[0]?.getSettings() ?? {};
      const audioSinProcesar =
        ajustes.echoCancellation === false &&
        ajustes.noiseSuppression === false &&
        ajustes.autoGainControl === false;
      if (vivo) setEstado({ tipo: "activo", tasa: ctx.sampleRate, audioSinProcesar });
    })();
    return () => {
      vivo = false;
      flujo?.getTracks().forEach((p) => p.stop());
      void ctx?.close();
      contexto.current = null;
    };
  }, [intento]);

  const grabar = useCallback(() => {
    void contexto.current?.resume();
    grabando.current = [];
    return contexto.current?.currentTime ?? 0;
  }, []);
  const detener = useCallback(() => {
    const bloques = grabando.current ?? [];
    grabando.current = null;
    return bloques;
  }, []);
  const grabado = useCallback(() => grabando.current ?? [], []);
  const reintentar = useCallback(() => {
    setEstado({ tipo: "pidiendo" });
    setIntento((i) => i + 1);
  }, []);

  return { estado, nivelDb, contexto, grabar, detener, grabado, reintentar };
}

/** Une los bloques en una sola señal; devuelve también el instante del primer bloque. */
export function unir(bloques: readonly Bloque[]): { muestras: Float32Array; t0: number } {
  const total = bloques.reduce((s, b) => s + b.muestras.length, 0);
  const muestras = new Float32Array(total);
  let i = 0;
  for (const b of bloques) {
    muestras.set(b.muestras, i);
    i += b.muestras.length;
  }
  return { muestras, t0: bloques[0]?.t ?? 0 };
}

/** Clic corto (1 kHz, 30 ms) en el instante `t` del reloj del AudioContext. */
export function programarClic(ctx: AudioContext, t: number, fuerte = false): void {
  const osc = ctx.createOscillator();
  const ganancia = ctx.createGain();
  osc.frequency.value = fuerte ? 1500 : 1000;
  ganancia.gain.setValueAtTime(0.5, t);
  ganancia.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
  osc.connect(ganancia).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.04);
}

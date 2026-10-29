import { useEffect, useRef, useState } from "react";

/**
 * Avance sin tocar la pantalla: con las manos en el teclado no se puede pulsar un botón, así que
 * el paso continúa solo tras ESPERA_AVANCE segundos seguidos con el semáforo en verde.
 */
export const ESPERA_AVANCE = 3;

export interface CuentaAtras {
  /** Instante (s) en que empezó el verde actual; null si no está en verde. */
  desde: number | null;
  /** Segundos enteros que faltan (3, 2, 1, 0); null si no está en verde. */
  restante: number | null;
  avanzar: boolean;
}

export function cuentaAtras(c: CuentaAtras, listo: boolean, t: number): CuentaAtras {
  if (!listo) return { desde: null, restante: null, avanzar: false };
  const desde = c.desde ?? t;
  const faltan = ESPERA_AVANCE - (t - desde);
  return { desde, restante: Math.max(0, Math.ceil(faltan)), avanzar: faltan <= 0 };
}

/** Llama a `avanzar` una vez tras ESPERA_AVANCE s seguidos con `listo`; devuelve lo que falta. */
export function useAvanceAutomatico(listo: boolean, avanzar: () => void): number | null {
  const [restante, setRestante] = useState<number | null>(null);
  const alAvanzar = useRef(avanzar);
  alAvanzar.current = avanzar;

  useEffect(() => {
    if (!listo) {
      setRestante(null);
      return;
    }
    let c: CuentaAtras = { desde: null, restante: null, avanzar: false };
    const paso = () => {
      c = cuentaAtras(c, true, performance.now() / 1000);
      setRestante(c.restante);
      if (c.avanzar) {
        window.clearInterval(id);
        alAvanzar.current();
      }
    };
    const id = window.setInterval(paso, 100);
    paso();
    return () => window.clearInterval(id);
  }, [listo]);

  return listo ? restante : null;
}

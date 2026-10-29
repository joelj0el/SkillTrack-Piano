import { useCallback, useEffect, useState } from "react";

export type Camara =
  | { tipo: "pidiendo" }
  | { tipo: "activa"; flujo: MediaStream }
  | { tipo: "error"; motivo: "permiso" | "sin-camara" | "otro"; detalle: string };

async function pedirCamara(): Promise<Camara> {
  try {
    const flujo = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    return { tipo: "activa", flujo };
  } catch (error) {
    const nombre = error instanceof DOMException ? error.name : "";
    if (nombre === "NotAllowedError" || nombre === "SecurityError") {
      return { tipo: "error", motivo: "permiso", detalle: nombre };
    }
    if (nombre === "NotFoundError" || nombre === "OverconstrainedError") {
      return { tipo: "error", motivo: "sin-camara", detalle: nombre };
    }
    return { tipo: "error", motivo: "otro", detalle: String(error) };
  }
}

/** Cámara trasera; se apaga al desmontar. */
export function useCamara() {
  const [camara, setCamara] = useState<Camara>({ tipo: "pidiendo" });
  const iniciar = useCallback(() => {
    setCamara({ tipo: "pidiendo" });
    void pedirCamara().then(setCamara);
  }, []);
  useEffect(() => {
    iniciar();
  }, [iniciar]);
  useEffect(() => {
    if (camara.tipo !== "activa") return;
    return () => camara.flujo.getTracks().forEach((pista) => pista.stop());
  }, [camara]);
  return { camara, reintentar: iniciar };
}

/** Lee un token de color del sistema de diseño para dibujar en el lienzo. */
export function colorDeToken(nombre: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nombre).trim();
}

/**
 * Toque en pantalla → píxel del video cuando el video se muestra con `object-fit: contain`
 * (escalado sin recortar, con franjas). Devuelve null si el toque cae en una franja.
 */
export function toqueAVideo(
  x: number,
  y: number,
  caja: { ancho: number; alto: number },
  video: { ancho: number; alto: number },
): { x: number; y: number } | null {
  const escala = Math.min(caja.ancho / video.ancho, caja.alto / video.alto);
  const izquierda = (caja.ancho - video.ancho * escala) / 2;
  const arriba = (caja.alto - video.alto * escala) / 2;
  const vx = (x - izquierda) / escala;
  const vy = (y - arriba) / escala;
  if (vx < 0 || vy < 0 || vx > video.ancho || vy > video.alto) return null;
  return { x: vx, y: vy };
}

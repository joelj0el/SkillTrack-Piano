import {
  aGrises,
  evaluarCalidad,
  luminanciaMedia,
  movimiento,
  nitidez,
  type Semaforo,
} from "@skilltrack/core";
import { useCallback, useEffect, useRef, useState } from "react";

// Fotograma reducido para medir calidad: barato y suficiente para luz, nitidez y movimiento.
const ANCHO = 160;
const ALTO = 90;
const PERIODO_MS = 300;

type Camara =
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

/** PA-HU03-03: nunca una pantalla en blanco si no hay cámara. */
function ErrorCamara({
  camara,
  reintentar,
}: {
  camara: Extract<Camara, { tipo: "error" }>;
  reintentar: () => void;
}) {
  return (
    <section aria-labelledby="titulo-error-camara">
      <h1 id="titulo-error-camara">
        {camara.motivo === "permiso"
          ? "No tenemos permiso para usar la cámara"
          : "No encontramos una cámara"}
      </h1>
      {camara.motivo === "permiso" ? (
        <ol>
          <li>Toca el candado o el ícono de ajustes junto a la dirección de la página.</li>
          <li>En "Permisos", cambia "Cámara" a "Permitir".</li>
          <li>Vuelve aquí y toca "Reintentar".</li>
        </ol>
      ) : (
        <p>Revisa que el teléfono tenga cámara y que ninguna otra aplicación la esté usando.</p>
      )}
      <button type="button" onClick={reintentar}>
        Reintentar
      </button>
    </section>
  );
}

export function Encuadre({ manosEsperadas }: { manosEsperadas: 1 | 2 }) {
  const [camara, setCamara] = useState<Camara>({ tipo: "pidiendo" });
  const [semaforo, setSemaforo] = useState<Semaforo | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);

  const iniciar = useCallback(() => {
    setCamara({ tipo: "pidiendo" });
    void pedirCamara().then(setCamara);
  }, []);

  useEffect(() => {
    iniciar();
  }, [iniciar]);

  useEffect(() => {
    if (camara.tipo !== "activa" || !video.current || !lienzo.current) return;
    const elemento = video.current;
    elemento.srcObject = camara.flujo;
    void elemento.play().catch(() => undefined);
    const contexto = lienzo.current.getContext("2d", { willReadFrequently: true });
    let anterior: Float64Array | null = null;
    const medir = setInterval(() => {
      if (!contexto || elemento.readyState < 2) return;
      contexto.drawImage(elemento, 0, 0, ANCHO, ALTO);
      const { data } = contexto.getImageData(0, 0, ANCHO, ALTO);
      const gris = aGrises(data);
      setSemaforo(
        evaluarCalidad({
          luminancia: luminanciaMedia(data),
          nitidez: nitidez(gris, ANCHO, ALTO),
          movimiento: anterior ? movimiento(anterior, gris) : 0,
          // Sin detector de la mano en esta versión: nunca se afirma que las manos se ven.
          manosDetectadas: 0,
          manosEsperadas,
          rangoVisible: true,
        }),
      );
      anterior = gris;
    }, PERIODO_MS);
    return () => {
      clearInterval(medir);
      camara.flujo.getTracks().forEach((pista) => pista.stop());
    };
  }, [camara, manosEsperadas]);

  if (camara.tipo === "error") return <ErrorCamara camara={camara} reintentar={iniciar} />;

  return (
    <section aria-labelledby="titulo-encuadre">
      <h1 id="titulo-encuadre">Coloca el teléfono</h1>
      <p className="suave">
        Detrás y por encima de ti, con el teclado horizontal y tus manos a la vista. La imagen no
        sale del teléfono.
      </p>
      <video
        ref={video}
        className="vista-camara"
        muted
        playsInline
        aria-label="Vista de la cámara"
      />
      <canvas ref={lienzo} width={ANCHO} height={ALTO} hidden />
      <div
        className="tarjeta"
        role="status"
        aria-live="polite"
        data-semaforo={semaforo?.nivel ?? "pidiendo"}
      >
        <strong>
          {camara.tipo === "pidiendo"
            ? "Pidiendo acceso a la cámara…"
            : semaforo
              ? { verde: "Listo", ambar: "Casi listo", rojo: "Corrige el encuadre" }[semaforo.nivel]
              : "Midiendo…"}
        </strong>
        <ul className="lista">
          {semaforo?.motivos.map((m) => (
            <li key={m.codigo} data-motivo={m.codigo}>
              <span aria-hidden="true">{m.gravedad === "rojo" ? "⛔ " : "⚠ "}</span>
              {m.texto}
            </li>
          ))}
        </ul>
      </div>
      <p className="aviso">
        Versión de avance: la detección de las manos todavía no está integrada, así que el semáforo
        no llega a verde y no se puede iniciar la ejecución.
      </p>
      <button type="button" disabled>
        Continuar
      </button>
    </section>
  );
}

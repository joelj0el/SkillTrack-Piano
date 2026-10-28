import {
  aGrises,
  evaluarCalidad,
  luminanciaMedia,
  movimiento,
  nitidez,
  type Asignacion,
  type Semaforo,
} from "@skilltrack/core";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { colorDeToken, useCamara, type Camara } from "./camara.ts";
import { CONEXIONES, crearDetector, type DeteccionManos, type Detector } from "./detector.ts";
import { NOMBRE_MANO, crearAsignador, crearContadorFps, type ManoVista } from "./manos-en-vivo.ts";

const ANCHO_CALIDAD = 160;
const ALTO_CALIDAD = 90;
const PERIODO_CALIDAD_MS = 300;

/** Lo que cada paso puede leer del fotograma más reciente. */
export interface Fotograma {
  deteccion: DeteccionManos;
  asignacion: Asignacion<ManoVista>;
  ancho: number;
  alto: number;
}

/** Dibujos extra de un paso (teclas calibradas, tecla bajo cada dedo…). */
export type Dibujar = (ctx: CanvasRenderingContext2D, f: Fotograma) => void;

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

function dibujarManos(ctx: CanvasRenderingContext2D, f: Fotograma) {
  const color = {
    MI: colorDeToken("--color-mano-izquierda"),
    MD: colorDeToken("--color-mano-derecha"),
  };
  for (const id of ["MI", "MD"] as const) {
    const mano = f.asignacion[id]?.datos;
    if (!mano) continue;
    ctx.strokeStyle = color[id];
    ctx.fillStyle = color[id];
    ctx.lineWidth = 2;
    for (const [a, b] of CONEXIONES) {
      ctx.beginPath();
      ctx.moveTo(mano[a]!.x * f.ancho, mano[a]!.y * f.alto);
      ctx.lineTo(mano[b]!.x * f.ancho, mano[b]!.y * f.alto);
      ctx.stroke();
    }
    for (const p of mano) {
      ctx.beginPath();
      ctx.arc(p.x * f.ancho, p.y * f.alto, 4, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.font = "600 16px system-ui";
    ctx.fillText(NOMBRE_MANO[id], mano[0]!.x * f.ancho + 8, mano[0]!.y * f.alto + 20);
  }
}

export interface Vista {
  fotograma: React.RefObject<Fotograma | null>;
  semaforo: Semaforo | null;
  video: React.RefObject<HTMLVideoElement | null>;
  detector: Detector | null;
}

/**
 * Cámara + detector + capa de dibujo, compartidos por todos los pasos de la práctica.
 * La imagen solo se procesa en el teléfono: ningún fotograma sale por la red.
 */
export function VistaCamara({
  manosEsperadas,
  dibujar,
  onToque,
  children,
}: {
  manosEsperadas: 1 | 2;
  dibujar?: Dibujar;
  /** Toque sobre la imagen, en píxeles del video (para calibrar). */
  onToque?: ((p: { x: number; y: number }) => void) | undefined;
  children: (vista: Vista) => ReactNode;
}) {
  const { camara, reintentar } = useCamara();
  const video = useRef<HTMLVideoElement>(null);
  const capa = useRef<HTMLCanvasElement>(null);
  const muestra = useRef<HTMLCanvasElement>(null);
  const fotograma = useRef<Fotograma | null>(null);
  const dibujarRef = useRef<Dibujar | undefined>(dibujar);
  dibujarRef.current = dibujar;
  const [frontal, setFrontal] = useState(false);
  const frontalRef = useRef(frontal);
  frontalRef.current = frontal;
  const [detector, setDetector] = useState<Detector | null>(null);
  const [errorDetector, setErrorDetector] = useState<string | null>(null);
  const [fps, setFps] = useState(0);
  const [semaforo, setSemaforo] = useState<Semaforo | null>(null);

  useEffect(() => {
    if (camara.tipo !== "activa" || !video.current) return;
    video.current.srcObject = camara.flujo;
    void video.current.play().catch(() => undefined);
    let vivo = true;
    let creado: Detector | null = null;
    crearDetector().then(
      (d) => {
        if (vivo) setDetector((creado = d));
        else d.cerrar();
      },
      (e) => vivo && setErrorDetector(String(e)),
    );
    return () => {
      vivo = false;
      creado?.cerrar();
    };
  }, [camara]);

  // Bucle de detección y dibujo.
  useEffect(() => {
    if (!detector || !video.current || !capa.current) return;
    const v = video.current;
    const lienzo = capa.current;
    const ctx = lienzo.getContext("2d");
    const asignar = crearAsignador(() => frontalRef.current);
    const contarFps = crearContadorFps();
    let ultimoFps = 0;
    let ultimoT = -1;
    let cuadro = 0;
    const paso = (ahora: number) => {
      cuadro = requestAnimationFrame(paso);
      if (!ctx || v.readyState < 2 || v.videoWidth === 0) return;
      const t = Math.max(ahora, ultimoT + 1);
      ultimoT = t;
      const deteccion = detector.detectar(v, t);
      const f: Fotograma = {
        deteccion,
        asignacion: asignar(deteccion.manos),
        ancho: v.videoWidth,
        alto: v.videoHeight,
      };
      fotograma.current = f;
      if (lienzo.width !== f.ancho) lienzo.width = f.ancho;
      if (lienzo.height !== f.alto) lienzo.height = f.alto;
      ctx.clearRect(0, 0, f.ancho, f.alto);
      dibujarRef.current?.(ctx, f);
      dibujarManos(ctx, f);
      const valor = contarFps(t);
      if (t - ultimoFps > 500) {
        ultimoFps = t;
        setFps(valor);
      }
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [detector]);

  // Calidad de imagen sobre fotogramas reducidos.
  useEffect(() => {
    if (camara.tipo !== "activa" || !video.current || !muestra.current) return;
    const v = video.current;
    const ctx = muestra.current.getContext("2d", { willReadFrequently: true });
    let anterior: Float64Array | null = null;
    const medir = setInterval(() => {
      if (!ctx || v.readyState < 2) return;
      ctx.drawImage(v, 0, 0, ANCHO_CALIDAD, ALTO_CALIDAD);
      const { data } = ctx.getImageData(0, 0, ANCHO_CALIDAD, ALTO_CALIDAD);
      const gris = aGrises(data);
      setSemaforo(
        evaluarCalidad({
          luminancia: luminanciaMedia(data),
          nitidez: nitidez(gris, ANCHO_CALIDAD, ALTO_CALIDAD),
          movimiento: anterior ? movimiento(anterior, gris) : 0,
          manosDetectadas: fotograma.current?.deteccion.manos.length ?? 0,
          manosEsperadas,
          // El rango completo se comprueba al calibrar (P-35), con la homografía.
          rangoVisible: true,
        }),
      );
      anterior = gris;
    }, PERIODO_CALIDAD_MS);
    return () => clearInterval(medir);
  }, [camara, manosEsperadas]);

  if (camara.tipo === "error") return <ErrorCamara camara={camara} reintentar={reintentar} />;

  return (
    <section aria-label="Práctica">
      <div
        className={onToque ? "capa-video tocable" : "capa-video"}
        onClick={(e) => {
          const v = video.current;
          if (!onToque || !v || v.videoWidth === 0) return;
          const caja = e.currentTarget.getBoundingClientRect();
          onToque({
            x: ((e.clientX - caja.left) / caja.width) * v.videoWidth,
            y: ((e.clientY - caja.top) / caja.height) * v.videoHeight,
          });
        }}
      >
        <video
          ref={video}
          className="vista-camara"
          muted
          playsInline
          aria-label="Vista de la cámara"
        />
        <canvas ref={capa} className="capa-dibujo" aria-hidden="true" />
      </div>
      <canvas ref={muestra} width={ANCHO_CALIDAD} height={ALTO_CALIDAD} hidden />
      <div className="fila suave">
        <span data-estado-detector={detector ? "listo" : errorDetector ? "error" : "cargando"}>
          {detector
            ? `Detector de manos listo (${detector.delegado})`
            : errorDetector
              ? `El detector no pudo iniciar: ${errorDetector}`
              : camara.tipo === "pidiendo"
                ? "Pidiendo acceso a la cámara…"
                : "Cargando el detector de manos…"}
        </span>
        <span data-fps={Math.round(fps)}>{Math.round(fps)} fps</span>
        <label className="fila">
          <input type="checkbox" checked={frontal} onChange={(e) => setFrontal(e.target.checked)} />
          Cámara frontal (imagen en espejo)
        </label>
      </div>
      {children({ fotograma, semaforo, video, detector })}
    </section>
  );
}

export function PanelSemaforo({ semaforo }: { semaforo: Semaforo | null }) {
  const titulo = semaforo
    ? { verde: "Listo", ambar: "Casi listo", rojo: "Corrige el encuadre" }[semaforo.nivel]
    : "Midiendo…";
  return (
    <div
      className={`tarjeta semaforo semaforo-${semaforo?.nivel ?? "pidiendo"}`}
      role="status"
      aria-live="polite"
      data-semaforo={semaforo?.nivel ?? "pidiendo"}
    >
      <strong>{titulo}</strong>
      <ul className="lista">
        {semaforo?.motivos.map((m) => (
          <li key={m.codigo} data-motivo={m.codigo}>
            <span aria-hidden="true">{m.gravedad === "rojo" ? "⛔ " : "⚠ "}</span>
            {m.texto}
          </li>
        ))}
      </ul>
    </div>
  );
}

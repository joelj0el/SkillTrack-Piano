import {
  aGrises,
  crearAsignador,
  evaluarCalidad,
  luminanciaMedia,
  movimiento,
  nitidez,
  type Asignacion,
  type Semaforo,
} from "@skilltrack/core";
import { ArrowLeft, Camera, Check, OctagonX, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { colorDeToken, toqueAVideo, useCamara, type Camara } from "./camara.ts";
import { CONEXIONES, crearDetector, type DeteccionManos, type Detector } from "./detector.ts";
import { NOMBRE_MANO, crearContadorFps, type ManoVista } from "./manos-en-vivo.ts";

import { Boton, EstadoVista } from "../ui/base.tsx";

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
    <EstadoVista
      tipo="error"
      nivel={1}
      titulo={
        camara.motivo === "permiso"
          ? "No tenemos permiso para usar la cámara"
          : "No encontramos una cámara"
      }
      accion={<Boton onClick={reintentar}>Reintentar</Boton>}
    >
      {camara.motivo === "permiso" ? (
        <ol>
          <li>Toca el candado o el ícono de ajustes junto a la dirección de la página.</li>
          <li>En "Permisos", cambia "Cámara" a "Permitir".</li>
          <li>Vuelve aquí y toca "Reintentar".</li>
        </ol>
      ) : (
        <p>Revisa que el teléfono tenga cámara y que ninguna otra aplicación la esté usando.</p>
      )}
    </EstadoVista>
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
  titulo,
  aviso,
  volverA,
  manosEsperadas,
  dibujar,
  onToque,
  children,
}: {
  titulo: string;
  /** Texto plegable bajo el título (p. ej., la secuencia provisional). */
  aviso?: ReactNode;
  /** Ruta del botón para salir de la práctica. */
  volverA: string;
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
    const asignar = crearAsignador<ManoVista>(() => frontalRef.current);
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
    <MarcoPractica
      titulo={titulo}
      volverA={volverA}
      aviso={aviso}
      estado={
        <span data-estado-detector={detector ? "listo" : errorDetector ? "error" : "cargando"}>
          {detector
            ? `Manos: ${detector.delegado}`
            : errorDetector
              ? `El detector no pudo iniciar: ${errorDetector}`
              : camara.tipo === "pidiendo"
                ? "Pidiendo la cámara…"
                : "Cargando el detector…"}
        </span>
      }
      opciones={
        <>
          <span data-fps={Math.round(fps)}>{Math.round(fps)} fps</span>
          <label className="practica-opcion">
            <input
              type="checkbox"
              checked={frontal}
              onChange={(e) => setFrontal(e.target.checked)}
            />
            Cámara frontal
          </label>
        </>
      }
      tocable={Boolean(onToque)}
      alTocar={(e) => {
        const v = video.current;
        if (!onToque || !v || v.videoWidth === 0) return;
        const caja = e.currentTarget.getBoundingClientRect();
        const p = toqueAVideo(
          e.clientX - caja.left,
          e.clientY - caja.top,
          { ancho: caja.width, alto: caja.height },
          { ancho: v.videoWidth, alto: v.videoHeight },
        );
        if (p) onToque(p);
      }}
      escena={
        <>
          <video
            ref={video}
            className="vista-camara"
            muted
            playsInline
            aria-label="Vista de la cámara"
          />
          <canvas ref={capa} className="capa-dibujo" aria-hidden="true" />
        </>
      }
      pie={<canvas ref={muestra} width={ANCHO_CALIDAD} height={ALTO_CALIDAD} hidden />}
    >
      {children({ fotograma, semaforo, video, detector })}
    </MarcoPractica>
  );
}

/** Pantalla completa sin desplazamiento: cabecera compacta, escena y panel del paso. */
export function MarcoPractica({
  titulo,
  volverA,
  aviso,
  estado,
  opciones,
  tocable = false,
  alTocar,
  escena,
  pie,
  children,
}: {
  titulo: string;
  volverA: string;
  aviso?: ReactNode;
  estado?: ReactNode;
  opciones?: ReactNode;
  tocable?: boolean;
  alTocar?: React.MouseEventHandler<HTMLDivElement>;
  escena: ReactNode;
  pie?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="practica" aria-label="Práctica">
      <header className="practica-cabecera">
        <Link to={volverA} className="practica-salir">
          <ArrowLeft aria-hidden="true" />
          Salir
        </Link>
        <strong className="practica-titulo">{titulo}</strong>
        {estado}
        {opciones}
        {aviso && (
          <details className="practica-aviso">
            <summary>Secuencia provisional</summary>
            {aviso}
          </details>
        )}
      </header>
      <div className="practica-cuerpo">
        <div className={tocable ? "capa-video tocable" : "capa-video"} onClick={alTocar}>
          {escena}
        </div>
        <div className="practica-panel">{children}</div>
      </div>
      {pie}
    </section>
  );
}

const ICONO_SEMAFORO = { verde: Check, ambar: TriangleAlert, rojo: OctagonX, pidiendo: Camera };

/** Tarjeta de semáforo: pulso suave en ámbar y check en verde, siempre con icono y texto. */
export function TarjetaSemaforo({
  nivel,
  titulo,
  children,
  ...resto
}: {
  nivel: keyof typeof ICONO_SEMAFORO;
  titulo: string;
  children?: ReactNode;
  role?: string;
  "aria-live"?: "polite";
  "data-semaforo"?: string;
  "data-semaforo-audio"?: string;
}) {
  const Icono = ICONO_SEMAFORO[nivel];
  return (
    <div className={`tarjeta semaforo semaforo-${nivel}`} {...resto}>
      <span className="semaforo-icono">
        <Icono key={nivel} aria-hidden="true" />
      </span>
      <strong className="semaforo-texto">{titulo}</strong>
      {children}
    </div>
  );
}

export function PanelSemaforo({ semaforo }: { semaforo: Semaforo | null }) {
  const titulo = semaforo
    ? { verde: "Listo", ambar: "Casi listo", rojo: "Corrige el encuadre" }[semaforo.nivel]
    : "Midiendo…";
  return (
    <TarjetaSemaforo
      nivel={semaforo?.nivel ?? "pidiendo"}
      titulo={titulo}
      role="status"
      aria-live="polite"
      data-semaforo={semaforo?.nivel ?? "pidiendo"}
    >
      <ul className="lista">
        {semaforo?.motivos.map((m) => (
          <li key={m.codigo} data-motivo={m.codigo}>
            {m.gravedad === "rojo" ? (
              <OctagonX aria-hidden="true" />
            ) : (
              <TriangleAlert aria-hidden="true" />
            )}
            {m.texto}
          </li>
        ))}
      </ul>
    </TarjetaSemaforo>
  );
}

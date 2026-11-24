import type { LucideIcon } from "lucide-react";
import { useId, type ReactNode } from "react";

/**
 * Teclado en perspectiva para portadas y para el panel de la entrada. Ilustración propia en SVG
 * (no es una foto): los colores salen de los tokens por clase, así que cambia con el tema.
 */
export function TecladoPerspectiva({ className }: { className?: string }) {
  const id = useId();
  const fuga = { x: 640, y: -260 };
  const frente = 300;
  const fondo = 0.3;
  const blancas = 15;
  const ancho = 46;
  const x0 = 20;
  const atras = (x: number, y: number, t: number) => [x + (fuga.x - x) * t, y + (fuga.y - y) * t];
  const punto = (x: number, t: number) =>
    atras(x, frente, t)
      .map((v) => v.toFixed(1))
      .join(",");
  const tecla = (xa: number, xb: number, t0: number, t1: number) =>
    [punto(xa, t0), punto(xb, t0), punto(xb, t1), punto(xa, t1)].join(" ");
  const negras = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12].filter((i) => i < blancas - 1);
  return (
    <svg
      className={["teclado-perspectiva", className].filter(Boolean).join(" ")}
      viewBox="0 0 720 320"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" className="ilu-stop-blanca" />
          <stop offset="1" className="ilu-stop-blanca-sombra" />
        </linearGradient>
        <linearGradient id={`${id}-n`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" className="ilu-stop-negra-luz" />
          <stop offset="1" className="ilu-stop-negra" />
        </linearGradient>
        <linearGradient id={`${id}-brillo`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" className="ilu-stop-brillo" stopOpacity="0" />
          <stop offset="0.6" className="ilu-stop-brillo" stopOpacity="0.55" />
          <stop offset="1" className="ilu-stop-brillo" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon
        className="ilu-cuerpo"
        points={tecla(x0 - 10, x0 + blancas * ancho + 10, -0.02, fondo + 0.06)}
      />
      {Array.from({ length: blancas }, (_, i) => (
        <polygon
          key={`b${i}`}
          fill={`url(#${id}-b)`}
          className="ilu-tecla-blanca"
          points={tecla(x0 + i * ancho + 1.5, x0 + (i + 1) * ancho - 1.5, 0, fondo)}
        />
      ))}
      {negras.map((i) => (
        <polygon
          key={`n${i}`}
          fill={`url(#${id}-n)`}
          points={tecla(
            x0 + (i + 1) * ancho - ancho * 0.3,
            x0 + (i + 1) * ancho + ancho * 0.3,
            fondo * 0.36,
            fondo,
          )}
        />
      ))}
      <polygon
        fill={`url(#${id}-brillo)`}
        points={tecla(x0, x0 + blancas * ancho, 0.02, fondo * 0.3)}
      />
    </svg>
  );
}

/** Portada (hero): saludo grande, frase, acción principal e ilustración del teclado. */
export function Portada({
  antetitulo,
  titulo,
  frase,
  accion,
  nivel = 1,
}: {
  antetitulo?: string;
  titulo: string;
  frase: ReactNode;
  accion?: ReactNode;
  nivel?: 1 | 2;
}) {
  const Titulo = nivel === 1 ? "h1" : "h2";
  return (
    <section className="portada" aria-label={titulo}>
      <div className="portada-texto">
        {antetitulo && <p className="portada-antetitulo">{antetitulo}</p>}
        <Titulo className="portada-titulo">{titulo}</Titulo>
        <span className="portada-raya" aria-hidden="true" />
        <div className="portada-frase">{frase}</div>
        {accion && <div className="portada-accion">{accion}</div>}
      </div>
      <TecladoPerspectiva className="portada-teclado" />
    </section>
  );
}

/** Tarjeta de resumen: ícono, etiqueta, cifra y una línea de cambio o detalle. */
export function TarjetaResumen({
  icono: Icono,
  etiqueta,
  valor,
  detalle,
  grafico,
  ...resto
}: {
  icono: LucideIcon;
  etiqueta: string;
  valor: ReactNode;
  detalle?: ReactNode;
  /** Minigráfico de tendencia (opcional). */
  grafico?: ReactNode;
} & Record<`data-${string}`, string | number | undefined>) {
  return (
    <div className="tarjeta-resumen vidrio" {...resto}>
      <span className="insignia" aria-hidden="true">
        <Icono />
      </span>
      <span className="tarjeta-resumen-etiqueta">{etiqueta}</span>
      <span className="tarjeta-resumen-valor">{valor}</span>
      {detalle && <span className="tarjeta-resumen-detalle">{detalle}</span>}
      {grafico}
    </div>
  );
}

/** Encabezado de sección con enlace opcional a la derecha ("Ver todas"). */
export function SeccionCabecera({ titulo, enlace }: { titulo: string; enlace?: ReactNode }) {
  return (
    <div className="seccion-cabecera">
      <h2>{titulo}</h2>
      {enlace}
    </div>
  );
}

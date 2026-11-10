import { Check, type LucideIcon } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Link, type LinkProps } from "react-router";
import {
  IlustracionError,
  IlustracionNoEvaluable,
  IlustracionSinConexion,
  IlustracionVacio,
} from "./ilustraciones.tsx";

type Variante = "primario" | "secundario" | "peligro";

const claseDe = (variante: Variante, extra?: string) =>
  [variante === "primario" ? "" : variante, extra].filter(Boolean).join(" ") || undefined;

export function Boton({
  variante = "primario",
  cargando = false,
  icono: Icono,
  className,
  disabled,
  children,
  type = "button",
  ...resto
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: Variante;
  cargando?: boolean;
  icono?: LucideIcon;
}) {
  return (
    <button
      {...resto}
      type={type}
      className={claseDe(variante, className)}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
    >
      {Icono && !cargando && <Icono aria-hidden="true" />}
      {children}
    </button>
  );
}

export function EnlaceBoton({
  variante = "primario",
  icono: Icono,
  children,
  ...resto
}: LinkProps & {
  variante?: Exclude<Variante, "peligro">;
  icono?: LucideIcon;
}) {
  return (
    <Link {...resto} className={["boton-enlace", claseDe(variante)].filter(Boolean).join(" ")}>
      {Icono && <Icono aria-hidden="true" />}
      {children}
    </Link>
  );
}

export type Tono = "correcto" | "nota" | "tiempo" | "mano" | "no-evaluable" | "neutro";

/** Estado con icono y texto: el color nunca lo comunica solo. */
export function Chip({
  tono = "neutro",
  icono: Icono,
  children,
  ...resto
}: {
  tono?: Tono;
  icono: LucideIcon;
  children: ReactNode;
  "data-estado"?: string;
}) {
  return (
    <span className="chip" data-tono={tono} {...resto}>
      <Icono aria-hidden="true" />
      {children}
    </span>
  );
}

export function PaginaCabecera({
  titulo,
  detalle,
  accion,
}: {
  titulo: ReactNode;
  detalle?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <header className="pagina-cabecera">
      <div>
        <h1>{titulo}</h1>
        {detalle && <p className="suave">{detalle}</p>}
      </div>
      {accion}
    </header>
  );
}

export function Esqueleto({ tarjetas = 3 }: { tarjetas?: number }) {
  return (
    <div className="esqueleto" role="status">
      <span className="visualmente-oculto">Cargando…</span>
      {Array.from({ length: tarjetas }, (_, i) => (
        <div key={i} className="tarjeta esqueleto-tarjeta" aria-hidden="true">
          <div className="esqueleto-linea" />
          <div className="esqueleto-linea" />
          <div className="esqueleto-linea" />
        </div>
      ))}
    </div>
  );
}

const ILUSTRACIONES = {
  vacio: IlustracionVacio,
  error: IlustracionError,
  "sin-conexion": IlustracionSinConexion,
  "no-evaluable": IlustracionNoEvaluable,
};

/** Estados de pantalla: vacío, error, sin conexión y no evaluable. */
export function EstadoVista({
  tipo,
  titulo,
  nivel = 2,
  children,
  accion,
  ...resto
}: {
  tipo: keyof typeof ILUSTRACIONES;
  titulo: string;
  nivel?: 1 | 2;
  children?: ReactNode;
  accion?: ReactNode;
  "data-vacio"?: string;
}) {
  const Ilustracion = ILUSTRACIONES[tipo];
  const Titulo = nivel === 1 ? "h1" : "h2";
  return (
    <section className="estado-vista" {...resto}>
      <Ilustracion />
      <Titulo>{titulo}</Titulo>
      {children}
      {accion}
    </section>
  );
}

export function Dialogo({
  abierto,
  titulo,
  alCerrar,
  children,
  acciones,
}: {
  abierto: boolean;
  titulo: string;
  alCerrar: () => void;
  children: ReactNode;
  acciones: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialogo = ref.current;
    if (abierto && !dialogo?.open) dialogo?.showModal();
    if (!abierto && dialogo?.open) dialogo.close();
  }, [abierto]);
  return (
    <dialog ref={ref} className="dialogo" aria-label={titulo} onClose={alCerrar}>
      <h2>{titulo}</h2>
      {children}
      <div className="dialogo-acciones">{acciones}</div>
    </dialog>
  );
}

const DURACION_AVISO_MS = 3500;
const ContextoAvisos = createContext<(texto: string) => void>(() => undefined);

export const useAviso = () => useContext(ContextoAvisos);

export function ProveedorAvisos({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<{ id: number; texto: string }[]>([]);
  const siguiente = useRef(0);
  const avisar = useCallback((texto: string) => {
    const id = siguiente.current++;
    setAvisos((a) => [...a, { id, texto }]);
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), DURACION_AVISO_MS);
  }, []);
  return (
    <ContextoAvisos.Provider value={avisar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {avisos.map((a) => (
          <div key={a.id} className="aviso-flotante">
            <Check aria-hidden="true" />
            {a.texto}
          </div>
        ))}
      </div>
    </ContextoAvisos.Provider>
  );
}

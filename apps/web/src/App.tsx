import type { Rol } from "@skilltrack/contracts";
import {
  BookOpen,
  ChartLine,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  House,
  LogOut,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  TableProperties,
  UserRound,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { Suspense, lazy, useLayoutEffect, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { NavLink, Navigate, Route, Routes, useLocation, type Location } from "react-router";
import { SinConexion } from "./componentes.tsx";
import { Usuarios } from "./paginas/admin.tsx";
import { DetalleEjercicio, Catalogo } from "./paginas/catalogo.tsx";
import { DetalleEstudiante, MisEstudiantes } from "./paginas/docente.tsx";
import { CambiarClave, Entrar, Perfil } from "./paginas/entrada.tsx";
import { PanelDocente, PanelEstudiante } from "./paginas/panel.tsx";
import { BotonPlanes, PaginaPlanes } from "./paginas/planes.tsx";
import { InicioPublico } from "./paginas/publica.tsx";
import { DetalleTarea, MisTareas } from "./paginas/estudiante.tsx";
import { ModoInvestigacion } from "./paginas/investigacion.tsx";
import { PaginaMiGrupo, PaginaMiProgreso } from "./paginas/tableros.tsx";
import { NOMBRE_ROL, roles, rutaInicial, useSesion } from "./sesion.tsx";
import { aplicarTema, temaGuardado, type Tema } from "./tema.ts";
import { Boton, Esqueleto, ProveedorAvisos } from "./ui/base.tsx";
import { LogoTeclas } from "./ui/ilustraciones.tsx";

const Diseno = lazy(() => import("./paginas/diseno.tsx").then((m) => ({ default: m.Diseno })));
const VistaEjemplo = lazy(() =>
  import("./paginas/diseno.tsx").then((m) => ({ default: m.VistaEjemplo })),
);
const PaginaMicrofono = lazy(() =>
  import("./captura/PaginaPractica.tsx").then((m) => ({ default: m.PaginaMicrofono })),
);
// El detector de la mano (MediaPipe) solo se descarga al abrir la práctica.
const PaginaPractica = lazy(() =>
  import("./captura/PaginaPractica.tsx").then((m) => ({ default: m.PaginaPractica })),
);

function Protegida({ rol, children }: { rol?: Rol; children: ReactNode }) {
  const { estado } = useSesion();
  const ubicacion = useLocation();
  if (estado.tipo === "cargando") return <Esqueleto />;
  if (estado.tipo === "sin-conexion") return <SinConexion />;
  if (estado.tipo === "anonimo") return <Navigate to="/entrar" state={{ desde: ubicacion }} />;
  // Con clave temporal no se accede a ninguna otra pantalla (PA-HU01-02).
  if (estado.usuario.clave_temporal) return <Navigate to="/cambiar-clave" />;
  if (rol && !roles(estado.usuario).has(rol)) return <Navigate to={rutaInicial(estado.usuario)} />;
  return <>{children}</>;
}

/** La app instalada (PWA) abre directamente la entrada; en el navegador, la página pública. */
function instalada(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches ?? false;
}

function Inicio() {
  const { estado } = useSesion();
  if (estado.tipo === "activo") return <Navigate to={rutaInicial(estado.usuario)} replace />;
  if (estado.tipo === "anonimo") {
    return instalada() ? <Navigate to="/entrar" replace /> : <InicioPublico />;
  }
  if (estado.tipo === "sin-conexion") return <SinConexion />;
  return <Esqueleto />;
}

/** Panel de inicio: el del docente si lo es; si no, el del estudiante. */
function PanelDelRol() {
  const { estado } = useSesion();
  if (estado.tipo !== "activo") return null;
  const r = roles(estado.usuario);
  if (r.has("docente")) return <PanelDocente />;
  if (r.has("estudiante")) return <PanelEstudiante />;
  return <Navigate to={rutaInicial(estado.usuario)} replace />;
}

function BotonTema() {
  const [tema, setTema] = useState<Tema>(temaGuardado);
  const otro: Tema = tema === "claro" ? "oscuro" : "claro";
  return (
    <Boton
      variante="secundario"
      icono={tema === "claro" ? Moon : Sun}
      aria-label={`Cambiar a tema ${otro}`}
      onClick={() => {
        aplicarTema(otro);
        setTema(otro);
      }}
    >
      <span>{tema === "claro" ? "Oscuro" : "Claro"}</span>
    </Boton>
  );
}

function Marca() {
  return (
    <span className="marca">
      <LogoTeclas />
      <span className="marca-texto">SkillTrack-Piano</span>
    </span>
  );
}

const CLAVE_MENU = "skilltrack.menu";

/** Preferencia del menú lateral (recogido o abierto), recordada en este navegador. */
function useMenuRecogido(): [boolean, () => void] {
  const [recogido, setRecogido] = useState(() => {
    try {
      return localStorage.getItem(CLAVE_MENU) === "recogido";
    } catch {
      return false;
    }
  });
  const alternar = () =>
    setRecogido((r) => {
      try {
        localStorage.setItem(CLAVE_MENU, r ? "abierto" : "recogido");
      } catch {
        // Sin almacenamiento disponible: la preferencia dura hasta recargar.
      }
      return !r;
    });
  return [recogido, alternar];
}

/** Barra superior: la marca (cuando no hay menú lateral), el cambio de tema y la salida. */
function Barra() {
  const { estado, salir } = useSesion();
  const { pathname } = useLocation();
  const activo = estado.tipo === "activo" && !estado.usuario.clave_temporal;
  return (
    <header className="barra">
      <div className="barra-fila">
        <Marca />
        <div className="barra-acciones">
          {estado.tipo === "anonimo" && pathname === "/" && <BotonPlanes />}
          <BotonTema />
          {activo && (
            <Boton variante="secundario" icono={LogOut} onClick={() => void salir()}>
              <span>Salir</span>
            </Boton>
          )}
        </div>
      </div>
    </header>
  );
}

function Destino({ a, icono: Icono, texto }: { a: string; icono: LucideIcon; texto: string }) {
  return (
    <NavLink to={a} end={a === "/inicio"}>
      <Icono aria-hidden="true" />
      <span>{texto}</span>
    </NavLink>
  );
}

const iniciales = (nombre: string) =>
  nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

/**
 * Menú de cada rol: lateral (azul marino) en el escritorio, con la marca arriba y la persona con
 * su rol abajo; barra inferior de íconos en el móvil. Solo secciones que existen.
 */
function Navegacion({ recogido, alternar }: { recogido: boolean; alternar: () => void }) {
  const { estado } = useSesion();
  if (estado.tipo !== "activo" || estado.usuario.clave_temporal) return null;
  const r = roles(estado.usuario);
  const conInicio = r.has("estudiante") || r.has("docente");
  const rol = [...r].map((x) => NOMBRE_ROL[x]).join(" · ");
  return (
    <aside className="lateral">
      <div className="lateral-cabecera">
        <Marca />
        <button
          type="button"
          className="secundario lateral-recoger"
          aria-expanded={!recogido}
          aria-label={recogido ? "Expandir el menú" : "Contraer el menú"}
          onClick={alternar}
        >
          {recogido ? <PanelLeftOpen aria-hidden="true" /> : <PanelLeftClose aria-hidden="true" />}
        </button>
      </div>
      <nav className="navegacion" aria-label="Principal">
        {conInicio && <Destino a="/inicio" icono={House} texto="Inicio" />}
        {r.has("estudiante") && <Destino a="/tareas" icono={ClipboardList} texto="Mis tareas" />}
        {r.has("docente") && (
          <Destino a="/estudiantes" icono={GraduationCap} texto="Mis estudiantes" />
        )}
        {r.has("docente") && <Destino a="/mi-grupo" icono={TableProperties} texto="Mi grupo" />}
        {conInicio && <Destino a="/catalogo" icono={BookOpen} texto="Ejercicios" />}
        {r.has("estudiante") && <Destino a="/mi-progreso" icono={ChartLine} texto="Mi progreso" />}
        {r.has("admin_inst") && <Destino a="/usuarios" icono={UsersRound} texto="Usuarios" />}
        {r.has("investigador") && (
          <Destino a="/investigacion" icono={FlaskConical} texto="Investigación" />
        )}
        <Destino a="/perfil" icono={UserRound} texto="Perfil" />
      </nav>
      <div className="lateral-persona">
        <span className="avatar" aria-hidden="true">
          {iniciales(estado.usuario.nombre_visible)}
        </span>
        <span className="lateral-datos">
          <span className="lateral-nombre">{estado.usuario.nombre_visible}</span>
          <span className="lateral-rol">{rol}</span>
        </span>
      </div>
    </aside>
  );
}

/** Retiene la pantalla anterior hasta que el navegador la captura para la transición. */
function useUbicacionConTransicion(): Location {
  const ubicacion = useLocation();
  const [mostrada, setMostrada] = useState(ubicacion);
  useLayoutEffect(() => {
    if (ubicacion.key === mostrada.key) return;
    const sinMovimiento = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!document.startViewTransition || sinMovimiento) {
      setMostrada(ubicacion);
      return;
    }
    document.startViewTransition(() => flushSync(() => setMostrada(ubicacion)));
  }, [ubicacion, mostrada]);
  return mostrada;
}

export function App() {
  const { estado } = useSesion();
  const mostrada = useUbicacionConTransicion();
  const conNavegacion = estado.tipo === "activo" && !estado.usuario.clave_temporal;
  const [recogido, alternar] = useMenuRecogido();
  const clases = ["aplicacion", conNavegacion && "con-navegacion", recogido && "menu-recogido"];
  return (
    <ProveedorAvisos>
      <div className={clases.filter(Boolean).join(" ")}>
        <Navegacion recogido={recogido} alternar={alternar} />
        <Barra />
        <main className="contenedor">
          <Routes location={mostrada}>
            <Route
              path="/mi-progreso"
              element={
                <Protegida rol="estudiante">
                  <PaginaMiProgreso />
                </Protegida>
              }
            />
            <Route
              path="/mi-grupo"
              element={
                <Protegida rol="docente">
                  <PaginaMiGrupo />
                </Protegida>
              }
            />
            <Route
              path="/design"
              element={
                <Suspense fallback={<Esqueleto />}>
                  <Diseno />
                </Suspense>
              }
            />
            <Route
              path="/design/vista/:nombre"
              element={
                <Suspense fallback={<Esqueleto />}>
                  <VistaEjemplo />
                </Suspense>
              }
            />
            <Route path="/" element={<Inicio />} />
            <Route
              path="/inicio"
              element={
                <Protegida>
                  <PanelDelRol />
                </Protegida>
              }
            />
            <Route
              path="/perfil"
              element={
                <Protegida>
                  <Perfil />
                </Protegida>
              }
            />
            <Route path="/entrar" element={<Entrar />} />
            <Route path="/planes" element={<PaginaPlanes />} />
            <Route path="/cambiar-clave" element={<CambiarClave />} />
            <Route
              path="/tareas"
              element={
                <Protegida rol="estudiante">
                  <MisTareas />
                </Protegida>
              }
            />
            <Route
              path="/tareas/:id"
              element={
                <Protegida>
                  <DetalleTarea />
                </Protegida>
              }
            />
            <Route
              path="/catalogo"
              element={
                <Protegida>
                  <Catalogo />
                </Protegida>
              }
            />
            <Route
              path="/microfono"
              element={
                <Protegida rol="estudiante">
                  <Suspense fallback={<Esqueleto />}>
                    <PaginaMicrofono />
                  </Suspense>
                </Protegida>
              }
            />
            <Route
              path="/practicar/:tareaId"
              element={
                <Protegida rol="estudiante">
                  <Suspense fallback={<Esqueleto />}>
                    <PaginaPractica />
                  </Suspense>
                </Protegida>
              }
            />
            <Route
              path="/practicar"
              element={
                <Protegida rol="estudiante">
                  <Suspense fallback={<Esqueleto />}>
                    <PaginaPractica />
                  </Suspense>
                </Protegida>
              }
            />
            <Route
              path="/catalogo/:codigo"
              element={
                <Protegida>
                  <DetalleEjercicio />
                </Protegida>
              }
            />
            <Route
              path="/estudiantes"
              element={
                <Protegida rol="docente">
                  <MisEstudiantes />
                </Protegida>
              }
            />
            <Route
              path="/estudiantes/:id"
              element={
                <Protegida>
                  <DetalleEstudiante />
                </Protegida>
              }
            />
            <Route
              path="/usuarios"
              element={
                <Protegida rol="admin_inst">
                  <Usuarios />
                </Protegida>
              }
            />
            <Route
              path="/investigacion"
              element={
                <Protegida rol="investigador">
                  <ModoInvestigacion />
                </Protegida>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </ProveedorAvisos>
  );
}

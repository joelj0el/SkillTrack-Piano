import type { Rol } from "@skilltrack/contracts";
import {
  BookOpen,
  ClipboardList,
  FlaskConical,
  GraduationCap,
  LogOut,
  Mic,
  Moon,
  Sun,
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
import { CambiarClave, Entrar } from "./paginas/entrada.tsx";
import { DetalleTarea, MisTareas } from "./paginas/estudiante.tsx";
import { ModoInvestigacion } from "./paginas/investigacion.tsx";
import { roles, rutaInicial, useSesion } from "./sesion.tsx";
import { aplicarTema, temaGuardado, type Tema } from "./tema.ts";
import { Boton, Esqueleto, ProveedorAvisos } from "./ui/base.tsx";
import { LogoTeclas, TiraTeclas } from "./ui/ilustraciones.tsx";

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

function Inicio() {
  const { estado } = useSesion();
  if (estado.tipo === "activo") return <Navigate to={rutaInicial(estado.usuario)} replace />;
  if (estado.tipo === "anonimo") return <Navigate to="/entrar" replace />;
  if (estado.tipo === "sin-conexion") return <SinConexion />;
  return <Esqueleto />;
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

function Barra() {
  const { estado, salir } = useSesion();
  const activo = estado.tipo === "activo" && !estado.usuario.clave_temporal;
  return (
    <header className="barra">
      <div className="barra-fila">
        <span className="marca">
          <LogoTeclas />
          SkillTrack-Piano
        </span>
        <div className="barra-acciones">
          <BotonTema />
          {activo && (
            <Boton variante="secundario" icono={LogOut} onClick={() => void salir()}>
              <span>Salir</span>
            </Boton>
          )}
        </div>
      </div>
      <TiraTeclas />
    </header>
  );
}

function Destino({ a, icono: Icono, texto }: { a: string; icono: LucideIcon; texto: string }) {
  return (
    <NavLink to={a}>
      <Icono aria-hidden="true" />
      {texto}
    </NavLink>
  );
}

function Navegacion() {
  const { estado } = useSesion();
  if (estado.tipo !== "activo" || estado.usuario.clave_temporal) return null;
  const r = roles(estado.usuario);
  return (
    <nav className="navegacion" aria-label="Principal">
      {r.has("estudiante") && <Destino a="/tareas" icono={ClipboardList} texto="Mis tareas" />}
      {r.has("estudiante") && <Destino a="/microfono" icono={Mic} texto="Micrófono" />}
      {r.has("docente") && (
        <Destino a="/estudiantes" icono={GraduationCap} texto="Mis estudiantes" />
      )}
      {r.has("admin_inst") && <Destino a="/usuarios" icono={UsersRound} texto="Usuarios" />}
      {r.has("investigador") && (
        <Destino a="/investigacion" icono={FlaskConical} texto="Modo investigación" />
      )}
      <Destino a="/catalogo" icono={BookOpen} texto="Catálogo" />
    </nav>
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
  return (
    <ProveedorAvisos>
      <div className={conNavegacion ? "aplicacion con-navegacion" : "aplicacion"}>
        <Barra />
        <Navegacion />
        <main className="contenedor">
          <Routes location={mostrada}>
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
            <Route path="/entrar" element={<Entrar />} />
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

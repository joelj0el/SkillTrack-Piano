import type { Rol } from "@skilltrack/contracts";
import { Suspense, lazy, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router";
import { SinConexion } from "./componentes.tsx";
import { Usuarios } from "./paginas/admin.tsx";
import { DetalleEjercicio, Catalogo } from "./paginas/catalogo.tsx";
import { DetalleEstudiante, MisEstudiantes } from "./paginas/docente.tsx";
import { CambiarClave, Entrar } from "./paginas/entrada.tsx";
import { DetalleTarea, MisTareas } from "./paginas/estudiante.tsx";
import { ModoInvestigacion } from "./paginas/investigacion.tsx";
import { roles, rutaInicial, useSesion } from "./sesion.tsx";
import { aplicarTema, temaGuardado, type Tema } from "./tema.ts";

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
  if (estado.tipo === "cargando") return <p className="suave">Cargando…</p>;
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
  return <p className="suave">Cargando…</p>;
}

function BotonTema() {
  const [tema, setTema] = useState<Tema>(temaGuardado);
  const otro: Tema = tema === "claro" ? "oscuro" : "claro";
  return (
    <button
      type="button"
      className="secundario compacto"
      aria-label={`Cambiar a tema ${otro}`}
      onClick={() => {
        aplicarTema(otro);
        setTema(otro);
      }}
    >
      {tema === "claro" ? "☾ Oscuro" : "☀ Claro"}
    </button>
  );
}

function Barra() {
  const { estado, salir } = useSesion();
  if (estado.tipo !== "activo" || estado.usuario.clave_temporal) {
    return (
      <header className="barra">
        <strong>SkillTrack-Piano</strong>
        <BotonTema />
      </header>
    );
  }
  const r = roles(estado.usuario);
  return (
    <header className="barra">
      <strong>SkillTrack-Piano</strong>
      <nav aria-label="Principal">
        {r.has("estudiante") && <Link to="/tareas">Mis tareas</Link>}
        {r.has("estudiante") && <Link to="/microfono">Micrófono</Link>}
        {r.has("docente") && <Link to="/estudiantes">Mis estudiantes</Link>}
        {r.has("admin_inst") && <Link to="/usuarios">Usuarios</Link>}
        {r.has("investigador") && <Link to="/investigacion">Modo investigación</Link>}
        <Link to="/catalogo">Catálogo</Link>
        <BotonTema />
        <button type="button" className="secundario compacto" onClick={() => void salir()}>
          Salir
        </button>
      </nav>
    </header>
  );
}

export function App() {
  return (
    <>
      <Barra />
      <main className="contenedor">
        <Routes>
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
                <Suspense fallback={<p className="suave">Cargando…</p>}>
                  <PaginaMicrofono />
                </Suspense>
              </Protegida>
            }
          />
          <Route
            path="/practicar/:tareaId"
            element={
              <Protegida rol="estudiante">
                <Suspense fallback={<p className="suave">Cargando…</p>}>
                  <PaginaPractica />
                </Suspense>
              </Protegida>
            }
          />
          <Route
            path="/practicar"
            element={
              <Protegida rol="estudiante">
                <Suspense fallback={<p className="suave">Cargando…</p>}>
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
    </>
  );
}

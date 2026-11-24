import { LONGITUD_MINIMA_CLAVE } from "@skilltrack/contracts";
import { ArrowLeft, KeyRound, LogIn, LogOut, Mic } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { ErrorApi, SinConexion, pedir } from "../api.ts";
import { NOMBRE_ROL, roles, rutaInicial, useSesion } from "../sesion.tsx";
import { Boton, EnlaceBoton, PaginaCabecera } from "../ui/base.tsx";
import { LogoTeclas } from "../ui/ilustraciones.tsx";
import { TecladoPerspectiva } from "../ui/portada.tsx";

function mensajeDeError(error: unknown): string {
  if (error instanceof SinConexion) return "Sin conexión. Revisa tu red e inténtalo de nuevo.";
  if (error instanceof ErrorApi && typeof error.detalle === "string") return error.detalle;
  return "No se pudo completar la operación.";
}

export function Entrar() {
  const { estado, entrar } = useSesion();
  const navegar = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (estado.tipo === "activo") return <Navigate to={rutaInicial(estado.usuario)} replace />;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    setEnviando(true);
    setError(null);
    try {
      await entrar(String(datos.get("usuario")), String(datos.get("clave")));
      navegar("/", { replace: true });
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="entrada-pagina">
      <EnlaceBoton to="/" variante="secundario" icono={ArrowLeft} className="volver">
        Volver al inicio
      </EnlaceBoton>
      <section className="entrada entrada-doble">
        <div className="tarjeta entrada-tarjeta vidrio">
          <div className="entrada-marca">
            <LogoTeclas />
            <p className="entrada-nombre">SkillTrack-Piano</p>
            <p className="entrada-lema">Aprende · Practica · Progresa</p>
          </div>
          <h1>Iniciar sesión</h1>
          <form onSubmit={(e) => void enviar(e)}>
            <label>
              Usuario
              <input name="usuario" autoComplete="username" required />
            </label>
            <label>
              Contraseña
              <input name="clave" type="password" autoComplete="current-password" required />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <Boton type="submit" cargando={enviando} icono={LogIn} className="boton-grande">
              Iniciar sesión
            </Boton>
          </form>
          <p className="entrada-ayuda suave">
            ¿Olvidaste tu contraseña? Pídele a tu docente o administrador que la restablezca.
          </p>
        </div>
        <div className="entrada-decorado" aria-hidden="true">
          <p className="entrada-decorado-frase">Tu progreso, nuestra melodía.</p>
          <TecladoPerspectiva />
        </div>
      </section>
    </div>
  );
}

export function CambiarClave() {
  const { estado, recargar } = useSesion();
  const navegar = useNavigate();
  const [error, setError] = useState<string | null>(null);

  if (estado.tipo === "anonimo") return <Navigate to="/entrar" replace />;

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const nueva = String(datos.get("nueva"));
    if (nueva !== String(datos.get("confirmacion"))) {
      setError("Las contraseñas nuevas no coinciden.");
      return;
    }
    try {
      await pedir("POST", "/auth/cambiar-clave", null, {
        clave_actual: String(datos.get("actual")),
        clave_nueva: nueva,
      });
      await recargar();
      navegar("/", { replace: true });
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  const temporal = estado.tipo === "activo" && estado.usuario.clave_temporal;
  return (
    <section className="entrada">
      <div className="tarjeta entrada-tarjeta">
        <h1>Cambiar contraseña</h1>
        {temporal && (
          <p className="aviso">
            Estás usando una contraseña temporal. Define una contraseña nueva para continuar.
          </p>
        )}
        <form onSubmit={(e) => void enviar(e)}>
          <label>
            Contraseña actual
            <input name="actual" type="password" autoComplete="current-password" required />
          </label>
          <label>
            Contraseña nueva (mínimo {LONGITUD_MINIMA_CLAVE} caracteres)
            <input
              name="nueva"
              type="password"
              autoComplete="new-password"
              minLength={LONGITUD_MINIMA_CLAVE}
              required
            />
          </label>
          <label>
            Repite la contraseña nueva
            <input
              name="confirmacion"
              type="password"
              autoComplete="new-password"
              minLength={LONGITUD_MINIMA_CLAVE}
              required
            />
          </label>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <Boton type="submit" icono={KeyRound}>
            Guardar contraseña
          </Boton>
        </form>
      </div>
    </section>
  );
}

/** Perfil (solo lectura): nombre, usuario y roles; cambio de contraseña y prueba de micrófono. */
export function Perfil() {
  const { estado, salir } = useSesion();
  if (estado.tipo !== "activo") return null;
  const r = roles(estado.usuario);
  return (
    <section>
      <PaginaCabecera titulo="Perfil" />
      <div className="tarjeta perfil">
        <dl className="perfil-datos">
          <div>
            <dt>Nombre</dt>
            <dd>{estado.usuario.nombre_visible}</dd>
          </div>
          <div>
            <dt>Usuario</dt>
            <dd>{estado.usuario.usuario}</dd>
          </div>
          <div>
            <dt>{r.size === 1 ? "Rol" : "Roles"}</dt>
            <dd>{[...r].map((x) => NOMBRE_ROL[x]).join(" · ")}</dd>
          </div>
          {estado.usuario.correo && (
            <div>
              <dt>Correo</dt>
              <dd>{estado.usuario.correo}</dd>
            </div>
          )}
          {estado.usuario.telefono && (
            <div>
              <dt>Teléfono</dt>
              <dd>{estado.usuario.telefono}</dd>
            </div>
          )}
        </dl>
      </div>
      <div className="perfil-acciones">
        <EnlaceBoton to="/cambiar-clave" icono={KeyRound} variante="secundario">
          Cambiar contraseña
        </EnlaceBoton>
        {r.has("estudiante") && (
          <EnlaceBoton to="/microfono" icono={Mic} variante="secundario">
            Probar el micrófono
          </EnlaceBoton>
        )}
        <Boton variante="secundario" icono={LogOut} onClick={() => void salir()}>
          Cerrar sesión
        </Boton>
      </div>
      <p className="suave">
        Para cambiar tu nombre o tu usuario, pídeselo al administrador de tu institución.
      </p>
    </section>
  );
}

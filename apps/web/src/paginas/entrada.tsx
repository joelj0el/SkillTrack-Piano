import { LONGITUD_MINIMA_CLAVE } from "@skilltrack/contracts";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router";
import { ErrorApi, SinConexion, pedir } from "../api.ts";
import { rutaInicial, useSesion } from "../sesion.tsx";

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
    <section>
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
        <button type="submit" disabled={enviando}>
          Entrar
        </button>
      </form>
    </section>
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
    <section>
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
        <button type="submit">Guardar contraseña</button>
      </form>
    </section>
  );
}

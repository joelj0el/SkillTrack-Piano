import { LONGITUD_MINIMA_CLAVE, Plan, UsuarioActual, type TipoCuenta } from "@skilltrack/contracts";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { ErrorApi, pedir } from "../api.ts";
import { Cargado, useCarga } from "../componentes.tsx";
import { useSesion } from "../sesion.tsx";
import { Boton, EnlaceBoton, PaginaCabecera } from "../ui/base.tsx";
import { precioTexto } from "./planes.tsx";

/**
 * Registro de compradores (ADR-005): docente independiente o institución, adultos. Crea la cuenta
 * pendiente de pago (o activa, con un convenio gratuito) y abre la sesión. Los estudiantes no se
 * registran aquí: los crea su docente o su institución.
 */

const CAMPO: Record<string, string> = {
  nombre: "tu nombre",
  correo: "el correo",
  telefono: "el teléfono",
  usuario: "el usuario",
  clave: "la contraseña",
  institucion: "el nombre de la institución",
  codigo_convenio: "el código de convenio",
};

export function mensajeRegistro(e: unknown): string {
  if (e instanceof ErrorApi) {
    const campos = Object.keys(e.campos());
    if (campos.length) {
      return `Revisa ${campos.map((c) => CAMPO[c] ?? c).join(", ")}: no tiene un formato válido.`;
    }
    // 409 (usuario o correo repetidos), 422 (plan o código) y 429 traen un mensaje claro.
    return e.message;
  }
  return "No se pudo completar el registro. Revisa tu conexión e intenta de nuevo.";
}

export function PaginaRegistro() {
  const [parametros] = useSearchParams();
  const { carga } = useCarga(() => pedir("GET", "/planes", z.array(Plan)), []);
  const { recargar } = useSesion();
  const navegar = useNavigate();
  const [tipo, setTipo] = useState<TipoCuenta>("independiente");
  const [conCodigo, setConCodigo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const d = new FormData(evento.currentTarget);
    const texto = (c: string) => String(d.get(c) ?? "").trim();
    setEnviando(true);
    try {
      await pedir("POST", "/registro", UsuarioActual, {
        tipo,
        nombre: texto("nombre"),
        correo: texto("correo"),
        telefono: texto("telefono"),
        usuario: texto("usuario"),
        clave: String(d.get("clave") ?? ""),
        institucion: texto("institucion"),
        plan_id: conCodigo || !texto("plan_id") ? null : Number(texto("plan_id")),
        codigo_convenio: conCodigo ? texto("codigo_convenio") : null,
        acepta_terminos: d.get("acepta_terminos") === "on",
      });
      await recargar();
      navegar("/", { replace: true });
    } catch (e) {
      setError(mensajeRegistro(e));
      setEnviando(false);
    }
  }

  return (
    <section className="pagina-planes">
      <EnlaceBoton to="/" variante="secundario" icono={ArrowLeft} className="volver">
        Volver al inicio
      </EnlaceBoton>
      <PaginaCabecera
        titulo="Crear tu cuenta"
        detalle="Para docentes independientes e instituciones. Los estudiantes no se registran aquí: los crea su docente o su institución."
      />
      <Cargado carga={carga}>
        {(planes) => (
          <form
            className="tarjeta vidrio formulario"
            aria-label="Crear tu cuenta"
            onSubmit={(e) => void enviar(e)}
          >
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <fieldset className="opciones">
              <legend>¿Cómo usarás SkillTrack-Piano?</legend>
              <label className="fila">
                <input
                  type="radio"
                  name="tipo"
                  value="independiente"
                  checked={tipo === "independiente"}
                  onChange={() => setTipo("independiente")}
                />
                Soy docente independiente
              </label>
              <label className="fila">
                <input
                  type="radio"
                  name="tipo"
                  value="institucion"
                  checked={tipo === "institucion"}
                  onChange={() => setTipo("institucion")}
                />
                Represento a una institución
              </label>
            </fieldset>
            <label>
              Tu nombre
              <input name="nombre" required maxLength={120} autoComplete="name" />
            </label>
            <label>
              {tipo === "independiente"
                ? "Nombre de tu clase o estudio"
                : "Nombre de la institución"}
              <input name="institucion" required maxLength={160} autoComplete="organization" />
            </label>
            <label>
              Correo
              <input name="correo" type="email" required maxLength={254} autoComplete="email" />
            </label>
            <label>
              Teléfono
              <input
                name="telefono"
                type="tel"
                required
                pattern="[0-9 +()\-]{6,20}"
                maxLength={20}
                autoComplete="tel"
              />
            </label>
            <label>
              Usuario (minúsculas, números, punto o guion)
              <input
                name="usuario"
                required
                pattern="[a-z0-9._\-]{3,64}"
                maxLength={64}
                autoComplete="username"
              />
            </label>
            <label>
              Contraseña (al menos {LONGITUD_MINIMA_CLAVE} caracteres)
              <input
                name="clave"
                type="password"
                required
                minLength={LONGITUD_MINIMA_CLAVE}
                maxLength={256}
                autoComplete="new-password"
              />
            </label>
            <label>
              Plan
              <select
                name="plan_id"
                defaultValue={parametros.get("plan") ?? ""}
                required={!conCodigo}
                disabled={conCodigo}
              >
                <option value="" disabled>
                  Elige un plan
                </option>
                {planes.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {precioTexto(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="fila">
              <input
                type="checkbox"
                name="con_codigo"
                checked={conCodigo}
                onChange={(e) => setConCodigo(e.currentTarget.checked)}
              />
              Tengo un código de convenio
            </label>
            {conCodigo && (
              <label>
                Código de convenio (el plan y el precio salen del convenio)
                <input
                  name="codigo_convenio"
                  required
                  pattern="[A-Za-z0-9\-]{4,32}"
                  maxLength={32}
                  autoComplete="off"
                />
              </label>
            )}
            <label className="fila">
              <input type="checkbox" name="acepta_terminos" required />
              <span>
                Acepto los <Link to="/terminos">términos y condiciones</Link> y la{" "}
                <Link to="/privacidad">política de privacidad</Link>.
              </span>
            </label>
            <Boton type="submit" icono={UserPlus} cargando={enviando}>
              Crear mi cuenta
            </Boton>
            <p className="suave">
              ¿Ya tienes una cuenta? <Link to="/entrar">Inicia sesión</Link>.
            </p>
          </form>
        )}
      </Cargado>
    </section>
  );
}

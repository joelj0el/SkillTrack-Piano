import {
  Asignacion,
  ClaveRestablecida,
  UsuarioCreado,
  UsuarioListado,
} from "@skilltrack/contracts";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { ErrorApi, pedir } from "../api.ts";
import { Cargado, fechaLegible, useCarga } from "../componentes.tsx";
import { useSesion } from "../sesion.tsx";

const NOMBRE_ROL = {
  admin_inst: "Administrador",
  docente: "Docente",
  estudiante: "Estudiante",
  investigador: "Investigador",
};

function mensaje(e: unknown): string {
  if (e instanceof ErrorApi) {
    if (e.estado === 409) return "Ese nombre de usuario ya existe.";
    const campos = e.campos();
    if (Object.keys(campos).length) {
      return Object.entries(campos)
        .map(([campo, msg]) => `${campo}: ${msg}`)
        .join(" · ");
    }
    return e.message;
  }
  return "No se pudo completar la operación. Revisa tu conexión.";
}

/** Clave temporal: se muestra una sola vez y no se puede volver a consultar. */
function ClaveUnaVez({ usuario, clave }: { usuario: string; clave: string }) {
  return (
    <div className="aviso" role="status" data-clave-temporal={clave}>
      <p>
        Clave temporal de <strong>{usuario}</strong>: <code>{clave}</code>
      </p>
      <p>Anótala ahora: no se volverá a mostrar. Se pedirá cambiarla en el primer ingreso.</p>
    </div>
  );
}

export function Usuarios() {
  const { estado } = useSesion();
  const institucionId =
    estado.tipo === "activo"
      ? estado.usuario.membresias.find((m) => m.rol === "admin_inst")?.institucion_id
      : undefined;
  const base = `/instituciones/${institucionId}`;
  const { carga, recargar } = useCarga(
    () =>
      Promise.all([
        pedir("GET", `${base}/usuarios`, z.array(UsuarioListado)),
        pedir("GET", `${base}/asignaciones`, z.array(Asignacion)),
      ]),
    [base],
  );
  const [clave, setClave] = useState<{ usuario: string; clave: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function crearUsuario(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const email = String(datos.get("email") ?? "").trim();
    try {
      const creado = await pedir("POST", `${base}/usuarios`, UsuarioCreado, {
        usuario: String(datos.get("usuario")).trim(),
        nombre_visible: String(datos.get("nombre_visible")).trim(),
        email: email || null,
        es_menor: datos.get("es_menor") === "on",
        rol: datos.get("rol"),
      });
      setClave({ usuario: creado.usuario, clave: creado.clave_temporal });
      setError(null);
      formulario.reset();
      await recargar();
    } catch (e) {
      setError(mensaje(e));
    }
  }

  async function asignar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    try {
      await pedir("POST", `${base}/asignaciones`, Asignacion, {
        docente_id: Number(datos.get("docente_id")),
        estudiante_id: Number(datos.get("estudiante_id")),
      });
      setError(null);
      await recargar();
    } catch (e) {
      setError(mensaje(e));
    }
  }

  async function cerrar(asignacion: Asignacion) {
    await pedir("POST", `${base}/asignaciones/${asignacion.id}/cerrar`, Asignacion);
    await recargar();
  }

  async function restablecer(usuario: UsuarioListado) {
    const r = await pedir(
      "POST",
      `/estudiantes/${usuario.id}/restablecer-clave`,
      ClaveRestablecida,
    );
    setClave({ usuario: usuario.usuario, clave: r.clave_temporal });
  }

  return (
    <section>
      <h1>Usuarios</h1>
      {clave && <ClaveUnaVez {...clave} />}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <h2>Crear usuario</h2>
      <form aria-label="Crear usuario" onSubmit={(e) => void crearUsuario(e)}>
        <label>
          Nombre visible
          <input name="nombre_visible" required maxLength={120} />
        </label>
        <label>
          Usuario (minúsculas, números, punto o guion)
          <input name="usuario" required pattern="[a-z0-9._\-]{3,64}" />
        </label>
        <label>
          Correo (opcional)
          <input name="email" type="email" />
        </label>
        <label>
          Rol
          <select name="rol" defaultValue="estudiante">
            {Object.entries(NOMBRE_ROL).map(([valor, nombre]) => (
              <option key={valor} value={valor}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
        <label className="fila">
          <input name="es_menor" type="checkbox" /> Menor de edad
        </label>
        <button type="submit">Crear usuario</button>
      </form>
      <Cargado carga={carga}>
        {([usuarios, asignaciones]) => {
          const docentes = usuarios.filter((u) => u.roles.includes("docente"));
          const estudiantes = usuarios.filter((u) => u.roles.includes("estudiante"));
          const nombre = (id: number) => usuarios.find((u) => u.id === id)?.nombre_visible ?? id;
          return (
            <>
              <h2>Personas de la institución</h2>
              <ul className="lista" aria-label="Personas">
                {usuarios.map((u) => (
                  <li key={u.id} className="tarjeta">
                    <strong>{u.nombre_visible}</strong> <span className="suave">{u.usuario}</span>
                    <div className="suave">
                      {u.roles.map((r) => NOMBRE_ROL[r]).join(", ")}
                      {u.es_menor && " · menor de edad"}
                    </div>
                    {u.roles.includes("estudiante") && (
                      <button
                        type="button"
                        className="secundario"
                        onClick={() => void restablecer(u)}
                      >
                        Restablecer contraseña
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              <h2>Asignar estudiante a docente</h2>
              <form aria-label="Asignar estudiante" onSubmit={(e) => void asignar(e)}>
                <label>
                  Docente
                  <select name="docente_id" required>
                    {docentes.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.nombre_visible}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Estudiante
                  <select name="estudiante_id" required>
                    {estudiantes.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre_visible}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit">Asignar</button>
              </form>
              <h2>Asignaciones</h2>
              <ul className="lista" aria-label="Asignaciones">
                {asignaciones.map((a) => (
                  <li key={a.id} className="tarjeta">
                    {nombre(a.docente_id)} → {nombre(a.estudiante_id)}
                    <div className="suave">
                      Desde {fechaLegible(a.desde)}
                      {a.hasta ? ` · cerrada el ${fechaLegible(a.hasta)}` : " · vigente"}
                    </div>
                    {!a.hasta && (
                      <button type="button" className="secundario" onClick={() => void cerrar(a)}>
                        Cerrar asignación
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          );
        }}
      </Cargado>
    </section>
  );
}

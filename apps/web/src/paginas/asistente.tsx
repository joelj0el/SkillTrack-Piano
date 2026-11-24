import { Asignacion, UsuarioCreado, UsuarioListado } from "@skilltrack/contracts";
import { ArrowRight, GraduationCap, PartyPopper, SkipForward, UserPlus } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { ErrorApi, pedir } from "../api.ts";
import { Cargado, useCarga } from "../componentes.tsx";
import { roles, useSesion } from "../sesion.tsx";
import { Boton, PaginaCabecera } from "../ui/base.tsx";

/**
 * Primer ingreso del administrador (ADR-005): bienvenida → primer docente → primer estudiante.
 * Aparece mientras la institución no tenga a nadie más y no se haya terminado o saltado en este
 * navegador; cada paso se puede saltar. Un docente independiente ya es docente: no crea otro, y su
 * primer estudiante queda asignado a él.
 */

const claveVisto = (usuarioId: number) => `skilltrack.asistente.${usuarioId}`;

function visto(usuarioId: number): boolean {
  try {
    return localStorage.getItem(claveVisto(usuarioId)) === "visto";
  } catch {
    return false;
  }
}

function marcarVisto(usuarioId: number) {
  try {
    localStorage.setItem(claveVisto(usuarioId), "visto");
  } catch {
    // Sin almacenamiento: el asistente vuelve a ofrecerse mientras la institución esté vacía.
  }
}

type Paso = "bienvenida" | "docente" | "estudiante";

function mensaje(e: unknown): string {
  if (e instanceof ErrorApi) {
    if (Object.keys(e.campos()).length) return "Revisa el nombre y el usuario.";
    return e.message;
  }
  return "No se pudo crear el usuario. Revisa tu conexión.";
}

export function PrimerIngreso({ children }: { children: ReactNode }) {
  const { estado } = useSesion();
  const usuario = estado.tipo === "activo" ? estado.usuario : null;
  const institucionId = usuario?.membresias.find((m) => m.rol === "admin_inst")?.institucion_id;
  const yaVisto = !usuario || visto(usuario.id);
  const { carga } = useCarga(
    () =>
      yaVisto
        ? Promise.resolve([])
        : pedir("GET", `/instituciones/${institucionId}/usuarios`, z.array(UsuarioListado)),
    [institucionId, yaVisto],
  );
  const [terminado, setTerminado] = useState(false);
  if (!usuario || yaVisto || terminado) return <>{children}</>;
  return (
    <Cargado carga={carga}>
      {(personas) =>
        personas.some((p) => p.id !== usuario.id) ? (
          <>{children}</>
        ) : (
          <Asistente
            institucionId={institucionId!}
            independiente={roles(usuario).has("docente")}
            docenteId={usuario.id}
            alTerminar={() => {
              marcarVisto(usuario.id);
              setTerminado(true);
            }}
          />
        )
      }
    </Cargado>
  );
}

function Asistente({
  institucionId,
  independiente,
  docenteId,
  alTerminar,
}: {
  institucionId: number;
  independiente: boolean;
  docenteId: number;
  alTerminar: () => void;
}) {
  const pasos: Paso[] = independiente
    ? ["bienvenida", "estudiante"]
    : ["bienvenida", "docente", "estudiante"];
  const [indice, setIndice] = useState(0);
  const [clave, setClave] = useState<{ usuario: string; clave: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paso = pasos[indice]!;
  const siguiente = () => {
    setClave(null);
    setError(null);
    if (indice + 1 < pasos.length) setIndice(indice + 1);
    else alTerminar();
  };

  async function crear(evento: FormEvent<HTMLFormElement>, rol: "docente" | "estudiante") {
    evento.preventDefault();
    const d = new FormData(evento.currentTarget);
    try {
      const creado = await pedir(
        "POST",
        `/instituciones/${institucionId}/usuarios`,
        UsuarioCreado,
        {
          usuario: String(d.get("usuario")).trim(),
          nombre_visible: String(d.get("nombre_visible")).trim(),
          email: null,
          es_menor: d.get("es_menor") === "on",
          rol,
        },
      );
      if (rol === "estudiante" && independiente) {
        await pedir("POST", `/instituciones/${institucionId}/asignaciones`, Asignacion, {
          docente_id: docenteId,
          estudiante_id: creado.id,
        });
      }
      setClave({ usuario: creado.usuario, clave: creado.clave_temporal });
      setError(null);
    } catch (e) {
      setError(mensaje(e));
    }
  }

  const titulo = {
    bienvenida: "¡Te damos la bienvenida!",
    docente: "Crea el primer docente",
    estudiante: "Crea el primer estudiante",
  }[paso];

  return (
    <section className="pila-secciones" aria-label="Asistente de primer ingreso">
      <PaginaCabecera titulo={titulo} detalle={`Paso ${indice + 1} de ${pasos.length}`} />
      <div className="tarjeta vidrio formulario" data-asistente={paso}>
        {paso === "bienvenida" && (
          <>
            <PartyPopper aria-hidden="true" className="asistente-icono" />
            <p>
              Tu plan está activo.{" "}
              {independiente
                ? "Ya eres docente de tu clase: crea a tu primer estudiante y asígnale tareas."
                : "En dos pasos creas al primer docente y al primer estudiante de tu institución."}
            </p>
            <div className="perfil-acciones">
              <Boton icono={ArrowRight} onClick={siguiente}>
                Empezar
              </Boton>
              <Boton variante="secundario" icono={SkipForward} onClick={alTerminar}>
                Saltar el asistente
              </Boton>
            </div>
          </>
        )}
        {paso !== "bienvenida" && clave && (
          <>
            <div className="aviso" role="status" data-clave-temporal={clave.clave}>
              <p>
                Clave temporal de <strong>{clave.usuario}</strong>: <code>{clave.clave}</code>
              </p>
              <p>
                Anótala ahora: no se volverá a mostrar. Se pedirá cambiarla en el primer ingreso.
              </p>
            </div>
            <Boton icono={ArrowRight} onClick={siguiente}>
              {indice + 1 < pasos.length ? "Continuar" : "Terminar"}
            </Boton>
          </>
        )}
        {paso !== "bienvenida" && !clave && (
          <form
            aria-label={titulo}
            onSubmit={(e) => void crear(e, paso === "docente" ? "docente" : "estudiante")}
          >
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <label>
              Nombre visible
              <input name="nombre_visible" required maxLength={120} />
            </label>
            <label>
              Usuario (minúsculas, números, punto o guion)
              <input name="usuario" required pattern="[a-z0-9._\-]{3,64}" />
            </label>
            {paso === "estudiante" && (
              <label className="fila">
                <input name="es_menor" type="checkbox" /> Menor de edad
              </label>
            )}
            <div className="perfil-acciones">
              <Boton type="submit" icono={paso === "docente" ? GraduationCap : UserPlus}>
                {paso === "docente" ? "Crear docente" : "Crear estudiante"}
              </Boton>
              <Boton variante="secundario" icono={SkipForward} onClick={siguiente}>
                Saltar este paso
              </Boton>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

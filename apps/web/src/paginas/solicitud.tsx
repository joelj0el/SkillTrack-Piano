import { Plan } from "@skilltrack/contracts";
import { ArrowLeft, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { z } from "zod";
import { ErrorApi, pedir } from "../api.ts";
import { Cargado, useCarga } from "../componentes.tsx";
import { Boton, EnlaceBoton, PaginaCabecera } from "../ui/base.tsx";

/** Formulario de solicitud de acceso (reemplaza al correo): lo atiende el superadministrador. */
export function PaginaSolicitarAcceso() {
  const [parametros] = useSearchParams();
  const { carga } = useCarga(() => pedir("GET", "/planes", z.array(Plan)), []);
  const [enviada, setEnviada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const d = new FormData(evento.currentTarget);
    const texto = (c: string) => String(d.get(c) ?? "").trim();
    try {
      await pedir("POST", "/solicitudes-acceso", z.null(), {
        nombre: texto("nombre"),
        institucion: texto("institucion"),
        correo: texto("correo"),
        telefono: texto("telefono") || null,
        plan_id: texto("plan_id") ? Number(texto("plan_id")) : null,
        mensaje: texto("mensaje") || null,
      });
      setEnviada(true);
      setError(null);
    } catch (e) {
      setError(
        e instanceof ErrorApi && Object.keys(e.campos()).length
          ? "Revisa los datos: el correo o el teléfono no tienen un formato válido."
          : "No se pudo enviar la solicitud. Revisa tu conexión e intenta de nuevo.",
      );
    }
  }

  return (
    <section className="pagina-planes">
      <EnlaceBoton to="/" variante="secundario" icono={ArrowLeft} className="volver">
        Volver al inicio
      </EnlaceBoton>
      <PaginaCabecera
        titulo="Solicitar acceso"
        detalle="Déjanos tus datos y te contactaremos para habilitar SkillTrack-Piano en tu clase o institución."
      />
      {enviada ? (
        <div className="aviso" role="status" data-solicitud-enviada="true">
          <p>Recibimos tu solicitud. Te escribiremos al correo que dejaste.</p>
        </div>
      ) : (
        <Cargado carga={carga}>
          {(planes) => (
            <form
              className="tarjeta vidrio formulario"
              aria-label="Solicitar acceso"
              onSubmit={(e) => void enviar(e)}
            >
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <label>
                Tu nombre
                <input name="nombre" required maxLength={120} autoComplete="name" />
              </label>
              <label>
                Institución (o "Docente independiente")
                <input name="institucion" required maxLength={160} autoComplete="organization" />
              </label>
              <label>
                Correo
                <input name="correo" type="email" required maxLength={254} autoComplete="email" />
              </label>
              <label>
                Teléfono (opcional)
                <input name="telefono" type="tel" maxLength={20} autoComplete="tel" />
              </label>
              <label>
                Plan que te interesa
                <select name="plan_id" defaultValue={parametros.get("plan") ?? ""}>
                  <option value="">Todavía no lo sé</option>
                  {planes.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mensaje (opcional)
                <textarea name="mensaje" rows={4} maxLength={1000} />
              </label>
              <Boton type="submit" icono={Send}>
                Enviar solicitud
              </Boton>
            </form>
          )}
        </Cargado>
      )}
    </section>
  );
}

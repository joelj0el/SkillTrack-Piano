import { Check, Mail, Sparkles, X } from "lucide-react";
import { useId, useState } from "react";
import { CORREO_CONTACTO, PLANES, type Plan } from "../config/planes.ts";
import { Boton, Dialogo, PaginaCabecera } from "../ui/base.tsx";

function SolicitarInformacion({ plan }: { plan: Plan }) {
  if (!CORREO_CONTACTO) {
    // Sin correo definido todavía: el botón queda deshabilitado y la nota lo explica.
    return (
      <Boton variante={plan.destacado ? "primario" : "secundario"} icono={Mail} disabled>
        Solicitar información
      </Boton>
    );
  }
  const asunto = encodeURIComponent(`Información sobre el plan ${plan.nombre}`);
  return (
    <a
      className={["boton-enlace", plan.destacado ? undefined : "secundario"]
        .filter(Boolean)
        .join(" ")}
      href={`mailto:${CORREO_CONTACTO}?subject=${asunto}`}
    >
      <Mail aria-hidden="true" />
      Solicitar información
    </a>
  );
}

function TarjetaPlan({ plan, nivel }: { plan: Plan; nivel: "h2" | "h3" }) {
  const Titulo = nivel;
  const id = useId();
  return (
    <article className="plan vidrio" data-destacado={String(plan.destacado)} aria-labelledby={id}>
      {plan.destacado && (
        <span className="plan-insignia">
          <Sparkles aria-hidden="true" />
          Recomendado
        </span>
      )}
      <Titulo id={id}>{plan.nombre}</Titulo>
      <p className="suave">{plan.para}</p>
      <p className="plan-precio">{plan.precio}</p>
      <ul className="plan-incluye">
        {plan.incluye.map((b) => (
          <li key={b}>
            <Check aria-hidden="true" />
            {b}
          </li>
        ))}
      </ul>
      <SolicitarInformacion plan={plan} />
    </article>
  );
}

/** Las tres tarjetas de planes, con la recomendada destacada. */
export function ListaPlanes({ nivel = "h2" }: { nivel?: "h2" | "h3" }) {
  return (
    <>
      <div className="planes">
        {PLANES.map((p) => (
          <TarjetaPlan key={p.nombre} plan={p} nivel={nivel} />
        ))}
      </div>
      <p className="suave planes-nota">
        Los planes son informativos: el acceso lo crea el administrador de tu institución. Los
        precios y límites con «—» todavía no están definidos.
        {CORREO_CONTACTO ? "" : " Correo de contacto: pendiente."}
      </p>
    </>
  );
}

/** Botón "Ver planes" con su ventana flotante (Esc, foco atrapado y título: <dialog> modal). */
export function BotonPlanes({
  variante = "secundario",
  className,
}: {
  variante?: "primario" | "secundario";
  className?: string;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <Boton
        variante={variante}
        className={className}
        icono={Sparkles}
        aria-haspopup="dialog"
        onClick={() => setAbierto(true)}
      >
        Ver planes
      </Boton>
      <Dialogo
        abierto={abierto}
        titulo="Planes"
        alCerrar={() => setAbierto(false)}
        className="dialogo-planes"
        acciones={
          <Boton variante="secundario" icono={X} onClick={() => setAbierto(false)}>
            Cerrar
          </Boton>
        }
      >
        <ListaPlanes nivel="h3" />
      </Dialogo>
    </>
  );
}

/** Ruta /planes: el mismo contenido, para abrir el enlace directo. */
export function PaginaPlanes() {
  return (
    <section className="pagina-planes">
      <PaginaCabecera
        titulo="Planes"
        detalle="Elige cómo usar SkillTrack-Piano en tu clase o en tu institución."
      />
      <ListaPlanes />
    </section>
  );
}

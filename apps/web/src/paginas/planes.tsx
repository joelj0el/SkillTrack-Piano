import { Plan } from "@skilltrack/contracts";
import { Check, Send, Sparkles, X } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { pedir } from "../api.ts";
import { Cargado, useCarga } from "../componentes.tsx";
import { Boton, Dialogo, EstadoVista, PaginaCabecera } from "../ui/base.tsx";

/**
 * Planes de la página de inicio (ADR-004): se leen de la ruta pública de solo lectura con los
 * planes activos. Un precio o un límite sin definir se muestra como "—": no se inventan cifras.
 */

const PERIODO = { mensual: "al mes", anual: "al año" } as const;

export const precioTexto = (p: Pick<Plan, "precio_bs" | "periodo">) =>
  p.precio_bs === null
    ? "Bs —"
    : `Bs ${p.precio_bs.toLocaleString("es-BO", { minimumFractionDigits: 2 })} ${PERIODO[p.periodo]}`;

export const limiteTexto = (n: number | null) => (n === null ? "—" : String(n));

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
      <p className="suave">{plan.descripcion}</p>
      <p className="plan-precio">{precioTexto(plan)}</p>
      <ul className="plan-incluye">
        {plan.beneficios.map((b) => (
          <li key={b}>
            <Check aria-hidden="true" />
            {b}
          </li>
        ))}
        <li>
          <Check aria-hidden="true" />
          Hasta {limiteTexto(plan.limite_docentes)} docentes y{" "}
          {limiteTexto(plan.limite_estudiantes)} estudiantes
        </li>
      </ul>
      <Link
        className={["boton-enlace", plan.destacado ? undefined : "secundario"]
          .filter(Boolean)
          .join(" ")}
        to={`/solicitar-acceso?plan=${plan.id}`}
        aria-label={`Solicitar información sobre el plan ${plan.nombre}`}
      >
        <Send aria-hidden="true" />
        Solicitar información
      </Link>
    </article>
  );
}

/** Los planes activos, con el recomendado destacado. */
export function ListaPlanes({ nivel = "h2" }: { nivel?: "h2" | "h3" }) {
  const { carga } = useCarga(() => pedir("GET", "/planes", z.array(Plan)), []);
  return (
    <Cargado carga={carga}>
      {(planes) =>
        planes.length === 0 ? (
          <EstadoVista tipo="vacio" titulo="Todavía no hay planes publicados">
            <p>Puedes solicitar información igual y te contactaremos.</p>
          </EstadoVista>
        ) : (
          <>
            <div className="planes">
              {planes.map((p) => (
                <TarjetaPlan key={p.id} plan={p} nivel={nivel} />
              ))}
            </div>
            <p className="suave planes-nota">
              El acceso lo crea el administrador de tu institución después de tu solicitud. Los
              precios y límites con «—» todavía no están definidos.
            </p>
          </>
        )
      }
    </Cargado>
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
        {abierto && <ListaPlanes nivel="h3" />}
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

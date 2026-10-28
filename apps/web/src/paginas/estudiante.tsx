import { Tarea } from "@skilltrack/contracts";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { pedir } from "../api.ts";
import { Cargado, NOMBRE_MANOS, fechaLegible, useCarga } from "../componentes.tsx";

export function ResumenTarea({ tarea, enlace }: { tarea: Tarea; enlace?: string }) {
  const contenido = (
    <>
      <strong>
        {tarea.ejercicio.codigo} · {tarea.ejercicio.nombre}
      </strong>
      <dl className="suave">
        <div>Manos: {NOMBRE_MANOS[tarea.manos]}</div>
        <div>
          Tempo: ♩ = {tarea.tempo_min_bpm}–{tarea.tempo_max_bpm}
        </div>
        <div>Plazo: {fechaLegible(tarea.fecha_limite)}</div>
        <div>Repeticiones por día: {tarea.repeticiones_por_dia}</div>
      </dl>
      <span className="etiqueta" data-estado={tarea.estado}>
        {tarea.estado === "Vencida" && <span aria-hidden="true">⚠ </span>}
        {tarea.estado}
      </span>
    </>
  );
  return enlace ? (
    <Link className="tarjeta" to={enlace}>
      {contenido}
    </Link>
  ) : (
    <div className="tarjeta">{contenido}</div>
  );
}

export function Observaciones({ tarea }: { tarea: Tarea }) {
  if (tarea.observaciones.length === 0) {
    return <p className="suave">Tu docente todavía no registró observaciones en esta tarea.</p>;
  }
  return (
    <ul className="lista" aria-label="Observaciones">
      {tarea.observaciones.map((o) => (
        <li key={o.id} className="tarjeta">
          <div className="suave">
            {fechaLegible(o.creada_en)}
            {o.aspecto && <> · {o.aspecto.nombre}</>}
          </div>
          <p>{o.texto}</p>
        </li>
      ))}
    </ul>
  );
}

function ListaTareas({ titulo, tareas }: { titulo: string; tareas: Tarea[] }) {
  if (tareas.length === 0) return null;
  return (
    <section aria-label={titulo}>
      <h2>{titulo}</h2>
      <ul className="lista">
        {tareas.map((t) => (
          <li key={t.id}>
            <ResumenTarea tarea={t} enlace={`/tareas/${t.id}`} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** P-30 "Mis tareas": ordenadas por plazo, la más próxima primero (PA-HU29-01). */
export function MisTareas() {
  const { carga } = useCarga(() => pedir("GET", "/mis-tareas", z.array(Tarea)), []);
  return (
    <section>
      <h1>Mis tareas</h1>
      <Cargado carga={carga}>
        {(tareas) =>
          tareas.length === 0 ? (
            <div className="tarjeta" data-vacio="true">
              <p>Tu docente aún no te asignó tareas. Mientras tanto, puedes revisar el catálogo.</p>
              <Link to="/catalogo">Ver el catálogo de ejercicios</Link>
            </div>
          ) : (
            <>
              <ListaTareas
                titulo="Pendientes"
                tareas={tareas.filter((t) => t.estado !== "Cancelada")}
              />
              <ListaTareas
                titulo="Canceladas"
                tareas={tareas.filter((t) => t.estado === "Cancelada")}
              />
            </>
          )
        }
      </Cargado>
    </section>
  );
}

export function DetalleTarea() {
  const { id } = useParams();
  const { carga } = useCarga(() => pedir("GET", `/tareas/${id}`, Tarea), [id]);
  return (
    <Cargado carga={carga}>
      {(tarea) => (
        <section>
          <h1>{tarea.ejercicio.nombre}</h1>
          <ResumenTarea tarea={tarea} />
          <Link to={`/catalogo/${tarea.ejercicio.codigo}`}>
            Ver el ejercicio y su partitura
          </Link> · <Link to="/practicar">Practicar</Link>
          <h2>Observaciones de tu docente</h2>
          <Observaciones tarea={tarea} />
        </section>
      )}
    </Cargado>
  );
}

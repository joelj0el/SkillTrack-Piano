import { IntentoGuardado, Tarea } from "@skilltrack/contracts";
import {
  Ban,
  Calendar,
  Check,
  Clock,
  EyeOff,
  Hand,
  Metronome,
  Play,
  Repeat,
  TriangleAlert,
} from "lucide-react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { pedir } from "../api.ts";
import { Cargado, NOMBRE_MANOS, fechaLegible, useCarga } from "../componentes.tsx";
import { Chip, EnlaceBoton, EstadoVista, PaginaCabecera } from "../ui/base.tsx";

const ESTADO_TAREA = {
  Asignada: { tono: "neutro", icono: Clock },
  "En práctica": { tono: "correcto", icono: Repeat },
  Vencida: { tono: "tiempo", icono: TriangleAlert },
  Cancelada: { tono: "no-evaluable", icono: Ban },
} as const;

export function ResumenTarea({ tarea, enlace }: { tarea: Tarea; enlace?: string }) {
  const contenido = (
    <>
      <span className="tarjeta-titulo">
        {tarea.ejercicio.codigo} · {tarea.ejercicio.nombre}
      </span>
      <div className="suave datos">
        <div>
          <Hand aria-hidden="true" />
          Manos: {NOMBRE_MANOS[tarea.manos]}
        </div>
        <div>
          <Metronome aria-hidden="true" />
          Tempo: ♩ = {tarea.tempo_min_bpm}–{tarea.tempo_max_bpm}
        </div>
        <div>
          <Calendar aria-hidden="true" />
          Plazo: {fechaLegible(tarea.fecha_limite)}
        </div>
        <div>
          <Repeat aria-hidden="true" />
          Repeticiones por día: {tarea.repeticiones_por_dia}
        </div>
      </div>
      <div className="tarjeta-pie">
        <Chip {...ESTADO_TAREA[tarea.estado]} data-estado={tarea.estado}>
          {tarea.estado}
        </Chip>
      </div>
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
      <PaginaCabecera titulo="Mis tareas" />
      <Cargado carga={carga}>
        {(tareas) =>
          tareas.length === 0 ? (
            <EstadoVista
              tipo="vacio"
              titulo="Sin tareas por ahora"
              data-vacio="true"
              accion={<Link to="/catalogo">Ver el catálogo de ejercicios</Link>}
            >
              <p>Tu docente aún no te asignó tareas. Mientras tanto, puedes revisar el catálogo.</p>
            </EstadoVista>
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

function fechaHora(iso: string): string {
  const fecha = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()} ${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

export function DetalleTarea() {
  const { id } = useParams();
  const { carga } = useCarga(
    () =>
      Promise.all([
        pedir("GET", `/tareas/${id}`, Tarea),
        pedir("GET", "/mis-intentos", z.array(IntentoGuardado)).catch(() => []),
      ]),
    [id],
  );
  return (
    <Cargado carga={carga}>
      {([tarea, intentos]) => {
        const deLaTarea = intentos.filter((i) => i.tarea_id === tarea.id);
        return (
          <section>
            <PaginaCabecera
              titulo={tarea.ejercicio.nombre}
              accion={
                <EnlaceBoton to={`/practicar/${tarea.id}`} icono={Play}>
                  Practicar
                </EnlaceBoton>
              }
            />
            <ResumenTarea tarea={tarea} />
            <p>
              <Link to={`/catalogo/${tarea.ejercicio.codigo}`}>Ver el ejercicio</Link>
            </p>
            <h2>Mis intentos</h2>
            {deLaTarea.length === 0 ? (
              <p className="suave">Todavía no registraste intentos de esta tarea.</p>
            ) : (
              <ul className="lista" aria-label="Intentos">
                {deLaTarea.map((i) => (
                  <li key={i.id} className="tarjeta">
                    <span className="tarjeta-titulo">{fechaHora(i.iniciado_en)}</span>
                    <p className="suave">♩ = {i.tempo_elegido_bpm ?? "—"}</p>
                    {i.estado === "evaluado" ? (
                      <Chip tono="correcto" icono={Check}>
                        Analizado
                      </Chip>
                    ) : (
                      <Chip tono="no-evaluable" icono={EyeOff}>
                        No evaluable: {i.motivo_no_evaluable}
                      </Chip>
                    )}
                    {!i.cuenta_para_tarea && i.motivo_no_cuenta && (
                      <div className="suave">No cuenta para la tarea: {i.motivo_no_cuenta}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <h2>Observaciones de tu docente</h2>
            <Observaciones tarea={tarea} />
          </section>
        );
      }}
    </Cargado>
  );
}

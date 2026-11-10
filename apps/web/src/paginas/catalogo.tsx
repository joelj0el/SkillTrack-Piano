import { Ejercicio, TEMPO_PRACTICA_LENTA_MIN } from "@skilltrack/contracts";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { pedir } from "../api.ts";
import { Cargado, NOMBRE_MANOS, useCarga } from "../componentes.tsx";
import { PaginaCabecera } from "../ui/base.tsx";

export function Catalogo() {
  const { carga } = useCarga(() => pedir("GET", "/catalogo/ejercicios", z.array(Ejercicio)), []);
  return (
    <section>
      <PaginaCabecera titulo="Catálogo de ejercicios" />
      <Cargado carga={carga}>
        {(ejercicios) => (
          <ul className="lista">
            {ejercicios.map((e) => (
              <li key={e.id}>
                <Link className="tarjeta" to={`/catalogo/${e.codigo}`}>
                  <span className="tarjeta-titulo">
                    {e.codigo} · {e.nombre}
                  </span>
                  <div className="suave">
                    {e.tonalidad} · {e.compas} · {e.figura} · {e.fuente}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Cargado>
    </section>
  );
}

const PENDIENTE_PANEL = "Contenido pendiente: lo redacta y valida el panel de docentes.";

/** P-33: detalle del ejercicio con partitura, digitación, tempo y guía de posición. */
export function DetalleEjercicio() {
  const { codigo } = useParams();
  const { carga } = useCarga(
    () => pedir("GET", `/catalogo/ejercicios/${codigo}`, Ejercicio),
    [codigo],
  );
  return (
    <Cargado carga={carga}>
      {(e) => {
        const v = e.version_vigente;
        return (
          <section>
            <PaginaCabecera
              titulo={e.nombre}
              detalle={
                <>
                  {e.codigo} · {e.fuente} · {e.tonalidad} · {e.compas} en {e.figura}s · versión{" "}
                  {v.version}
                </>
              }
            />
            <h2>Partitura y digitación</h2>
            {v.partitura_svg ? (
              <div aria-label="Partitura" dangerouslySetInnerHTML={{ __html: v.partitura_svg }} />
            ) : (
              <div className="partitura-pendiente" data-pendiente="partitura">
                Partitura y digitación pendientes de transcripción: la edición del panel se
                transcribe y un docente la verifica nota por nota antes de publicarla.
              </div>
            )}
            <h2>Tempo</h2>
            <p className="tarjeta">
              Tu docente asigna un tempo entre ♩ = {v.tempo_min_permitido_bpm} y ♩ ={" "}
              {v.tempo_max_permitido_bpm}. Para practicar lento puedes bajar hasta ♩ ={" "}
              {TEMPO_PRACTICA_LENTA_MIN}.
            </p>
            <h2>Variantes de manos</h2>
            <p className="tarjeta">{e.variantes_manos.map((m) => NOMBRE_MANOS[m]).join(" · ")}</p>
            <h2>Guía de posición</h2>
            <div className="tarjeta">
              <h3>Muñeca</h3>
              <p className="suave">{PENDIENTE_PANEL}</p>
              <h3>Separación entre dedos</h3>
              <p className="suave">{PENDIENTE_PANEL}</p>
              <h3>Curvatura</h3>
              <p className="suave">{PENDIENTE_PANEL}</p>
            </div>
          </section>
        );
      }}
    </Cargado>
  );
}

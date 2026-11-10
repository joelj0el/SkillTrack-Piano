import { Ejercicio, TEMPO_PRACTICA_LENTA_MIN, type EventoEsperado } from "@skilltrack/contracts";
import { nombreNota } from "@skilltrack/core";
import { FileClock } from "lucide-react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { pedir } from "../api.ts";
import { Cargado, NOMBRE_MANOS, useCarga } from "../componentes.tsx";
import { Chip, PaginaCabecera } from "../ui/base.tsx";

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

const PENDIENTE_PANEL = "Pendiente de aprobación del panel.";

const APARTADOS_GUIA = [
  { clave: "muneca", titulo: "Muñeca" },
  { clave: "separacion", titulo: "Separación entre dedos" },
  { clave: "curvatura", titulo: "Curvatura" },
] as const;

const NOMBRE_MANO = { MD: "Mano derecha", MI: "Mano izquierda" } as const;

/** Digitación de la partitura importada, nota por nota y por mano. */
function Digitacion({ eventos }: { eventos: EventoEsperado[] }) {
  const manos = (["MD", "MI"] as const).filter((m) => eventos.some((e) => e.mano === m));
  return (
    <div className="tarjeta" data-digitacion="importada">
      {manos.map((mano) => (
        <section key={mano} aria-label={`Digitación de la ${NOMBRE_MANO[mano].toLowerCase()}`}>
          <h3>{NOMBRE_MANO[mano]}</h3>
          <ol className="digitacion">
            {eventos
              .filter((e) => e.mano === mano)
              .map((e) => (
                <li key={e.idx}>
                  {nombreNota(e.midi)}
                  <span className="dedo">
                    <span className="visualmente-oculto">, dedo </span>
                    {e.dedo}
                  </span>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

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
            <h2>Partitura</h2>
            {v.partitura_svg ? (
              <>
                {v.transcripcion === "importada" && (
                  <p>
                    <Chip icono={FileClock} data-estado="importada">
                      Pendiente de revisión del panel nota por nota
                    </Chip>
                  </p>
                )}
                {/* SVG saneado al importarlo: sin estilos, scripts ni enlaces externos. */}
                <figure
                  className="partitura"
                  role="img"
                  aria-label={`Partitura de ${e.nombre} con la digitación`}
                  data-partitura="svg"
                  dangerouslySetInnerHTML={{ __html: v.partitura_svg }}
                />
              </>
            ) : (
              <div className="partitura-pendiente" data-pendiente="partitura">
                Partitura pendiente de transcripción: la edición del panel se transcribe y un
                docente la verifica nota por nota antes de publicarla.
              </div>
            )}
            <h2>Digitación</h2>
            {v.eventos_esperados.length ? (
              <Digitacion eventos={v.eventos_esperados} />
            ) : (
              <p className="partitura-pendiente" data-pendiente="digitacion">
                Digitación pendiente de transcripción.
              </p>
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
            <div className="guia">
              {APARTADOS_GUIA.map((a) => (
                <article key={a.clave} className="tarjeta" data-apartado={a.clave}>
                  <h3>{a.titulo}</h3>
                  <div
                    className="ilustracion-reservada"
                    role="img"
                    aria-label={`Ilustración de ${a.titulo.toLowerCase()}: pendiente`}
                    data-ilustracion="pendiente"
                  >
                    Ilustración pendiente
                  </div>
                  <p className="suave">{PENDIENTE_PANEL}</p>
                </article>
              ))}
            </div>
          </section>
        );
      }}
    </Cargado>
  );
}

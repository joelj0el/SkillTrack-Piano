import { IntentoGuardado, MiGrupo, MiProgreso, type SemanaDeProgreso } from "@skilltrack/contracts";
import { CLASES, type Clase } from "@skilltrack/core";
import { useState } from "react";
import { z } from "zod";
import { pedir } from "../api.ts";
import { Cargado, fechaLegible, useCarga } from "../componentes.tsx";
import { NOMBRE_INDICADOR, NOMBRE_VARIABLE } from "../captura/resultados.ts";
import { erroresRecurrentes, progresoSemanal } from "../graficos/datos.ts";
import { escalonDeCalor, intentosDelEstudiante } from "../graficos/intentos.ts";
import {
  BarrasConteo,
  Figura,
  LineasPorVariable,
  NOTA_UMBRALES,
  TablaDatos,
} from "../graficos/graficos.tsx";
import { EstadoVista, PaginaCabecera } from "../ui/base.tsx";

/**
 * HU-15: tableros descriptivos. Solo tendencias del propio estudiante y errores recurrentes;
 * sin rankings, comparaciones entre estudiantes, estrellas ni puntajes globales.
 */

export interface FilaProgreso {
  semana: string;
  pct: Partial<Record<Clase, number>>;
}

/** Una fila por semana (de la más antigua a la más reciente) y una columna por variable con datos. */
export function filasDeProgreso(semanas: readonly SemanaDeProgreso[]): {
  clases: Clase[];
  filas: FilaProgreso[];
} {
  const porSemana = new Map<string, FilaProgreso>();
  for (const s of [...semanas].sort((a, b) => a.semana.localeCompare(b.semana))) {
    const fila = porSemana.get(s.semana) ?? { semana: s.semana, pct: {} };
    fila.pct[s.clase] = s.pct_promedio;
    porSemana.set(s.semana, fila);
  }
  const presentes = new Set(semanas.map((s) => s.clase));
  return {
    clases: CLASES.filter((c) => presentes.has(c)),
    filas: [...porSemana.values()],
  };
}

/** Cambio frente a la semana anterior con datos de la misma variable, en palabras. */
export function tendencia(actual: number | undefined, anterior: number | undefined): string | null {
  if (actual === undefined || anterior === undefined) return null;
  const d = Math.round((actual - anterior) * 10) / 10;
  if (d === 0) return "igual que la semana anterior";
  return d > 0 ? `sube ${d} puntos` : `baja ${-d} puntos`;
}

/** Una serie por variable con su valor en cada semana (null si esa semana no tuvo dato). */
export function seriesSemanales(filas: readonly FilaProgreso[], clases: readonly Clase[]) {
  return clases.map((c) => {
    const valores = filas.map((f) => f.pct[c] ?? null);
    const i = valores.findLastIndex((v) => v !== null);
    const anterior = valores.slice(0, i).findLast((v) => v !== null) ?? undefined;
    const cambio = i >= 0 ? tendencia(valores[i]!, anterior) : null;
    return {
      clase: c,
      nombre: NOMBRE_VARIABLE[c],
      valores,
      ultimoTexto:
        i < 0
          ? "Sin datos"
          : `Semana del ${fechaLegible(filas[i]!.semana)}: ${valores[i]} %${cambio ? ` · ${cambio}` : ""}`,
    };
  });
}

/** Errores del propio estudiante en sus últimos intentos evaluados, en barras. */
export function ErroresFrecuentes({
  intentos,
  ultimos,
  titulo,
}: {
  intentos: IntentoGuardado[];
  ultimos: number;
  titulo: string;
}) {
  const { considerados, errores } = erroresRecurrentes(intentos, ultimos);
  if (considerados === 0) {
    return <p className="suave">Aún no hay intentos evaluados con errores registrados.</p>;
  }
  if (errores.length === 0) {
    return (
      <p className="suave">
        En los últimos {considerados} intentos evaluados no se registró ningún error.
      </p>
    );
  }
  return (
    <Figura
      titulo={titulo}
      data-figura="errores"
      nota={`Cuenta en cuántos de los últimos ${considerados} intentos evaluados apareció cada clase de error.`}
      tabla={
        <TablaDatos
          titulo="Errores por clase"
          columnas={["Clase de error", "Intentos con el error", "Intentos considerados"]}
          filas={errores.map((e) => ({
            clave: e.clase,
            celdas: [NOMBRE_VARIABLE[e.clase], e.intentos, considerados],
          }))}
        />
      }
    >
      <BarrasConteo
        total={considerados}
        filas={errores.map((e) => ({
          clave: e.clase,
          nombre: NOMBRE_VARIABLE[e.clase],
          n: e.intentos,
        }))}
      />
    </Figura>
  );
}

export function PaginaMiProgreso() {
  const { carga } = useCarga(
    () =>
      Promise.all([
        pedir("GET", "/tableros/mi-progreso", MiProgreso),
        // Los errores frecuentes son un agregado aparte: si fallan, el progreso igual se muestra.
        pedir("GET", "/mis-intentos", z.array(IntentoGuardado)).catch(() => null),
      ]),
    [],
  );
  return (
    <section>
      <PaginaCabecera
        titulo="Mi progreso"
        detalle="Promedio semanal del % de notas sin error en cada variable, en tus intentos evaluados."
      />
      <Cargado carga={carga}>
        {([{ semanas }, intentos]) => {
          if (!semanas.length) {
            return (
              <EstadoVista tipo="vacio" titulo="Aún no hay semanas con datos" data-vacio="true">
                <p>
                  Cuando practiques y tus intentos se evalúen, aquí verás cómo cambia cada variable.
                </p>
              </EstadoVista>
            );
          }
          const { clases, filas } = filasDeProgreso(semanas);
          return (
            <div className="pila-secciones">
              <Figura
                titulo="Tu % en cada variable, semana a semana"
                data-figura="progreso"
                nota={`${NOTA_UMBRALES} La tabla de abajo tiene los mismos datos.`}
              >
                <LineasPorVariable sufijo=" por semana" series={seriesSemanales(filas, clases)} />
              </Figura>
              <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Mi progreso">
                <table className="tabla" aria-label="Calificación por variable por semana">
                  <thead>
                    <tr>
                      <th>Semana del</th>
                      {clases.map((c) => (
                        <th key={c}>{NOMBRE_VARIABLE[c]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((f, i) => (
                      <tr key={f.semana} data-semana={f.semana}>
                        <td>{fechaLegible(f.semana)}</td>
                        {clases.map((c) => {
                          const anterior = filas
                            .slice(0, i)
                            .findLast((x) => x.pct[c] !== undefined);
                          const cambio = tendencia(f.pct[c], anterior?.pct[c]);
                          return (
                            <td key={c} data-clase={c} data-pct={f.pct[c] ?? ""}>
                              {f.pct[c] === undefined ? "—" : `${f.pct[c]} %`}
                              {cambio && <span className="suave"> · {cambio}</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <h2>Tus errores más frecuentes</h2>
              {intentos === null ? (
                <p className="suave">No se pudieron cargar tus intentos.</p>
              ) : (
                <ErroresFrecuentes
                  intentos={intentos}
                  ultimos={10}
                  titulo="Errores en tus últimos 10 intentos evaluados"
                />
              )}
            </div>
          );
        }}
      </Cargado>
    </section>
  );
}

const OPCIONES_ULTIMOS = [5, 10, 20];

export function PaginaMiGrupo() {
  const [ultimos, setUltimos] = useState(10);
  const { carga } = useCarga(
    () => pedir("GET", `/tableros/mi-grupo?ultimos=${ultimos}`, MiGrupo),
    [ultimos],
  );
  return (
    <section>
      <PaginaCabecera
        titulo="Mi grupo"
        detalle="Errores recurrentes de cada estudiante en sus últimos intentos evaluados. Orden alfabético: no es un ranking."
      />
      <label>
        Últimos intentos
        <select name="ultimos" value={ultimos} onChange={(e) => setUltimos(Number(e.target.value))}>
          {OPCIONES_ULTIMOS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <Cargado carga={carga}>
        {({ estudiantes }) =>
          estudiantes.length === 0 ? (
            <EstadoVista tipo="vacio" titulo="Sin estudiantes asignados" data-vacio="true">
              <p>Cuando tengas estudiantes asignados, aquí verás sus errores recurrentes.</p>
            </EstadoVista>
          ) : (
            <div className="pila-secciones">
              <Figura
                titulo="Mapa de calor: en cuántos de los últimos intentos apareció cada clase de error"
                data-figura="mapa-calor"
                nota="El tono más intenso indica que el error apareció en más de los últimos intentos de ese estudiante; cada celda lo dice también en palabras. Orden alfabético: no compara estudiantes."
              >
                <ul className="calor-leyenda" aria-label="Leyenda del mapa de calor">
                  <li>Sin el error</li>
                  <li className="calor-1">Hasta 1 de cada 4</li>
                  <li className="calor-2">Hasta 2 de cada 4</li>
                  <li className="calor-3">Hasta 3 de cada 4</li>
                  <li className="calor-4">Más de 3 de cada 4</li>
                </ul>
                <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Mi grupo">
                  <table className="tabla" aria-label="Errores recurrentes por clase y estudiante">
                    <thead>
                      <tr>
                        <th>Estudiante</th>
                        {CLASES.map((c) => (
                          <th key={c}>{NOMBRE_VARIABLE[c]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {estudiantes.map((e) => (
                        <tr key={e.estudiante_id} data-estudiante={e.estudiante_id}>
                          <th scope="row">
                            {e.nombre_visible}
                            <span className="suave">
                              {" "}
                              · {e.intentos_considerados}{" "}
                              {e.intentos_considerados === 1 ? "intento" : "intentos"}
                            </span>
                          </th>
                          {CLASES.map((c) => {
                            const error = e.errores.find((x) => x.clase === c);
                            return (
                              <td
                                key={c}
                                data-clase={c}
                                data-intentos={error?.intentos_con_error ?? 0}
                                className={
                                  error
                                    ? `calor-${escalonDeCalor(error.intentos_con_error, e.intentos_considerados)}`
                                    : undefined
                                }
                              >
                                {error ? (
                                  <>
                                    En {error.intentos_con_error} de {e.intentos_considerados}
                                    <span className="suave">
                                      {" "}
                                      ·{" "}
                                      {error.indicadores.map((i) => NOMBRE_INDICADOR[i]).join(", ")}
                                    </span>
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Figura>
              <h2>Tendencia de cada variable por estudiante</h2>
              <p className="suave">
                % semanal de cada variable en los intentos de sus tareas, en orden alfabético. Cada
                estudiante se compara solo con sus semanas anteriores.
              </p>
              <ul className="estudiantes-tendencia">
                {estudiantes.map((e) => (
                  <TendenciaDelEstudiante
                    key={e.estudiante_id}
                    id={e.estudiante_id}
                    nombre={e.nombre_visible}
                  />
                ))}
              </ul>
            </div>
          )
        }
      </Cargado>
    </section>
  );
}

/** Una línea por variable con el % semanal del estudiante (docente: Mi grupo y la ficha). */
export function TendenciaDelEstudiante({ id, nombre }: { id: number; nombre: string }) {
  const { carga } = useCarga(() => intentosDelEstudiante(id), [id]);
  return (
    <li className="tarjeta" data-tendencia={id}>
      <h3>{nombre}</h3>
      <Cargado carga={carga}>
        {(intentos) => <TendenciaPorVariable intentos={intentos} nombre={nombre} />}
      </Cargado>
    </li>
  );
}

export function TendenciaPorVariable({
  intentos,
  nombre,
}: {
  intentos: IntentoGuardado[];
  nombre: string;
}) {
  const { clases, filas } = filasDeProgreso(progresoSemanal(intentos));
  if (filas.length === 0) {
    return <p className="suave">Sin intentos evaluados todavía.</p>;
  }
  return (
    <Figura
      titulo={`% semanal de cada variable de ${nombre}`}
      data-figura="tendencia"
      nota={NOTA_UMBRALES}
      tabla={
        <TablaDatos
          titulo={`Tendencia semanal de ${nombre}`}
          columnas={["Semana del", ...clases.map((c) => NOMBRE_VARIABLE[c])]}
          filas={filas.map((f) => ({
            clave: f.semana,
            celdas: [
              fechaLegible(f.semana),
              ...clases.map((c) => (f.pct[c] === undefined ? "—" : `${f.pct[c]} %`)),
            ],
          }))}
        />
      }
    >
      <LineasPorVariable sufijo=" por semana" series={seriesSemanales(filas, clases)} />
    </Figura>
  );
}

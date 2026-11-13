import { MiGrupo, MiProgreso, type SemanaDeProgreso } from "@skilltrack/contracts";
import { CLASES, type Clase } from "@skilltrack/core";
import { useState } from "react";
import { pedir } from "../api.ts";
import { Cargado, fechaLegible, useCarga } from "../componentes.tsx";
import { NOMBRE_INDICADOR, NOMBRE_VARIABLE } from "../captura/resultados.ts";
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

export function PaginaMiProgreso() {
  const { carga } = useCarga(() => pedir("GET", "/tableros/mi-progreso", MiProgreso), []);
  return (
    <section>
      <PaginaCabecera
        titulo="Mi progreso"
        detalle="Promedio semanal del % de notas sin error en cada variable, en tus intentos evaluados."
      />
      <Cargado carga={carga}>
        {({ semanas }) => {
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
                        const anterior = filas.slice(0, i).findLast((x) => x.pct[c] !== undefined);
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
                          <td key={c} data-clase={c} data-intentos={error?.intentos_con_error ?? 0}>
                            {error ? (
                              <>
                                En {error.intentos_con_error} de {e.intentos_considerados}
                                <span className="suave">
                                  {" "}
                                  · {error.indicadores.map((i) => NOMBRE_INDICADOR[i]).join(", ")}
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
          )
        }
      </Cargado>
    </section>
  );
}

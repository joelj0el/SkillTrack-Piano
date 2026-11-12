import {
  AvanceTarea,
  ClaseError,
  Ejercicio,
  EstudianteResumen,
  IntentoGuardado,
  LONGITUD_MAXIMA_OBSERVACION,
  REPETICIONES_MAX,
  REPETICIONES_MIN,
  TEMPO_DOCENTE_MAX,
  TEMPO_DOCENTE_MIN,
  TEMPO_SUGERIDO,
  Tarea,
  type ValorTarea,
} from "@skilltrack/contracts";
import { Ban, ClipboardCheck, ClipboardPlus, MessageSquarePlus, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { ErrorApi, pedir } from "../api.ts";
import { Cargado, NOMBRE_MANOS, fechaLegible, useCarga } from "../componentes.tsx";
import { Boton, EstadoVista, PaginaCabecera, useAviso } from "../ui/base.tsx";
import { NOMBRE_INDICADOR, NOMBRE_NIVEL, NOMBRE_VARIABLE } from "../captura/resultados.ts";
import {
  ListaIntentos,
  Observaciones,
  ResumenTarea,
  VALOR_TAREA,
  fechaHora,
} from "./estudiante.tsx";

/** HU-37: por cada día desde la asignación, las repeticiones válidas frente a la meta. */
function AvanceDeTarea({ tareaId }: { tareaId: number }) {
  const { carga } = useCarga(
    () => pedir("GET", `/tareas/${tareaId}/avance`, AvanceTarea),
    [tareaId],
  );
  return (
    <Cargado carga={carga}>
      {(avance) => (
        <details className="avance">
          <summary>
            Avance: {avance.validas_hoy} de {avance.meta_por_dia} hoy
          </summary>
          <div className="tabla-contenedor">
            <table className="tabla" aria-label={`Avance por día de la tarea ${tareaId}`}>
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Repeticiones válidas</th>
                </tr>
              </thead>
              <tbody>
                {[...avance.dias].reverse().map((d) => (
                  <tr key={d.fecha} data-dia={d.fecha}>
                    <td>{fechaLegible(d.fecha)}</td>
                    <td>
                      {d.validas} de {d.meta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ListaIntentos avance={avance} />
        </details>
      )}
    </Cargado>
  );
}

const METRONOMO = { con: "Con metrónomo", sin: "Sin metrónomo" } as const;

function tempoDe(i: IntentoGuardado): string {
  const medido = i.tempo_medido_bpm === null ? "—" : Math.round(i.tempo_medido_bpm);
  return `♩ elegido = ${i.tempo_elegido_bpm ?? "—"} · medido ≈ ${medido}`;
}

function CalificacionDe({ intento }: { intento: IntentoGuardado }) {
  if (intento.estado === "no_evaluable") {
    return <>No evaluable: {intento.motivo_no_evaluable ?? "sin motivo registrado"}</>;
  }
  if (!intento.calificacion) return <>Sin calificación</>;
  return (
    <ul>
      {intento.calificacion.map((c) => (
        <li key={c.clase} data-variable={c.clase}>
          {`${NOMBRE_VARIABLE[c.clase]}: ${NOMBRE_NIVEL[c.nivel]}${c.pct === null ? "" : ` (${c.pct} %)`}`}
        </li>
      ))}
    </ul>
  );
}

function IndicadoresDe({ intento }: { intento: IntentoGuardado }) {
  const codigos = intento.indicadores_deficientes;
  if (codigos === null) return <>—</>;
  if (codigos.length === 0) return <>Ninguno</>;
  return (
    <ul>
      {codigos.map((c) => (
        <li key={c} data-indicador={c}>
          {NOMBRE_INDICADOR[c] ?? c}
        </li>
      ))}
    </ul>
  );
}

/** HU-30: cada intento de la tarea, con su calificación por variable y los indicadores detectados. */
function IntentosDeTarea({ tareaId }: { tareaId: number }) {
  const { carga } = useCarga(
    () => pedir("GET", `/tareas/${tareaId}/intentos`, z.array(IntentoGuardado)),
    [tareaId],
  );
  return (
    <Cargado carga={carga}>
      {(intentos) => (
        <details className="avance">
          <summary>Intentos ({intentos.length})</summary>
          {intentos.length === 0 ? (
            <p className="suave">Todavía no hay intentos de esta tarea.</p>
          ) : (
            <div
              className="tabla-contenedor"
              tabIndex={0}
              role="region"
              aria-label={`Tabla de intentos de la tarea ${tareaId}`}
            >
              <table className="tabla" aria-label={`Intentos de la tarea ${tareaId}`}>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tempo</th>
                    <th>Metrónomo</th>
                    <th>Calificación por variable</th>
                    <th>Indicadores deficientes</th>
                  </tr>
                </thead>
                <tbody>
                  {intentos.map((i) => (
                    <tr key={i.id} data-intento={i.id}>
                      <td>{fechaHora(i.iniciado_en)}</td>
                      <td>{tempoDe(i)}</td>
                      <td>{i.modo_metronomo ? METRONOMO[i.modo_metronomo] : "—"}</td>
                      <td>
                        <CalificacionDe intento={i} />
                      </td>
                      <td>
                        <IndicadoresDe intento={i} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </details>
      )}
    </Cargado>
  );
}

/** P-20 "Mis estudiantes". */
export function MisEstudiantes() {
  const { carga } = useCarga(
    () => pedir("GET", "/mis-estudiantes", z.array(EstudianteResumen)),
    [],
  );
  return (
    <section>
      <PaginaCabecera titulo="Mis estudiantes" />
      <Cargado carga={carga}>
        {(estudiantes) =>
          estudiantes.length === 0 ? (
            <EstadoVista tipo="vacio" titulo="Sin estudiantes por ahora">
              <p>
                Todavía no tienes estudiantes asignados. El administrador de tu institución los
                asigna.
              </p>
            </EstadoVista>
          ) : (
            <ul className="lista">
              {estudiantes.map((e) => (
                <li key={e.id}>
                  <Link className="tarjeta" to={`/estudiantes/${e.id}`}>
                    <span className="tarjeta-titulo">{e.nombre_visible}</span>
                    <div className="metadato">{e.usuario}</div>
                  </Link>
                </li>
              ))}
            </ul>
          )
        }
      </Cargado>
    </section>
  );
}

function hoyIso(): string {
  const ahora = new Date();
  ahora.setMinutes(ahora.getMinutes() - ahora.getTimezoneOffset());
  return ahora.toISOString().slice(0, 10);
}

function enDias(dias: number): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  fecha.setMinutes(fecha.getMinutes() - fecha.getTimezoneOffset());
  return fecha.toISOString().slice(0, 10);
}

function Errores({ errores }: { errores: Record<string, string> | string | null }) {
  if (!errores) return null;
  const textos =
    typeof errores === "string"
      ? [errores]
      : Object.entries(errores).map(([campo, msg]) => `${campo}: ${msg}`);
  return (
    <div className="error" role="alert">
      {textos.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </div>
  );
}

function erroresDe(e: unknown): Record<string, string> | string {
  if (e instanceof ErrorApi) {
    const campos = e.campos();
    return Object.keys(campos).length ? campos : e.message;
  }
  return "No se pudo guardar. Revisa tu conexión.";
}

function numero(datos: FormData, campo: string): number {
  return Number(datos.get(campo));
}

function FormularioTarea({
  estudianteId,
  ejercicios,
  alGuardar,
}: {
  estudianteId: number;
  ejercicios: Ejercicio[];
  alGuardar: () => void;
}) {
  const [errores, setErrores] = useState<Record<string, string> | string | null>(null);
  const avisar = useAviso();

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    try {
      await pedir("POST", "/tareas", Tarea, {
        estudiante_id: estudianteId,
        ejercicio_id: numero(datos, "ejercicio_id"),
        manos: datos.get("manos"),
        tempo_min_bpm: numero(datos, "tempo_min_bpm"),
        tempo_max_bpm: numero(datos, "tempo_max_bpm"),
        repeticiones_por_dia: numero(datos, "repeticiones_por_dia"),
        fecha_limite: datos.get("fecha_limite"),
      });
      setErrores(null);
      formulario.reset();
      avisar("Tarea asignada");
      alGuardar();
    } catch (e) {
      setErrores(erroresDe(e));
    }
  }

  return (
    <form aria-label="Asignar tarea" onSubmit={(e) => void enviar(e)}>
      <label>
        Ejercicio
        <select name="ejercicio_id" required>
          {ejercicios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.codigo} · {e.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        Manos
        <select name="manos" defaultValue="juntas">
          {Object.entries(NOMBRE_MANOS).map(([valor, nombre]) => (
            <option key={valor} value={valor}>
              {nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="fila">
        <label>
          Tempo mínimo
          <input
            name="tempo_min_bpm"
            type="number"
            min={TEMPO_DOCENTE_MIN}
            max={TEMPO_DOCENTE_MAX}
            defaultValue={TEMPO_SUGERIDO.min}
            required
          />
        </label>
        <label>
          Tempo máximo
          <input
            name="tempo_max_bpm"
            type="number"
            min={TEMPO_DOCENTE_MIN}
            max={TEMPO_DOCENTE_MAX}
            defaultValue={TEMPO_SUGERIDO.max}
            required
          />
        </label>
      </div>
      <div className="fila">
        <label>
          Plazo
          <input name="fecha_limite" type="date" min={hoyIso()} defaultValue={enDias(7)} required />
        </label>
        <label>
          Repeticiones por día
          <input
            name="repeticiones_por_dia"
            type="number"
            min={REPETICIONES_MIN}
            max={REPETICIONES_MAX}
            defaultValue={3}
            required
          />
        </label>
      </div>
      <Errores errores={errores} />
      <Boton type="submit" icono={ClipboardPlus}>
        Asignar tarea
      </Boton>
    </form>
  );
}

function EditarTarea({ tarea, alGuardar }: { tarea: Tarea; alGuardar: () => void }) {
  const [errores, setErrores] = useState<Record<string, string> | string | null>(null);
  const avisar = useAviso();

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    try {
      await pedir("PATCH", `/tareas/${tarea.id}`, Tarea, {
        tempo_min_bpm: numero(datos, "tempo_min_bpm"),
        tempo_max_bpm: numero(datos, "tempo_max_bpm"),
        repeticiones_por_dia: numero(datos, "repeticiones_por_dia"),
        fecha_limite: datos.get("fecha_limite"),
      });
      setErrores(null);
      avisar("Cambios guardados");
      alGuardar();
    } catch (e) {
      setErrores(erroresDe(e));
    }
  }

  async function cancelar() {
    await pedir("POST", `/tareas/${tarea.id}/cancelar`, Tarea);
    avisar("Tarea cancelada");
    alGuardar();
  }

  return (
    <details>
      <summary>Cambiar o cancelar</summary>
      <form aria-label={`Cambiar la tarea ${tarea.id}`} onSubmit={(e) => void enviar(e)}>
        <div className="fila">
          <label>
            Tempo mínimo
            <input name="tempo_min_bpm" type="number" defaultValue={tarea.tempo_min_bpm} />
          </label>
          <label>
            Tempo máximo
            <input name="tempo_max_bpm" type="number" defaultValue={tarea.tempo_max_bpm} />
          </label>
          <label>
            Repeticiones por día
            <input
              name="repeticiones_por_dia"
              type="number"
              defaultValue={tarea.repeticiones_por_dia}
            />
          </label>
          <label>
            Plazo
            <input name="fecha_limite" type="date" defaultValue={tarea.fecha_limite} />
          </label>
        </div>
        <Errores errores={errores} />
        <div className="fila">
          <Boton type="submit" icono={Save}>
            Guardar cambios
          </Boton>
          <Boton variante="peligro" icono={Ban} onClick={() => void cancelar()}>
            Cancelar tarea
          </Boton>
        </div>
      </form>
    </details>
  );
}

function NuevaObservacion({
  tarea,
  aspectos,
  alGuardar,
}: {
  tarea: Tarea;
  aspectos: ClaseError[];
  alGuardar: () => void;
}) {
  const [errores, setErrores] = useState<Record<string, string> | string | null>(null);
  const avisar = useAviso();

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    const aspecto = String(datos.get("clase_error_id") ?? "");
    try {
      await pedir("POST", "/observaciones", null, {
        tarea_id: tarea.id,
        clase_error_id: aspecto ? Number(aspecto) : null,
        texto: String(datos.get("texto")),
      });
      setErrores(null);
      formulario.reset();
      avisar("Observación registrada");
      alGuardar();
    } catch (e) {
      setErrores(erroresDe(e));
    }
  }

  return (
    <form aria-label={`Observación para la tarea ${tarea.id}`} onSubmit={(e) => void enviar(e)}>
      <label>
        Aspecto (opcional)
        <select name="clase_error_id" defaultValue="">
          <option value="">Sin aspecto</option>
          {aspectos.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nombre_pedagogico}
            </option>
          ))}
        </select>
      </label>
      <label>
        Sugerencia
        <textarea
          name="texto"
          rows={3}
          maxLength={LONGITUD_MAXIMA_OBSERVACION}
          placeholder="Mejora…, tratando de…, para que…"
          required
        />
      </label>
      <Errores errores={errores} />
      <Boton type="submit" variante="secundario" icono={MessageSquarePlus}>
        Registrar observación
      </Boton>
    </form>
  );
}

/** HU-38 (DP-17): Lograda deja la tarea Revisada; Por repetir la devuelve a En práctica. */
function ValorarTarea({
  tarea,
  aspectos,
  alGuardar,
}: {
  tarea: Tarea;
  aspectos: ClaseError[];
  alGuardar: () => void;
}) {
  const [valor, setValor] = useState<ValorTarea>("lograda");
  const [errores, setErrores] = useState<Record<string, string> | string | null>(null);
  const avisar = useAviso();
  const porRepetir = valor === "por_repetir";

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    const plazo = String(datos.get("fecha_limite") ?? "");
    try {
      await pedir("POST", `/tareas/${tarea.id}/valoracion`, Tarea, {
        valor,
        observacion: porRepetir
          ? { clase_error_id: numero(datos, "clase_error_id"), texto: String(datos.get("texto")) }
          : null,
        fecha_limite: porRepetir && plazo ? plazo : null,
      });
      setErrores(null);
      avisar("Valoración registrada");
      alGuardar();
    } catch (e) {
      setErrores(erroresDe(e));
    }
  }

  return (
    <details>
      <summary>Valorar la tarea</summary>
      <form aria-label={`Valoración de la tarea ${tarea.id}`} onSubmit={(e) => void enviar(e)}>
        <label>
          Valoración
          <select
            name="valor"
            value={valor}
            onChange={(e) => setValor(e.currentTarget.value as ValorTarea)}
          >
            <option value="lograda">{VALOR_TAREA.lograda}</option>
            <option value="por_repetir">{VALOR_TAREA.por_repetir}</option>
          </select>
        </label>
        {porRepetir && (
          <>
            <label>
              Aspecto a repetir
              <select name="clase_error_id" defaultValue="" required>
                <option value="" disabled>
                  Elige un aspecto
                </option>
                {aspectos.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nombre_pedagogico}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Observación
              <textarea
                name="texto"
                rows={3}
                maxLength={LONGITUD_MAXIMA_OBSERVACION}
                placeholder="Repite…, tratando de…, para que…"
                required
              />
            </label>
            <label>
              Plazo nuevo (opcional)
              <input name="fecha_limite" type="date" min={hoyIso()} />
            </label>
          </>
        )}
        <Errores errores={errores} />
        <Boton type="submit" icono={ClipboardCheck}>
          Guardar valoración
        </Boton>
      </form>
    </details>
  );
}

export function DetalleEstudiante() {
  const { id } = useParams();
  const estudianteId = Number(id);
  const { carga, recargar } = useCarga(
    () =>
      Promise.all([
        pedir("GET", `/estudiantes/${estudianteId}`, EstudianteResumen),
        pedir("GET", `/estudiantes/${estudianteId}/tareas`, z.array(Tarea)),
        pedir("GET", "/catalogo/ejercicios", z.array(Ejercicio)),
        pedir("GET", "/catalogo/taxonomia", z.array(ClaseError)),
      ]),
    [estudianteId],
  );
  return (
    <Cargado carga={carga}>
      {([estudiante, tareas, ejercicios, aspectos]) => (
        <section>
          <PaginaCabecera titulo={estudiante.nombre_visible} />
          <details className="tarjeta" open={tareas.length === 0}>
            <summary>Asignar tarea</summary>
            <FormularioTarea
              estudianteId={estudianteId}
              ejercicios={ejercicios}
              alGuardar={() => void recargar()}
            />
          </details>
          <h2>Tareas</h2>
          {tareas.length === 0 && <p className="suave">Sin tareas todavía.</p>}
          <ul className="lista">
            {tareas.map((t) => (
              <li key={t.id} className="tarjeta" data-tarea={t.id}>
                <ResumenTarea tarea={t} />
                <AvanceDeTarea tareaId={t.id} />
                <IntentosDeTarea tareaId={t.id} />
                {t.estado !== "Cancelada" && (
                  <>
                    <EditarTarea tarea={t} alGuardar={() => void recargar()} />
                    <NuevaObservacion
                      tarea={t}
                      aspectos={aspectos}
                      alGuardar={() => void recargar()}
                    />
                    <ValorarTarea tarea={t} aspectos={aspectos} alGuardar={() => void recargar()} />
                  </>
                )}
                <Observaciones tarea={t} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </Cargado>
  );
}

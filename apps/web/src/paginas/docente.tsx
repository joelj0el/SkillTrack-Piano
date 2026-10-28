import {
  ClaseError,
  Ejercicio,
  EstudianteResumen,
  LONGITUD_MAXIMA_OBSERVACION,
  REPETICIONES_MAX,
  REPETICIONES_MIN,
  TEMPO_DOCENTE_MAX,
  TEMPO_DOCENTE_MIN,
  TEMPO_SUGERIDO,
  Tarea,
} from "@skilltrack/contracts";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { ErrorApi, pedir } from "../api.ts";
import { Cargado, NOMBRE_MANOS, useCarga } from "../componentes.tsx";
import { Observaciones, ResumenTarea } from "./estudiante.tsx";

/** P-20 "Mis estudiantes". */
export function MisEstudiantes() {
  const { carga } = useCarga(
    () => pedir("GET", "/mis-estudiantes", z.array(EstudianteResumen)),
    [],
  );
  return (
    <section>
      <h1>Mis estudiantes</h1>
      <Cargado carga={carga}>
        {(estudiantes) =>
          estudiantes.length === 0 ? (
            <p className="tarjeta">
              Todavía no tienes estudiantes asignados. El administrador de tu institución los
              asigna.
            </p>
          ) : (
            <ul className="lista">
              {estudiantes.map((e) => (
                <li key={e.id}>
                  <Link className="tarjeta" to={`/estudiantes/${e.id}`}>
                    <strong>{e.nombre_visible}</strong>
                    <div className="suave">{e.usuario}</div>
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
      <button type="submit">Asignar tarea</button>
    </form>
  );
}

function EditarTarea({ tarea, alGuardar }: { tarea: Tarea; alGuardar: () => void }) {
  const [errores, setErrores] = useState<Record<string, string> | string | null>(null);

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
      alGuardar();
    } catch (e) {
      setErrores(erroresDe(e));
    }
  }

  async function cancelar() {
    await pedir("POST", `/tareas/${tarea.id}/cancelar`, Tarea);
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
          <button type="submit">Guardar cambios</button>
          <button type="button" className="secundario" onClick={() => void cancelar()}>
            Cancelar tarea
          </button>
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
      <button type="submit">Registrar observación</button>
    </form>
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
          <h1>{estudiante.nombre_visible}</h1>
          <h2>Asignar tarea</h2>
          <FormularioTarea
            estudianteId={estudianteId}
            ejercicios={ejercicios}
            alGuardar={() => void recargar()}
          />
          <h2>Tareas</h2>
          {tareas.length === 0 && <p className="suave">Sin tareas todavía.</p>}
          <ul className="lista">
            {tareas.map((t) => (
              <li key={t.id} className="tarjeta" data-tarea={t.id}>
                <ResumenTarea tarea={t} />
                {t.estado !== "Cancelada" && (
                  <>
                    <EditarTarea tarea={t} alGuardar={() => void recargar()} />
                    <NuevaObservacion
                      tarea={t}
                      aspectos={aspectos}
                      alGuardar={() => void recargar()}
                    />
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

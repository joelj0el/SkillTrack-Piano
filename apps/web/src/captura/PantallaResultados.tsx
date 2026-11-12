import { IntentoGuardado, type ResultadoIntento, type Tarea } from "@skilltrack/contracts";
import {
  PRM_22,
  type CalificacionVariable,
  type EventoDiagnosticable,
  type Nivel,
  type ResultadoDiagnostico,
} from "@skilltrack/core";
import { Check, CircleHelp, Clock, Hand, Music, RotateCcw, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { pedir } from "../api.ts";
import { fechaLegible } from "../componentes.tsx";
import { Boton, Chip, EstadoVista, type Tono } from "../ui/base.tsx";
import {
  accionSugerida,
  familiaDeEvento,
  NOMBRE_INDICADOR,
  NOMBRE_NIVEL,
  NOMBRE_VARIABLE,
  ordenarPorCriticidad,
  type Familia,
} from "./resultados.ts";

/** Evento registrado con lo que la pantalla muestra en el detalle de cada nota. */
export type EventoMostrable = EventoDiagnosticable & {
  midi_esperado: number | null;
  dedo_esperado: number | null;
  motivo: string | null;
  dedo: { estado: string; valor: number | null };
  desfase_manos: { estado: string; ms: number | null; modalidad: "V" | "A" | "VA" | null } | null;
};

export interface DatosResultados {
  resultado: ResultadoIntento;
  eventos: EventoMostrable[];
  /** null sin reglas publicadas: las variables quedan "No evaluado". */
  diagnostico: ResultadoDiagnostico | null;
  variables: CalificacionVariable[];
  tarea: Tarea | null;
  guardado: string | null;
  duracionAnalisisMs: number;
  reintentar: () => void;
}

const FAMILIA: Record<Familia, { tono: Tono; icono: LucideIcon; texto: string }> = {
  correcto: { tono: "correcto", icono: Check, texto: "Correcta" },
  nota: { tono: "nota", icono: Music, texto: "Nota" },
  tiempo: { tono: "tiempo", icono: Clock, texto: "Tiempo" },
  mano: { tono: "mano", icono: Hand, texto: "Mano o dedo" },
  "no-evaluable": { tono: "no-evaluable", icono: CircleHelp, texto: "No evaluable" },
};
const NIVEL: Record<Nivel, string> = NOMBRE_NIVEL;
const MANO = { MI: "Mano izquierda", MD: "Mano derecha" } as const;
const NOMBRES = ["Do", "Do♯", "Re", "Mi♭", "Mi", "Fa", "Fa♯", "Sol", "La♭", "La", "Si♭", "Si"];
const nombreNota = (midi: number) => `${NOMBRES[midi % 12]}${Math.floor(midi / 12) - 1}`;
const notaDe = (e: EventoMostrable) =>
  e.midi_esperado === null ? "—" : nombreNota(e.midi_esperado);
const donde = (eventos: readonly number[]) =>
  eventos.length ? `Notas ${eventos.map((i) => i + 1).join(", ")}` : "Todo el intento";

/** P-42: el orden de los bloques es el del panel (§13). Sin estrellas ni puntaje global. */
export function PantallaResultados(d: DatosResultados) {
  const { resultado, diagnostico, variables } = d;
  const noEvaluable = resultado.estado === "no_evaluable";
  const detectados = ordenarPorCriticidad(diagnostico?.diagnosticos ?? []);
  const [principal, ...otros] = detectados;
  const logradas = variables.filter((v) => v.nivel === "logrado");
  const intentos = useMisIntentos(d.guardado);

  return (
    <section aria-label="Resultados" className="resultados">
      <h2 data-fase="resultado">Resultados</h2>
      <p className="suave">
        Análisis en {Math.round(d.duracionAnalisisMs)} ms ·{" "}
        <span data-guardado={d.guardado ?? "guardando"}>{d.guardado ?? "Guardando…"}</span>
        {d.tarea && (
          <>
            {" "}
            · <Link to={`/tareas/${d.tarea.id}`}>Volver a la tarea</Link>
          </>
        )}
      </p>

      {noEvaluable && (
        <EstadoVista tipo="no-evaluable" titulo="No evaluable">
          <p data-motivo-no-evaluable>{resultado.motivo_no_evaluable}</p>
          <p data-accion-sugerida>
            <strong>Qué hacer:</strong>{" "}
            {accionSugerida(resultado.motivo_no_evaluable ?? "", d.eventos)}
          </p>
        </EstadoVista>
      )}

      <section data-bloque="bien" aria-labelledby="b-bien">
        <h3 id="b-bien">Lo que hiciste bien</h3>
        {logradas.length ? (
          <ul>
            {logradas.map((v) => (
              <li key={v.clase}>
                {NOMBRE_VARIABLE[v.clase]}: {v.pct} % de las notas evaluadas sin error.
              </li>
            ))}
          </ul>
        ) : (
          <p>Ninguna variable llegó a Logrado en este intento.</p>
        )}
      </section>

      <section data-bloque="mejorar" aria-labelledby="b-mejorar">
        <h3 id="b-mejorar">Lo más importante para mejorar</h3>
        {principal ? (
          <>
            <Correccion d={principal} principal />
            {otros.length > 0 && (
              <details>
                <summary>Otros aspectos a mejorar ({otros.length})</summary>
                {otros.map((o) => (
                  <Correccion key={o.regla} d={o} />
                ))}
              </details>
            )}
          </>
        ) : (
          <p>
            {diagnostico
              ? "No se detectó ningún error en lo evaluado."
              : "Sin reglas publicadas: no hay diagnóstico."}
          </p>
        )}
      </section>

      <NotaPorNota eventos={d.eventos} diagnostico={diagnostico} />

      <section data-bloque="variables" aria-labelledby="b-variables">
        <h3 id="b-variables">Calificación por variable</h3>
        <div
          className="tabla-contenedor"
          tabIndex={0}
          role="region"
          aria-label="Tabla de calificación por variable"
        >
          <table className="tabla" aria-label="Calificación por variable">
            <thead>
              <tr>
                <th>Variable</th>
                <th>Nivel</th>
                <th>Sustento</th>
              </tr>
            </thead>
            <tbody>
              {variables.map((v) => (
                <tr key={v.clase} data-variable={v.clase} data-nivel={v.nivel}>
                  <td>{NOMBRE_VARIABLE[v.clase]}</td>
                  <td>{NIVEL[v.nivel]}</td>
                  <td>
                    {v.pct === null
                      ? v.motivo
                      : `${v.pct} % de ${v.evaluadas} ${v.evaluadas === 1 ? "unidad evaluada" : "unidades evaluadas"}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="suave" data-regla-prm22>
          Regla del panel: Logrado, {PRM_22.logrado} % o más de las notas evaluables dentro de lo
          esperado · En desarrollo, {PRM_22.enDesarrollo}–{PRM_22.logrado - 1} % · Por mejorar,
          menos de {PRM_22.enDesarrollo} % · No evaluado, sin datos suficientes.
        </p>
      </section>

      <Resumen resultado={resultado} tarea={d.tarea} intentos={intentos} />
      <TuDocente tarea={d.tarea} />
      <Progreso resultado={resultado} intentos={intentos} />

      <Boton icono={RotateCcw} onClick={d.reintentar}>
        Reintentar
      </Boton>
    </section>
  );
}

function Correccion({
  d,
  principal = false,
}: {
  d: ResultadoDiagnostico["diagnosticos"][number];
  principal?: boolean;
}) {
  return (
    <div
      className="tarjeta"
      data-correccion={principal ? "principal" : "otra"}
      data-indicador={d.indicador}
    >
      <h4>{NOMBRE_INDICADOR[d.indicador] ?? d.indicador}</h4>
      <p className="suave">{donde(d.eventos)}</p>
      <p>{d.mensaje}</p>
    </div>
  );
}

function NotaPorNota({
  eventos,
  diagnostico,
}: {
  eventos: EventoMostrable[];
  diagnostico: ResultadoDiagnostico | null;
}) {
  const [elegida, setElegida] = useState<number | null>(null);
  const diagnosticos = diagnostico?.diagnosticos ?? [];
  const actual = eventos.find((e) => e.idx === elegida);
  return (
    <section data-bloque="notas" aria-labelledby="b-notas">
      <h3 id="b-notas">Cómo lo ejecutaste, nota por nota</h3>
      <ol className="notas-linea">
        {eventos.map((e) => {
          const f = FAMILIA[familiaDeEvento(e, diagnosticos)];
          return (
            <li key={e.idx}>
              <button
                type="button"
                className="nota-boton secundario"
                aria-expanded={elegida === e.idx}
                aria-controls="detalle-nota"
                data-idx={e.idx}
                data-familia={familiaDeEvento(e, diagnosticos)}
                onClick={() => setElegida(elegida === e.idx ? null : e.idx)}
              >
                <span className="suave">
                  {e.idx + 1}. {notaDe(e)}
                </span>
                <Chip tono={f.tono} icono={f.icono}>
                  {f.texto}
                </Chip>
              </button>
            </li>
          );
        })}
      </ol>
      <div id="detalle-nota" aria-live="polite">
        {actual && (
          <dl className="datos" data-detalle={actual.idx}>
            <dt>Nota</dt>
            <dd>
              {actual.idx + 1}. {notaDe(actual)}
            </dd>
            <dt>Mano</dt>
            <dd>{actual.mano ? MANO[actual.mano] : "—"}</dd>
            <dt>Dedo</dt>
            <dd>
              {actual.dedo.valor ?? "no detectado"}
              {actual.dedo_esperado !== null && ` (la digitación pide ${actual.dedo_esperado})`}
            </dd>
            <dt>Ataque</dt>
            <dd>{actual.ataque_ms === null ? "—" : `${actual.ataque_ms} ms desde el inicio`}</dd>
            <dt>Desfase entre manos</dt>
            <dd>
              {actual.desfase_manos?.ms != null
                ? `${Math.round(actual.desfase_manos.ms)} ms`
                : actual.desfase_manos?.estado === "una-nota-atras"
                  ? "una nota atrás"
                  : "—"}
            </dd>
            {actual.estado === "no-evaluable" && (
              <>
                <dt>Motivo</dt>
                <dd data-motivo-nota>{actual.motivo ?? "sin datos suficientes"}</dd>
              </>
            )}
            {diagnosticos
              .filter((x) => x.eventos.includes(actual.idx))
              .map((x) => (
                <div key={x.regla}>
                  <dt>Aspecto</dt>
                  <dd>{NOMBRE_INDICADOR[x.indicador] ?? x.indicador}</dd>
                </div>
              ))}
          </dl>
        )}
      </div>
    </section>
  );
}

function Resumen({
  resultado,
  tarea,
  intentos,
}: {
  resultado: ResultadoIntento;
  tarea: Tarea | null;
  intentos: IntentoGuardado[] | null;
}) {
  const medido =
    resultado.tempo_medido_bpm === null ? null : Math.round(resultado.tempo_medido_bpm);
  const fueraDeRango =
    tarea && medido !== null && (medido < tarea.tempo_min_bpm || medido > tarea.tempo_max_bpm)
      ? `Tocaste a ♩≈${medido}; tu tarea pide ${tarea.tempo_min_bpm}–${tarea.tempo_max_bpm}. Este intento no cuenta para la tarea.`
      : null;
  const guardadoEnServidor = intentos?.find((i) => i.client_uuid === resultado.client_uuid);
  return (
    <section data-bloque="resumen" aria-labelledby="b-resumen">
      <h3 id="b-resumen">Resumen</h3>
      <dl className="datos">
        <dt>Tempo elegido</dt>
        <dd>{resultado.tempo_elegido_bpm === null ? "—" : `♩ = ${resultado.tempo_elegido_bpm}`}</dd>
        <dt>Tempo medido</dt>
        <dd>{medido === null ? "sin datos de audio" : `♩≈${medido}`}</dd>
        <dt>Metrónomo</dt>
        <dd>
          {resultado.modo_metronomo === "con"
            ? "Con metrónomo (pulso visual)"
            : resultado.modo_metronomo === "sin"
              ? "Sin metrónomo"
              : "—"}
        </dd>
        <dt>Notas evaluables</dt>
        <dd>
          {resultado.pct_eventos_evaluables === null
            ? "—"
            : `${resultado.pct_eventos_evaluables} %`}
        </dd>
        {tarea && (
          <>
            <dt>Cuenta para la tarea</dt>
            <dd
              data-cuenta={
                guardadoEnServidor ? String(guardadoEnServidor.cuenta_para_tarea) : "pendiente"
              }
            >
              {guardadoEnServidor
                ? guardadoEnServidor.cuenta_para_tarea
                  ? "Sí"
                  : `No: ${guardadoEnServidor.motivo_no_cuenta ?? "no cumple la tarea"}`
                : "Se sabrá al guardar el intento"}
            </dd>
          </>
        )}
      </dl>
      {fueraDeRango && <p className="aviso">{fueraDeRango}</p>}
    </section>
  );
}

function TuDocente({ tarea }: { tarea: Tarea | null }) {
  const ultima = tarea
    ? [...tarea.observaciones].sort((a, b) => b.creada_en.localeCompare(a.creada_en))[0]
    : undefined;
  return (
    <section data-bloque="docente" aria-labelledby="b-docente">
      <h3 id="b-docente">Tu docente dice</h3>
      {ultima ? (
        <blockquote data-observacion={ultima.id}>
          {ultima.aspecto && <p className="metadato">Aspecto: {ultima.aspecto.nombre}</p>}
          <p>{ultima.texto}</p>
          <p className="suave">{fechaLegible(ultima.creada_en)}</p>
        </blockquote>
      ) : (
        <p>
          {tarea
            ? "Tu docente aún no dejó observaciones en esta tarea."
            : "Práctica libre: sin observaciones del docente."}
        </p>
      )}
    </section>
  );
}

/** Intentos guardados en el servidor: dicen si este cuenta para la tarea y dan el progreso. */
function useMisIntentos(guardado: string | null): IntentoGuardado[] | null {
  const [intentos, setIntentos] = useState<IntentoGuardado[] | null>(null);
  useEffect(() => {
    if (guardado !== "Guardado") return;
    let vigente = true;
    pedir("GET", "/mis-intentos", z.array(IntentoGuardado))
      .then((lista) => vigente && setIntentos(lista))
      .catch(() => undefined);
    return () => {
      vigente = false;
    };
  }, [guardado]);
  return intentos;
}

const CLASES_PROGRESO = ["ER-A", "ER-B", "ER-C", "ER-D", "ER-E", "ER-F"] as const;

/** HU-28: calificación por variable de los últimos 5 intentos del mismo ejercicio y manos. */
function Progreso({
  resultado,
  intentos,
}: {
  resultado: ResultadoIntento;
  intentos: IntentoGuardado[] | null;
}) {
  const anteriores = (intentos ?? [])
    .filter(
      (i) =>
        i.client_uuid !== resultado.client_uuid &&
        i.version_ejercicio_id === resultado.version_ejercicio_id &&
        i.manos === resultado.manos &&
        i.calificacion !== null,
    )
    .slice(0, 5);
  return (
    <section data-bloque="progreso" aria-labelledby="b-progreso">
      <h3 id="b-progreso">Progreso</h3>
      {intentos === null ? (
        <p className="suave">Los intentos anteriores se muestran al guardar este intento.</p>
      ) : anteriores.length === 0 ? (
        <p>Aún no hay intentos anteriores de este ejercicio con estas manos.</p>
      ) : (
        <div
          className="tabla-contenedor"
          tabIndex={0}
          role="region"
          aria-label="Tabla de los últimos intentos"
        >
          <table className="tabla" aria-label="Últimos intentos">
            <thead>
              <tr>
                <th>Intento</th>
                {CLASES_PROGRESO.map((c) => (
                  <th key={c}>{NOMBRE_VARIABLE[c]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {anteriores.map((i) => (
                <tr key={i.id} data-intento={i.id}>
                  <td>{fechaLegible(i.iniciado_en)}</td>
                  {CLASES_PROGRESO.map((c) => {
                    const v = i.calificacion!.find((x) => x.clase === c);
                    return <td key={c}>{v ? NIVEL[v.nivel] : NIVEL["no-evaluado"]}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

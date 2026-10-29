import { Ejercicio, ResultadoIntento, Tarea, type EventoResultado } from "@skilltrack/contracts";
import {
  DEDOS,
  PUNTA,
  VERSION_NUCLEO,
  aplicar,
  calibracion,
  detectarDescensos,
  invertir,
  modeloTeclado,
  nombreNota,
  rangoDe,
  rangoEnCuadro,
  secuenciaEscala,
  teclaBajo,
  type Homografia,
  type ModeloTeclado,
  type NotaEsperada,
  type ToquesCalibracion,
} from "@skilltrack/core";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { pedir } from "../api.ts";
import { almacenIndexedDb, encolar, vaciar } from "../bandeja/bandeja.ts";
import { Cargado, NOMBRE_MANOS, useCarga } from "../componentes.tsx";
import type { MuestraMano, PedidoAnalisis, RespuestaAnalisis } from "./analisis.ts";
import { useAvanceAutomatico } from "./avance.ts";
import { claveCalibracion, guardarCalibracion, leerCalibracion } from "./calibracion.ts";
import { colorDeToken } from "./camara.ts";
import { duracionEsperada, transicion, type Estado, type Plan } from "./estado.ts";
import {
  PanelSemaforo,
  VistaCamara,
  type Dibujar,
  type Fotograma,
  type Vista,
} from "./Practica.tsx";

type Manos = "MI" | "MD" | "juntas";

interface Contexto {
  ejercicio: Ejercicio;
  manos: Manos;
  tarea: Tarea | null;
}

const NUMERO_DEDO = { pulgar: 1, indice: 2, medio: 3, anular: 4, menique: 5 } as const;
const ORDEN_TOQUES = [
  "frenteIzquierda",
  "frenteDerecha",
  "negrasIzquierda",
  "negrasDerecha",
] as const;

/** Ruta /practicar/:tareaId (con tarea) o /practicar?ejercicio=EJ-01&manos=juntas (libre). */
export function PaginaPractica() {
  const { tareaId } = useParams();
  const [busqueda] = useSearchParams();
  const { carga } = useCarga(async (): Promise<Contexto> => {
    if (tareaId) {
      const tarea = await pedir("GET", `/tareas/${tareaId}`, Tarea);
      const ejercicio = await pedir(
        "GET",
        `/catalogo/ejercicios/${tarea.ejercicio.codigo}`,
        Ejercicio,
      );
      return { ejercicio, manos: tarea.manos, tarea };
    }
    const codigo = busqueda.get("ejercicio") ?? "EJ-01";
    const ejercicio = await pedir("GET", `/catalogo/ejercicios/${codigo}`, Ejercicio);
    return { ejercicio, manos: (busqueda.get("manos") as Manos | null) ?? "juntas", tarea: null };
  }, [tareaId, busqueda]);
  return <Cargado carga={carga}>{(c) => <Practica contexto={c} />}</Cargado>;
}

function dibujarTeclado(
  ctx: CanvasRenderingContext2D,
  aImagen: Homografia,
  modelo: ModeloTeclado,
  esperadas: Set<number>,
) {
  const linea = colorDeToken("--color-acento");
  ctx.lineWidth = 1.5;
  for (const tecla of modelo.teclas) {
    const [y0, y1] = tecla.negra ? [1, 3] : [0, 3];
    const esquinas = [
      { x: tecla.x0, y: y0 },
      { x: tecla.x1, y: y0 },
      { x: tecla.x1, y: y1 },
      { x: tecla.x0, y: y1 },
    ].map((p) => aplicar(aImagen, p));
    ctx.beginPath();
    esquinas.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.closePath();
    ctx.strokeStyle = linea;
    ctx.stroke();
    if (esperadas.has(tecla.midi)) {
      ctx.fillStyle = colorDeToken("--color-tecla-esperada");
      ctx.fill();
    }
  }
}

function dibujarTeclaBajoDedos(
  ctx: CanvasRenderingContext2D,
  f: Fotograma,
  aPlano: Homografia,
  modelo: ModeloTeclado,
) {
  ctx.font = "600 13px system-ui";
  ctx.fillStyle = colorDeToken("--color-texto-sobre-video");
  for (const id of ["MI", "MD"] as const) {
    const mano = f.asignacion[id]?.datos;
    if (!mano) continue;
    for (const dedo of DEDOS) {
      const p = mano[PUNTA[dedo]]!;
      const px = { x: p.x * f.ancho, y: p.y * f.alto };
      const tecla = teclaBajo(modelo, aplicar(aPlano, px));
      if (tecla) ctx.fillText(nombreNota(tecla.midi), px.x - 10, px.y - 10);
    }
  }
}

function Practica({ contexto }: { contexto: Contexto }) {
  const { ejercicio, manos } = contexto;
  const esperadas = useMemo(() => secuenciaEscala(ejercicio.tonalidad, manos), [ejercicio, manos]);
  const rango = useMemo(() => rangoDe(esperadas), [esperadas]);
  const modelo = useMemo(() => modeloTeclado(rango.min, rango.max), [rango]);
  const [paso, setPaso] = useState<"encuadre" | "calibracion" | "ejecucion">("encuadre");
  const [toques, setToques] = useState<{ x: number; y: number }[]>([]);
  const [aPlano, setAPlano] = useState<Homografia | null>(null);
  const [confirmada, setConfirmada] = useState(false);
  const manosEsperadas = manos === "juntas" ? 2 : 1;

  const dibujar: Dibujar = (ctx, f) => {
    ctx.fillStyle = colorDeToken("--color-acento");
    for (const t of toques) {
      ctx.beginPath();
      ctx.arc(t.x, t.y, 7, 0, 2 * Math.PI);
      ctx.fill();
    }
    if (aPlano) {
      dibujarTeclado(ctx, invertir(aPlano), modelo, new Set(esperadas.map((n) => n.midi)));
      dibujarTeclaBajoDedos(ctx, f, aPlano, modelo);
    }
  };

  function tocar(p: { x: number; y: number }) {
    if (paso !== "calibracion" || toques.length >= 4) return;
    const nuevos = [...toques, p];
    setToques(nuevos);
    if (nuevos.length === 4) {
      const t = Object.fromEntries(
        ORDEN_TOQUES.map((k, i) => [k, nuevos[i]!]),
      ) as unknown as ToquesCalibracion;
      try {
        setAPlano(calibracion(t, modelo));
      } catch {
        setToques([]);
      }
    }
  }

  return (
    <>
      <VistaCamara
        titulo={`${ejercicio.nombre} · ${NOMBRE_MANOS[manos]}`}
        volverA={contexto.tarea ? `/tareas/${contexto.tarea.id}` : "/tareas"}
        aviso={
          <p data-secuencia="provisional">
            Secuencia provisional, sin digitación: la escala de {ejercicio.tonalidad} en 2 octavas
            (subida y bajada{manos === "juntas" ? ", manos en octava paralela" : ""}), de{" "}
            {nombreNota(rango.min)} a {nombreNota(rango.max)}. La digitación se evalúa cuando la
            partitura esté transcrita.
          </p>
        }
        manosEsperadas={manosEsperadas}
        dibujar={dibujar}
        onToque={paso === "calibracion" ? tocar : undefined}
      >
        {(vista) =>
          paso === "encuadre" ? (
            <PasoEncuadre vista={vista} continuar={() => setPaso("calibracion")} />
          ) : paso === "calibracion" ? (
            <PasoCalibracion
              vista={vista}
              modelo={modelo}
              rango={rango}
              toques={toques}
              aPlano={aPlano}
              confirmada={confirmada}
              repetir={() => {
                setToques([]);
                setAPlano(null);
                setConfirmada(false);
              }}
              usarGuardada={(t) => {
                setToques(ORDEN_TOQUES.map((k) => t[k]));
                setAPlano(calibracion(t, modelo));
              }}
              confirmar={() => {
                setConfirmada(true);
                setPaso("ejecucion");
              }}
            />
          ) : (
            <PasoEjecucion
              vista={vista}
              contexto={contexto}
              esperadas={esperadas}
              rango={rango}
              aPlano={aPlano!}
            />
          )
        }
      </VistaCamara>
    </>
  );
}

function PasoEncuadre({ vista, continuar }: { vista: Vista; continuar: () => void }) {
  const restante = useAvanceAutomatico(enVerde(vista), continuar);
  return (
    <>
      <h2>1. Coloca el teléfono</h2>
      <p className="suave">
        Detrás y por encima de ti, con el teclado horizontal y tus manos a la vista. La imagen no
        sale del teléfono.
      </p>
      <PanelSemaforo semaforo={vista.semaforo} />
      <AvisoAvance restante={restante} accion="Continúa" />
    </>
  );
}

function enVerde(vista: Vista): boolean {
  return vista.semaforo?.nivel === "verde" && vista.detector !== null;
}

/** Sin botón: con las manos en el teclado el paso avanza solo tras 3 s en verde. */
function AvisoAvance({ restante, accion }: { restante: number | null; accion: string }) {
  return restante === null ? (
    <p className="suave" data-cuenta-atras="espera">
      Pon las manos en el teclado: con el semáforo en verde, {accion.toLowerCase()} solo en 3 s.
    </p>
  ) : (
    <p className="conteo" aria-live="assertive" data-cuenta-atras={restante}>
      {accion} en {restante}…
    </p>
  );
}

function PasoCalibracion(props: {
  vista: Vista;
  modelo: ModeloTeclado;
  rango: { min: number; max: number };
  toques: { x: number; y: number }[];
  aPlano: Homografia | null;
  confirmada: boolean;
  repetir: () => void;
  usarGuardada: (t: ToquesCalibracion) => void;
  confirmar: () => void;
}) {
  const { vista, modelo, rango, toques, aPlano } = props;
  const video = vista.video.current;
  const ancho = video?.videoWidth ?? 0;
  const alto = video?.videoHeight ?? 0;
  const clave = claveCalibracion(rango.min, rango.max, ancho, alto);
  const [guardada, setGuardada] = useState<ToquesCalibracion | null>(null);

  useEffect(() => {
    if (ancho === 0) return;
    void leerCalibracion(clave).then((c) => setGuardada(c?.toques ?? null));
  }, [clave, ancho]);

  const grave = nombreNota(modelo.primeraBlanca);
  const aguda = nombreNota(modelo.ultimaBlanca);
  const instrucciones = [
    `Toca el borde frontal de la tecla ${grave}, en su lado izquierdo.`,
    `Toca el borde frontal de la tecla ${aguda}, en su lado derecho.`,
    `Toca dónde empiezan las teclas negras, a la izquierda de ${grave}.`,
    `Toca dónde empiezan las teclas negras, a la derecha de ${aguda}.`,
  ];
  const cobertura = aPlano ? rangoEnCuadro(invertir(aPlano), modelo, ancho, alto) : null;

  return (
    <>
      <h2>2. Calibra el teclado</h2>
      {!aPlano && (
        <p data-paso-calibracion={toques.length + 1}>
          <strong>Toque {toques.length + 1} de 4:</strong> {instrucciones[toques.length]}
        </p>
      )}
      {guardada && !aPlano && (
        <button type="button" className="secundario" onClick={() => props.usarGuardada(guardada)}>
          Usar la calibración guardada
        </button>
      )}
      {cobertura && !cobertura.cubre && (
        <p className="error" role="alert">
          Tu teclado o tu encuadre no cubre las teclas del ejercicio: faltan las teclas{" "}
          {cobertura.faltan.join(" y ")}. Aleja o gira el teléfono y vuelve a calibrar.
        </p>
      )}
      {aPlano && (
        <p className="suave">
          Revisa que las teclas dibujadas coincidan con las reales (las del ejercicio están
          resaltadas) y que sobre cada dedo aparezca la tecla que está tocando.
        </p>
      )}
      <div className="fila">
        <button
          type="button"
          disabled={!aPlano || !cobertura?.cubre}
          onClick={() => {
            const t = Object.fromEntries(
              ORDEN_TOQUES.map((k, i) => [k, toques[i]!]),
            ) as unknown as ToquesCalibracion;
            void guardarCalibracion({
              clave,
              toques: t,
              ancho,
              alto,
              guardada: new Date().toISOString(),
            });
            props.confirmar();
          }}
        >
          Confirmar
        </button>
        <button type="button" className="secundario" onClick={props.repetir}>
          Repetir
        </button>
      </div>
    </>
  );
}

function claseDispositivo(): string {
  const ua = navigator.userAgent;
  const so = /Android/.test(ua)
    ? "Android"
    : /iPhone|iPad/.test(ua)
      ? "iOS"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac/.test(ua)
          ? "macOS"
          : "Otro";
  const nav = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "Otro";
  return `${so}/${nav}`;
}

/** Muestra de cada mano del fotograma: altura de cada punta (profundidad relativa) y posición. */
function muestrasDe(f: Fotograma, t: number): Partial<Record<"MI" | "MD", MuestraMano>> {
  const salida: Partial<Record<"MI" | "MD", MuestraMano>> = {};
  for (const id of ["MI", "MD"] as const) {
    const m = f.asignacion[id]?.datos;
    if (!m) continue;
    const palma = Math.hypot(m[5]!.x - m[17]!.x, ((m[5]!.y - m[17]!.y) * f.alto) / f.ancho) || 1;
    const alturas: MuestraMano["alturas"] = {};
    const puntas: MuestraMano["puntas"] = {};
    for (const dedo of DEDOS) {
      const p = m[PUNTA[dedo]]!;
      // Profundidad relativa a la muñeca: el dedo que baja se aleja de la cámara (versión simple;
      // la estimación de la altura con la vista de referencia la decide S1).
      alturas[dedo] = -p.z / palma;
      puntas[dedo] = { x: p.x * f.ancho, y: p.y * f.alto };
    }
    salida[id] = { t, alturas, puntas };
  }
  return salida;
}

function PasoEjecucion(props: {
  vista: Vista;
  contexto: Contexto;
  esperadas: NotaEsperada[];
  rango: { min: number; max: number };
  aPlano: Homografia;
}) {
  const { vista, contexto, esperadas, rango, aPlano } = props;
  // Con tarea: de 40 (práctica lenta) al máximo de la tarea; sin tarea: 40–75 (PRM-02).
  const opciones = {
    min: 40,
    max: contexto.tarea?.tempo_max_bpm ?? 75,
    minimoQueCuenta: contexto.tarea?.tempo_min_bpm ?? null,
  };
  const [tempo, setTempo] = useState(contexto.tarea?.tempo_min_bpm ?? 60);
  const lenta =
    opciones.minimoQueCuenta !== null && tempo < opciones.minimoQueCuenta
      ? "Práctica lenta: no cuenta para la tarea"
      : null;
  const [instrumento, setInstrumento] = useState<
    "acustico" | "digital" | "teclado" | "no_declarado"
  >("no_declarado");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [pulso, setPulso] = useState(0);
  const [respuesta, setRespuesta] = useState<RespuestaAnalisis | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const series = useRef<Partial<Record<"MI" | "MD", MuestraMano[]>>>({});
  const inicio = useRef(0);

  const porMano = contexto.manos === "juntas" ? esperadas.length / 2 : esperadas.length;
  const plan: Plan = {
    eventosEsperados: esperadas.length,
    duracionEsperada: duracionEsperada(porMano, tempo),
  };

  function empezar() {
    series.current = {};
    setRespuesta(null);
    setGuardado(null);
    inicio.current = performance.now();
    setEstado({ fase: "conteo", desde: 0 });
    // Conteo visual de 4 pulsos (2 compases de 2/4); la medición empieza en el pulso siguiente.
    const pulsoS = 60 / tempo;
    const p = { conteo: [0, 1, 2, 3].map((i) => i * pulsoS), inicioMedicion: 4 * pulsoS };
    p.conteo.forEach((t, i) => setTimeout(() => setPulso(i + 1), t * 1000));
    setTimeout(() => {
      setPulso(0);
      setEstado((e) => (e ? transicion(e, { tipo: "fin-conteo", t: p.inicioMedicion }, plan) : e));
    }, p.inicioMedicion * 1000);
  }

  // Sin botón "Empezar": con las manos en el teclado y el semáforo en verde empieza en 3 s.
  const restante = useAvanceAutomatico(
    (!estado || estado.fase === "cancelado") && enVerde(vista),
    empezar,
  );

  // Durante "Tocando": registrar series y avanzar la máquina de estados (fin automático).
  useEffect(() => {
    if (estado?.fase !== "tocando") return;
    let cuadro = 0;
    let ultimoConteo = 0;
    let eventos = 0;
    const paso = () => {
      cuadro = requestAnimationFrame(paso);
      const f = vista.fotograma.current;
      const t = (performance.now() - inicio.current) / 1000;
      if (f) {
        for (const [id, m] of Object.entries(muestrasDe(f, t))) {
          (series.current[id as "MI" | "MD"] ??= []).push(m);
        }
      }
      let ev: Parameters<typeof transicion>[1] = { tipo: "tick", t };
      if (t - ultimoConteo > 0.3) {
        ultimoConteo = t;
        const total = (["MI", "MD"] as const).reduce(
          (s, id) =>
            s +
            detectarDescensos(
              (series.current[id] ?? []).map((m) => ({ t: m.t, alturas: m.alturas })),
              DEDOS,
            ).length,
          0,
        );
        if (total > eventos) {
          eventos = total;
          ev = { tipo: "actividad", t, eventos: total };
        }
      }
      setEstado((e) => (e ? transicion(e, ev, plan) : e));
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [estado?.fase]);

  // "Analizando": el núcleo corre en un Web Worker.
  useEffect(() => {
    if (estado?.fase !== "analizando") return;
    const trabajador = new Worker(new URL("./analisis.worker.ts", import.meta.url), {
      type: "module",
    });
    trabajador.onmessage = (e: MessageEvent<RespuestaAnalisis>) => {
      setRespuesta(e.data);
      trabajador.terminate();
    };
    const pedido: PedidoAnalisis = {
      series: series.current,
      calibracion: aPlano,
      rango,
      esperadas,
    };
    trabajador.postMessage(pedido);
    return () => trabajador.terminate();
  }, [estado?.fase, aPlano, rango, esperadas]);

  // Resultado listo: guardar el intento (solo números) por la bandeja de salida.
  useEffect(() => {
    if (!respuesta || estado?.fase !== "analizando" || !vista.detector) return;
    const detectadas = respuesta.notas.filter((n) => n.resultado.estado === "detectada").length;
    const pct = (100 * detectadas) / Math.max(1, respuesta.notas.length);
    const eventos: EventoResultado[] = respuesta.notas.map((n) => ({
      idx: n.idx,
      estado: "no-evaluable",
      motivo:
        n.resultado.estado === "detectada"
          ? "digitación pendiente de transcripción"
          : n.resultado.motivo,
      mano: n.mano,
      dedo: n.resultado.estado === "detectada" ? NUMERO_DEDO[n.resultado.dedo] : null,
      midi: n.midiEsperado,
      rasgos: {},
    }));
    const resultado = ResultadoIntento.parse({
      client_uuid: crypto.randomUUID(),
      version_ejercicio_id: contexto.ejercicio.version_vigente.id,
      tarea_id: contexto.tarea?.id ?? null,
      version_nucleo: VERSION_NUCLEO,
      version_modelo_mano: vista.detector.version,
      instrumento,
      manos: contexto.manos,
      clase_dispositivo: claseDispositivo(),
      modo: "V",
      modo_metronomo: null,
      tempo_elegido_bpm: tempo,
      estado: pct >= 70 && !estado.incompleta ? "evaluado" : "no_evaluable",
      motivo_no_evaluable:
        pct >= 70 && !estado.incompleta
          ? null
          : estado.incompleta
            ? "Ejecución incompleta"
            : "Menos del 70 % de las notas con evento visual",
      iniciado_en: new Date(Date.now() - (performance.now() - inicio.current)).toISOString(),
      duracion_ms: Math.round(performance.now() - inicio.current),
      pct_eventos_evaluables: Math.round(pct * 10) / 10,
      pct_digitacion_correcta: null,
      eventos,
    });
    const almacen = almacenIndexedDb();
    void encolar(almacen, resultado)
      .then(() => vaciar(almacen))
      .then(() => almacen.todas())
      .then((todas) => {
        const e = todas.find((x) => x.client_uuid === resultado.client_uuid);
        setGuardado(e?.estado === "guardado" ? "Guardado" : "Pendiente de guardar");
      });
  }, [respuesta]);

  if (!estado || estado.fase === "cancelado") {
    return (
      <>
        <h2>3. Prepárate</h2>
        {estado?.fase === "cancelado" && <p className="aviso">Intento cancelado: no se guardó.</p>}
        <div className="fila">
          <label>
            Tempo (♩ =)
            <input
              type="number"
              min={opciones.min}
              max={opciones.max}
              value={tempo}
              onChange={(e) =>
                setTempo(Math.min(opciones.max, Math.max(opciones.min, Number(e.target.value))))
              }
            />
          </label>
          <label>
            Instrumento
            <select
              value={instrumento}
              onChange={(e) => setInstrumento(e.target.value as typeof instrumento)}
            >
              <option value="no_declarado">Sin declarar</option>
              <option value="acustico">Piano acústico</option>
              <option value="digital">Piano digital</option>
              <option value="teclado">Teclado</option>
            </select>
          </label>
        </div>
        {lenta && <p className="aviso">{lenta}</p>}
        <PanelSemaforo semaforo={vista.semaforo} />
        <AvisoAvance restante={restante} accion="Empieza" />
      </>
    );
  }
  if (estado.fase === "conteo" || estado.fase === "tocando") {
    return (
      <>
        <h2 data-fase={estado.fase}>{estado.fase === "conteo" ? "Prepárate…" : "Tocando"}</h2>
        {estado.fase === "conteo" ? (
          <p className="conteo" aria-live="assertive">
            {pulso || "…"}
          </p>
        ) : (
          <p className="suave">
            Toca el ejercicio. Al terminar, quédate quieto: el análisis empieza solo.
          </p>
        )}
        <button
          type="button"
          className="secundario boton-grande"
          onClick={() => setEstado(transicion(estado, { tipo: "cancelar" }, plan))}
        >
          Cancelar
        </button>
      </>
    );
  }
  if (estado.fase === "no-evaluable") {
    return (
      <>
        <h2>No evaluable</h2>
        <p>{estado.motivo}</p>
        <button type="button" onClick={() => setEstado(null)}>
          Intentar de nuevo
        </button>
      </>
    );
  }
  return (
    <section aria-label="Resultado provisional">
      <h2 data-fase="analizando">{respuesta ? "Resultado provisional" : "Analizando…"}</h2>
      {respuesta && (
        <>
          <p className="suave">
            {estado.fase === "analizando" && estado.incompleta && "Ejecución incompleta. "}
            Análisis en {Math.round(respuesta.duracionAnalisisMs)} ms ·{" "}
            <span data-guardado={guardado ?? "guardando"}>{guardado ?? "Guardando…"}</span>
            {contexto.tarea && (
              <>
                {" "}
                · <Link to={`/tareas/${contexto.tarea.id}`}>Volver a la tarea</Link>
              </>
            )}
          </p>
          <table className="tabla" aria-label="Notas">
            <thead>
              <tr>
                <th>#</th>
                <th>Mano</th>
                <th>Nota esperada</th>
                <th>Tecla y dedo detectados</th>
                <th>Digitación</th>
              </tr>
            </thead>
            <tbody>
              {respuesta.notas.map((n) => (
                <tr key={n.idx} data-nota={n.resultado.estado}>
                  <td>{n.idx + 1}</td>
                  <td>{n.mano === "MI" ? "Izquierda" : "Derecha"}</td>
                  <td>{nombreNota(n.midiEsperado)}</td>
                  <td>
                    {n.resultado.estado === "detectada"
                      ? `${nombreNota(n.midiEsperado)} · ${n.resultado.dedo}`
                      : `No evaluable: ${n.resultado.motivo}`}
                  </td>
                  <td className="suave">No evaluable: pendiente de transcripción</td>
                </tr>
              ))}
            </tbody>
          </table>
          <button type="button" onClick={() => setEstado(null)}>
            Otro intento
          </button>
        </>
      )}
    </section>
  );
}

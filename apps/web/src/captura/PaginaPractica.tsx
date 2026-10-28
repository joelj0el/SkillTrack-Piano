import { Ejercicio, ResultadoIntento, Tarea, type EventoResultado } from "@skilltrack/contracts";
import {
  DEDOS,
  PUNTA,
  detectarAtaques,
  etiquetaTempo,
  evaluarAudio,
  medirAudio,
  opcionesTempo,
  programa,
  type SemaforoAudio,
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
import { programarClic, unir, useMicrofono, type Microfono } from "../audio/microfono.ts";
import { almacenIndexedDb, encolar, vaciar } from "../bandeja/bandeja.ts";
import { Cargado, NOMBRE_MANOS, useCarga } from "../componentes.tsx";
import {
  reducirTasa,
  type MuestraMano,
  type PedidoAnalisis,
  type RespuestaAnalisis,
} from "./analisis.ts";
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
  const [paso, setPaso] = useState<"encuadre" | "microfono" | "calibracion" | "ejecucion">(
    "encuadre",
  );
  const microfono = useMicrofono();
  const [soloVision, setSoloVision] = useState(false);
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
      <h1>
        {ejercicio.nombre} · {NOMBRE_MANOS[manos]}
      </h1>
      <p className="aviso" data-secuencia="provisional">
        Secuencia provisional, sin digitación: la escala de {ejercicio.tonalidad} en 2 octavas
        (subida y bajada{manos === "juntas" ? ", manos en octava paralela" : ""}), de{" "}
        {nombreNota(rango.min)} a {nombreNota(rango.max)}. La digitación se evalúa cuando la
        partitura esté transcrita.
      </p>
      <VistaCamara
        manosEsperadas={manosEsperadas}
        dibujar={dibujar}
        onToque={paso === "calibracion" ? tocar : undefined}
      >
        {(vista) =>
          paso === "encuadre" ? (
            <PasoEncuadre vista={vista} continuar={() => setPaso("microfono")} />
          ) : paso === "microfono" ? (
            <PasoMicrofono
              microfono={microfono}
              continuar={(sinAudio) => {
                setSoloVision(sinAudio);
                setPaso("calibracion");
              }}
            />
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
              microfono={microfono}
              soloVision={soloVision}
            />
          )
        }
      </VistaCamara>
    </>
  );
}

function PasoEncuadre({ vista, continuar }: { vista: Vista; continuar: () => void }) {
  const verde = vista.semaforo?.nivel === "verde";
  return (
    <>
      <h2>1. Coloca el teléfono</h2>
      <p className="suave">
        Detrás y por encima de ti, con el teclado horizontal y tus manos a la vista. La imagen no
        sale del teléfono.
      </p>
      <PanelSemaforo semaforo={vista.semaforo} />
      <button type="button" disabled={!verde || !vista.detector} onClick={continuar}>
        Continuar
      </button>
    </>
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

/** P-37: prueba de micrófono en dos tramos (silencio y tocando) con medidor en vivo. */
export function PasoMicrofono({
  microfono,
  continuar,
}: {
  microfono: Microfono;
  continuar: (soloVision: boolean) => void;
}) {
  const [fase, setFase] = useState<"listo" | "silencio" | "tocando" | "hecho">("listo");
  const [semaforo, setSemaforo] = useState<SemaforoAudio | null>(null);
  const { estado } = microfono;

  async function probar() {
    const espera = (ms: number) => new Promise((ok) => setTimeout(ok, ms));
    setFase("silencio");
    microfono.grabar();
    await espera(2000);
    const silencio = unir(microfono.detener());
    setFase("tocando");
    microfono.grabar();
    await espera(3000);
    const tocando = unir(microfono.detener());
    const tasa = estado.tipo === "activo" ? estado.tasa : 48000;
    setSemaforo(
      evaluarAudio(
        medirAudio(
          reducirTasa(silencio.muestras, tasa).muestras,
          reducirTasa(tocando.muestras, tasa).muestras,
        ),
      ),
    );
    setFase("hecho");
  }

  if (estado.tipo === "denegado" || estado.tipo === "error") {
    return (
      <section aria-labelledby="titulo-sin-micro">
        <h2 id="titulo-sin-micro">No podemos usar el micrófono</h2>
        <p>
          {estado.tipo === "denegado"
            ? "Para analizar notas y ritmo, permite el micrófono en los ajustes del sitio (Permisos → Micrófono)."
            : "El micrófono no está disponible en este dispositivo."}
        </p>
        <p className="aviso">
          Puedes continuar en <strong>modo solo visión</strong>: se analizan las manos y los dedos,
          pero las notas y el ritmo no se evalúan.
        </p>
        <div className="fila">
          <button type="button" onClick={() => continuar(true)}>
            Continuar en modo solo visión
          </button>
          <button type="button" className="secundario" onClick={microfono.reintentar}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  const nivel = Math.max(0, Math.min(100, ((microfono.nivelDb + 80) / 80) * 100));
  const ocupado = fase === "silencio" || fase === "tocando";
  return (
    <>
      <h2>2. Prueba de micrófono</h2>
      {estado.tipo === "activo" && !estado.audioSinProcesar && (
        <p className="aviso">
          Tu navegador no desactivó todo el procesamiento del micrófono; el resultado lo indicará.
        </p>
      )}
      <label>
        Nivel del micrófono ({Math.round(microfono.nivelDb)} dBFS)
        <meter min={0} max={100} value={nivel} data-nivel={Math.round(microfono.nivelDb)} />
      </label>
      {fase === "silencio" && <p className="aviso">Quédate en silencio unos segundos…</p>}
      {fase === "tocando" && <p className="aviso">Ahora toca unas notas del ejercicio…</p>}
      {semaforo && (
        <div
          className={`tarjeta semaforo semaforo-${semaforo.nivel}`}
          role="status"
          data-semaforo-audio={semaforo.nivel}
        >
          <strong>
            {
              {
                verde: "El sonido está bien",
                ambar: "Se puede mejorar",
                rojo: "Corrige el sonido",
              }[semaforo.nivel]
            }
          </strong>
          <ul className="lista">
            {semaforo.mensajes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      <div className="fila">
        <button
          type="button"
          disabled={estado.tipo !== "activo" || ocupado}
          onClick={() => void probar()}
        >
          {fase === "hecho" ? "Probar de nuevo" : "Probar el micrófono"}
        </button>
        <button
          type="button"
          className="secundario"
          disabled={semaforo?.nivel === "rojo" || fase !== "hecho"}
          onClick={() => continuar(false)}
        >
          Continuar
        </button>
      </div>
    </>
  );
}

function PasoEjecucion(props: {
  vista: Vista;
  contexto: Contexto;
  esperadas: NotaEsperada[];
  rango: { min: number; max: number };
  aPlano: Homografia;
  microfono: Microfono;
  soloVision: boolean;
}) {
  const { vista, contexto, esperadas, rango, aPlano, microfono, soloVision } = props;
  const opciones = opcionesTempo(
    contexto.tarea
      ? {
          tempoMin: contexto.tarea.tempo_min_bpm,
          tempoMax: contexto.tarea.tempo_max_bpm,
        }
      : null,
  );
  const [tempo, setTempo] = useState(contexto.tarea?.tempo_min_bpm ?? 60);
  const [metronomo, setMetronomo] = useState<"con" | "sin">("sin");
  const [instrumento, setInstrumento] = useState<
    "acustico" | "digital" | "teclado" | "no_declarado"
  >("no_declarado");
  const [estado, setEstado] = useState<Estado | null>(null);
  const [pulso, setPulso] = useState(0);
  const [latido, setLatido] = useState(false);
  const [respuesta, setRespuesta] = useState<RespuestaAnalisis | null>(null);
  const [guardado, setGuardado] = useState<string | null>(null);
  const series = useRef<Partial<Record<"MI" | "MD", MuestraMano[]>>>({});
  const inicio = useRef(0);
  const relojAudio = useRef<{ ctx: number; rel: number } | null>(null);
  const temporizadores = useRef<number[]>([]);
  const conAudio = !soloVision && microfono.estado.tipo === "activo";

  const porMano = contexto.manos === "juntas" ? esperadas.length / 2 : esperadas.length;
  const plan: Plan = {
    // Con audio, un evento por instante esperado (las dos manos en octava suenan juntas).
    eventosEsperados: conAudio ? porMano : esperadas.length,
    duracionEsperada: duracionEsperada(porMano, tempo),
  };

  function despues(ms: number, f: () => void) {
    temporizadores.current.push(window.setTimeout(f, ms));
  }

  function empezar() {
    series.current = {};
    setRespuesta(null);
    setGuardado(null);
    temporizadores.current.forEach(clearTimeout);
    temporizadores.current = [];
    inicio.current = performance.now();
    setEstado({ fase: "conteo", desde: 0 });
    const p = programa(tempo, metronomo, plan.duracionEsperada * 1.5);
    const ctx = microfono.contexto.current;
    if (ctx && conAudio) {
      const base = ctx.currentTime + 0.05;
      p.conteo.forEach((t, i) => programarClic(ctx, base + t, i === 0));
    }
    p.conteo.forEach((t, i) => despues(t * 1000 + 50, () => setPulso(i + 1)));
    // Con metrónomo: pulso visual mudo durante la ejecución.
    p.pulsosVisuales.forEach((t) =>
      despues(t * 1000 + 50, () => {
        setLatido(true);
        despues(120, () => setLatido(false));
      }),
    );
    despues(p.inicioMedicion * 1000 + 50, () => {
      setPulso(0);
      if (conAudio) {
        const ctxT = microfono.grabar();
        relojAudio.current = {
          ctx: ctxT,
          rel: (performance.now() - inicio.current) / 1000,
        };
      }
      setEstado((e) => (e ? transicion(e, { tipo: "fin-conteo", t: p.inicioMedicion }, plan) : e));
    });
  }

  useEffect(() => () => temporizadores.current.forEach(clearTimeout), []);

  // "Tocando": series visuales, ataques oídos y fin automático (PRM-15).
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
      if (t - ultimoConteo > 1) {
        ultimoConteo = t;
        let total: number;
        let ultimo: number;
        if (conAudio) {
          const { muestras } = unir(microfono.grabado());
          const tasa = microfono.estado.tipo === "activo" ? microfono.estado.tasa : 48000;
          const reducida = reducirTasa(muestras, tasa);
          const ataques = detectarAtaques(reducida.muestras, reducida.tasa);
          total = ataques.length;
          ultimo = (relojAudio.current?.rel ?? 0) + (ataques.at(-1) ?? 0);
        } else {
          total = (["MI", "MD"] as const).reduce(
            (s, id) =>
              s +
              detectarDescensos(
                (series.current[id] ?? []).map((m) => ({
                  t: m.t,
                  alturas: m.alturas,
                })),
                DEDOS,
              ).length,
            0,
          );
          ultimo = t;
        }
        if (total > eventos) {
          eventos = total;
          ev = { tipo: "actividad", t: ultimo, eventos: total };
        }
      }
      setEstado((e) => (e ? transicion(e, ev, plan) : e));
    };
    cuadro = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(cuadro);
  }, [estado?.fase]);

  // "Analizando": el núcleo corre en un Web Worker con la imagen y el sonido ya convertidos en
  // números dentro del teléfono.
  useEffect(() => {
    if (estado?.fase !== "analizando") return;
    let audio: PedidoAnalisis["audio"];
    if (conAudio && relojAudio.current) {
      const { muestras, t0 } = unir(microfono.detener());
      const tasa = microfono.estado.tipo === "activo" ? microfono.estado.tasa : 48000;
      audio = {
        muestras,
        tasa,
        t0: relojAudio.current.rel + (t0 - relojAudio.current.ctx),
      };
    }
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
      metronomo,
      tempoElegido: tempo,
      ...(audio ? { audio } : {}),
    };
    trabajador.postMessage(pedido, audio ? [audio.muestras.buffer] : []);
    return () => trabajador.terminate();
  }, [estado?.fase]);

  // Resultado listo: guardar el intento (solo números) por la bandeja de salida.
  useEffect(() => {
    if (!respuesta || estado?.fase !== "analizando" || !vista.detector) return;
    const acustico = respuesta.acustico;
    const evaluables = acustico
      ? acustico.notas.esperadas.filter((n) => n.estado !== "dudosa" && n.estado !== "faltante")
          .length / Math.max(1, acustico.notas.esperadas.length)
      : respuesta.notas.filter((n) => n.resultado.estado === "detectada").length /
        Math.max(1, respuesta.notas.length);
    const pct = Math.round(evaluables * 1000) / 10;
    const ok = pct >= 70 && !estado.incompleta;
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
      modo: acustico ? "VA" : "V",
      modo_metronomo: acustico ? metronomo : null,
      tempo_elegido_bpm: tempo,
      estado: ok ? "evaluado" : "no_evaluable",
      motivo_no_evaluable: ok
        ? null
        : estado.incompleta
          ? "Ejecución incompleta"
          : "Menos del 70 % de las notas evaluables",
      iniciado_en: new Date(Date.now() - (performance.now() - inicio.current)).toISOString(),
      duracion_ms: Math.round(performance.now() - inicio.current),
      pct_eventos_evaluables: pct,
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

  const lenta = etiquetaTempo(tempo, opciones);
  if (!estado || estado.fase === "cancelado") {
    return (
      <>
        <h2>4. Prepárate</h2>
        {estado?.fase === "cancelado" && <p className="aviso">Intento cancelado: no se guardó.</p>}
        {soloVision && (
          <p className="aviso">Modo solo visión: las notas y el ritmo no se evalúan.</p>
        )}
        <div className="fila">
          <label>
            Tempo (♩ =)
            <input
              type="number"
              min={opciones.min}
              max={opciones.max}
              step={1}
              value={tempo}
              onChange={(e) =>
                setTempo(Math.min(opciones.max, Math.max(opciones.min, Number(e.target.value))))
              }
            />
          </label>
          {!soloVision && (
            <label>
              Metrónomo
              <select
                value={metronomo}
                onChange={(e) => setMetronomo(e.target.value as "con" | "sin")}
              >
                <option value="sin">Sin metrónomo (solo conteo)</option>
                <option value="con">Con metrónomo (pulso visual)</option>
              </select>
            </label>
          )}
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
        <button type="button" onClick={empezar}>
          Empezar
        </button>
      </>
    );
  }
  if (estado.fase === "conteo" || estado.fase === "tocando") {
    return (
      <>
        <h2 data-fase={estado.fase}>{estado.fase === "conteo" ? "Prepárate…" : "Tocando"}</h2>
        {estado.fase === "conteo" ? (
          <p className="conteo" aria-live="assertive" data-pulso={pulso}>
            {pulso || "…"}
          </p>
        ) : (
          <>
            {metronomo === "con" && !soloVision && (
              <p className={latido ? "pulso-visual activo" : "pulso-visual"} aria-hidden="true">
                ●
              </p>
            )}
            <p className="suave">
              Toca el ejercicio. Al terminar, quédate quieto: el análisis empieza solo.
            </p>
          </>
        )}
        <button
          type="button"
          className="secundario boton-grande"
          onClick={() => {
            temporizadores.current.forEach(clearTimeout);
            microfono.detener();
            setEstado(transicion(estado, { tipo: "cancelar" }, plan));
          }}
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
    <Resultado
      estado={estado}
      respuesta={respuesta}
      guardado={guardado}
      contexto={contexto}
      esperadas={esperadas}
      otro={() => setEstado(null)}
    />
  );
}

const SIMBOLO = {
  correcta: "✓",
  incorrecta: "✗",
  dudosa: "dudosa",
  faltante: "faltante",
} as const;
const ESTADO_TEMPO = {
  estable: "Tempo estable",
  aceleraste: "Cambio de tempo: aceleraste",
  frenaste: "Cambio de tempo: frenaste",
} as const;

function Resultado(props: {
  estado: Estado;
  respuesta: RespuestaAnalisis | null;
  guardado: string | null;
  contexto: Contexto;
  esperadas: NotaEsperada[];
  otro: () => void;
}) {
  const { estado, respuesta, guardado, contexto, esperadas } = props;
  if (!respuesta) return <h2 data-fase="analizando">Analizando…</h2>;
  const acustico = respuesta.acustico;
  const mano = esperadas.some((n) => n.mano === "MD") ? "MD" : "MI";
  const porInstante = esperadas.filter((n) => n.mano === mano);
  const tempo = acustico?.tempo ?? null;
  const tarea = contexto.tarea;
  const medido = tempo ? Math.round(tempo.tempoInicial) : null;
  const fueraDeRango =
    tarea && medido !== null && (medido < tarea.tempo_min_bpm || medido > tarea.tempo_max_bpm)
      ? `Tocaste a ♩≈${medido}; tu tarea pide ${tarea.tempo_min_bpm}–${tarea.tempo_max_bpm}`
      : null;
  return (
    <section aria-label="Resultado provisional">
      <h2 data-fase="resultado">Resultado provisional</h2>
      <p className="suave">
        {estado.fase === "analizando" && estado.incompleta && "Ejecución incompleta. "}
        Análisis en {Math.round(respuesta.duracionAnalisisMs)} ms ·{" "}
        <span data-guardado={guardado ?? "guardando"}>{guardado ?? "Guardando…"}</span>
        {tarea && (
          <>
            {" "}
            · <Link to={`/tareas/${tarea.id}`}>Volver a la tarea</Link>
          </>
        )}
      </p>
      {acustico ? (
        <>
          <div className="tarjeta" data-tempo={tempo?.estado ?? "sin-datos"}>
            <h3>Ritmo</h3>
            {tempo ? (
              <>
                <p>
                  Tempo inicial ♩≈{Math.round(tempo.tempoInicial)} · final ♩≈
                  {Math.round(tempo.tempoFinal)} ({tempo.cambioPct > 0 ? "+" : ""}
                  {tempo.cambioPct.toFixed(1)} %): <strong>{ESTADO_TEMPO[tempo.estado]}</strong>
                </p>
                <p className="suave">
                  Referencia:{" "}
                  {tempo.referencia === "tempo_elegido"
                    ? `tempo elegido (♩ = ${Math.round(tempo.tempoReferencia)})`
                    : "tempo de los primeros 4 pulsos"}
                  {" · "}Notas irregulares (tropiezo o pausa): {tempo.tropiezos.length}
                </p>
                {fueraDeRango && (
                  <p className="aviso">{fueraDeRango}. Este intento no cuenta para la tarea.</p>
                )}
              </>
            ) : (
              <p>Muy pocas notas oídas para estimar el tempo.</p>
            )}
          </div>
          <table className="tabla" aria-label="Notas">
            <thead>
              <tr>
                <th>#</th>
                <th>Nota esperada</th>
                <th>Oída</th>
                <th>Mano y dedo (visión)</th>
              </tr>
            </thead>
            <tbody>
              {acustico.notas.esperadas.map((n, i) => {
                const indiceAtaque =
                  "t" in n ? acustico.ataques.findIndex((t) => Math.abs(t - n.t) < 1e-6) : -1;
                const fusion = indiceAtaque >= 0 ? acustico.fusion[indiceAtaque] : undefined;
                const irregular = tempo?.tropiezos.includes(indiceAtaque) ?? false;
                return (
                  <tr key={i} data-nota-audio={n.estado}>
                    <td>{i + 1}</td>
                    <td>{nombreNota(porInstante[i]!.midi)}</td>
                    <td>
                      {SIMBOLO[n.estado]}
                      {n.estado === "incorrecta" &&
                        ` (oída: ${nombreNota(60 + n.claseOida).slice(0, -1)})`}
                      {irregular && " · tropiezo o pausa"}
                    </td>
                    <td>
                      {fusion?.modalidad === "VA"
                        ? `${fusion.mano === "MI" ? "Izquierda" : "Derecha"} · ${fusion.dedo}`
                        : n.estado === "faltante"
                          ? "—"
                          : "sin evento visual"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="suave" data-extras={acustico.notas.extras.length}>
            Notas extra: {acustico.notas.extras.length} · Digitación: no evaluable (pendiente de
            transcripción).
          </p>
        </>
      ) : (
        <p className="aviso">Modo solo visión: las notas y el ritmo no fueron evaluados.</p>
      )}
      <details>
        <summary>Detalle visual por mano (tecla y dedo detectados)</summary>
        <table className="tabla" aria-label="Notas por mano">
          <thead>
            <tr>
              <th>#</th>
              <th>Mano</th>
              <th>Nota esperada</th>
              <th>Tecla y dedo detectados</th>
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
              </tr>
            ))}
          </tbody>
        </table>
      </details>
      <button type="button" onClick={props.otro}>
        Otro intento
      </button>
    </section>
  );
}

/** P-37 como pantalla propia: probar el micrófono antes de practicar. */
export function PaginaMicrofono() {
  const microfono = useMicrofono();
  const [listo, setListo] = useState<"audio" | "vision" | null>(null);
  return (
    <section>
      <h1>Prueba de micrófono</h1>
      {listo ? (
        <p className="aviso" data-continuar={listo}>
          {listo === "audio"
            ? "Micrófono listo. Abre una tarea y toca Practicar."
            : "Seguirás en modo solo visión: las notas y el ritmo no se evaluarán."}
        </p>
      ) : (
        <PasoMicrofono microfono={microfono} continuar={(v) => setListo(v ? "vision" : "audio")} />
      )}
    </section>
  );
}

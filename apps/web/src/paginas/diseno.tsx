import type { Ejercicio } from "@skilltrack/contracts";
import { secuenciaEscala, type RespuestaAnalisis } from "@skilltrack/core";
import { Check, CircleHelp, Hand, Music, Plus, Timer, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Navigate, useParams } from "react-router";
import type { Microfono } from "../audio/microfono.ts";
import {
  PasoCalibracion,
  PasoEjecucion,
  PasoEncuadre,
  PasoMicrofono,
  Resultado,
  VistaConteo,
  VistaTocando,
} from "../captura/PaginaPractica.tsx";
import type { Estado } from "../captura/estado.ts";
import { MarcoPractica, type Vista } from "../captura/Practica.tsx";
import {
  Boton,
  Chip,
  Dialogo,
  Esqueleto,
  EstadoVista,
  PaginaCabecera,
  useAviso,
} from "../ui/base.tsx";
import { TecladoEjemplo } from "../ui/ilustraciones.tsx";

const COLORES = [
  "fondo",
  "superficie",
  "superficie-2",
  "texto",
  "texto-suave",
  "borde",
  "acento",
  "peligro",
  "correcto",
  "nota",
  "tiempo",
  "mano",
  "no-evaluable",
];
const TEXTOS = ["xs", "sm", "md", "lg", "xl", "2xl"];
const PIXELES = { xs: 13, sm: 15, md: 17, lg: 20, xl: 28, "2xl": 34 } as const;

function Muestras() {
  return (
    <>
      <h2>Color</h2>
      <div className="muestra-rejilla">
        {COLORES.map((c) => (
          <div key={c} className="muestra-color">
            <span style={{ background: `var(--color-${c})` }} />
            <span>{c}</span>
          </div>
        ))}
      </div>
      <h2>Tipografía</h2>
      <div className="tarjeta">
        {TEXTOS.map((t) => (
          <p key={t} style={{ fontSize: `var(--texto-${t})` }}>
            {PIXELES[t as keyof typeof PIXELES]} px · Escala de Do mayor
          </p>
        ))}
      </div>
      <h2>Sombras y radios</h2>
      <div className="muestra-rejilla">
        {[1, 2, 3].map((n) => (
          <div key={n} className="tarjeta" style={{ boxShadow: `var(--sombra-${n})` }}>
            Sombra {n}
          </div>
        ))}
        {["sm", "md", "lg"].map((r) => (
          <div key={r} className="tarjeta" style={{ borderRadius: `var(--radio-${r})` }}>
            Radio {r}
          </div>
        ))}
      </div>
    </>
  );
}

function Controles() {
  const [dialogo, setDialogo] = useState(false);
  const avisar = useAviso();
  return (
    <>
      <h2>Botones</h2>
      <div className="muestra-fila">
        <Boton icono={Plus}>Primario</Boton>
        <Boton variante="secundario">Secundario</Boton>
        <Boton variante="peligro">Peligro</Boton>
        <Boton disabled>Deshabilitado</Boton>
        <Boton cargando>Cargando</Boton>
      </div>
      <h2>Campos</h2>
      <form className="tarjeta" aria-label="Ejemplo de campos" onSubmit={(e) => e.preventDefault()}>
        <label>
          Campo
          <input placeholder="Escribe aquí" />
        </label>
        <label>
          Campo con error
          <input aria-invalid="true" defaultValue="Valor no válido" />
        </label>
        <label>
          Selector
          <select defaultValue="1">
            <option value="1">Mano derecha</option>
            <option value="2">Mano izquierda</option>
          </select>
        </label>
        <label>
          Fecha
          <input type="date" defaultValue="2026-11-18" />
        </label>
      </form>
      <h2>Estados semánticos</h2>
      <div className="muestra-fila">
        <Chip tono="correcto" icono={Check}>
          Correcto
        </Chip>
        <Chip tono="nota" icono={Music}>
          Nota
        </Chip>
        <Chip tono="tiempo" icono={Timer}>
          Tiempo
        </Chip>
        <Chip tono="mano" icono={Hand}>
          Mano y dedo
        </Chip>
        <Chip tono="no-evaluable" icono={CircleHelp}>
          No evaluable
        </Chip>
      </div>
      <h2>Mensajes</h2>
      <p className="aviso">Aviso informativo.</p>
      <p className="error">Mensaje de error.</p>
      <div className="muestra-fila">
        <Boton variante="secundario" icono={TriangleAlert} onClick={() => setDialogo(true)}>
          Abrir diálogo
        </Boton>
        <Boton variante="secundario" icono={Check} onClick={() => avisar("Cambios guardados")}>
          Mostrar aviso
        </Boton>
      </div>
      <Dialogo
        abierto={dialogo}
        titulo="Ejemplo de diálogo"
        alCerrar={() => setDialogo(false)}
        acciones={<Boton onClick={() => setDialogo(false)}>Cerrar</Boton>}
      >
        <p>Un diálogo pide una sola decisión.</p>
      </Dialogo>
    </>
  );
}

const ESTADOS = [
  { tipo: "vacio", titulo: "Vacío" },
  { tipo: "error", titulo: "Error" },
  { tipo: "sin-conexion", titulo: "Sin conexión" },
  { tipo: "no-evaluable", titulo: "No evaluable" },
] as const;

const VISTAS = [
  "encuadre",
  "microfono",
  "calibracion",
  "preparacion",
  "conteo",
  "ejecucion",
  "analizando",
  "resultado",
  "no-evaluable",
];

/** Página /design: todos los tokens y componentes en funcionamiento. */
export function Diseno() {
  return (
    <section>
      <PaginaCabecera titulo="Sistema de diseño" detalle="Marfil y ébano" />
      <Muestras />
      <Controles />
      <h2>Tarjeta y lista</h2>
      <ul className="lista">
        {["Primera", "Segunda", "Tercera"].map((t) => (
          <li key={t} className="tarjeta">
            {t}
          </li>
        ))}
      </ul>
      <h2>Esqueleto de carga</h2>
      <Esqueleto tarjetas={1} />
      <h2>Estados de pantalla</h2>
      {ESTADOS.map((e) => (
        <EstadoVista key={e.tipo} tipo={e.tipo} titulo={e.titulo}>
          <p>Texto de ejemplo para este estado.</p>
        </EstadoVista>
      ))}
      <h2>Pasos de la práctica</h2>
      <ul>
        {VISTAS.map((v) => (
          <li key={v}>
            <a href={`/design/vista/${v}`}>{v}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}

const NULO = { current: null };
const ejemploVista = (nivel: "verde" | "ambar"): Vista => ({
  fotograma: NULO,
  video: NULO,
  detector: null,
  semaforo: {
    nivel,
    motivos:
      nivel === "ambar"
        ? [
            {
              codigo: "sin-manos",
              gravedad: "ambar",
              texto: "No se ven tus manos: colócalas sobre el teclado.",
            },
          ]
        : [],
  },
});
const MICROFONO = {
  estado: { tipo: "activo", tasa: 48000, audioSinProcesar: true },
  nivelDb: -24,
  contexto: NULO,
  grabar: () => 0,
  detener: () => [],
  grabado: () => [],
  reintentar: () => undefined,
} as unknown as Microfono;
const ESPERADAS = secuenciaEscala("Do mayor", "MD").slice(0, 4);
const CONTEXTO = {
  ejercicio: { nombre: "Escala de Do mayor", tonalidad: "Do mayor" } as Ejercicio,
  manos: "MD" as const,
  tarea: null,
  artefactos: { referencia: null, reglas: null },
};
const RESPUESTA = {
  visuales: [],
  duracionAnalisisMs: 12,
  notas: ESPERADAS.map((n) => ({
    idx: n.idx,
    mano: n.mano,
    midiEsperado: n.midi,
    resultado: { estado: "detectada", dedo: "indice", t: n.idx },
  })),
  acustico: {
    ataques: [0, 1, 2],
    fusion: [],
    tempo: {
      tempoInicial: 60,
      tempoFinal: 62,
      tempoMedido: 61,
      cambioPct: 3.3,
      estado: "estable",
      referencia: "tempo_elegido",
      tempoReferencia: 60,
      tropiezos: [],
    },
    notas: {
      extras: [],
      esperadas: [
        { estado: "correcta", t: 0 },
        { estado: "incorrecta", t: 1, claseOida: 4 },
        { estado: "dudosa", t: 2 },
        { estado: "faltante" },
      ],
    },
  },
} as unknown as RespuestaAnalisis;
const ANALIZANDO = { fase: "analizando", incompleta: false } as unknown as Estado;

function panelDe(nombre: string) {
  const sinAccion = () => undefined;
  switch (nombre) {
    case "encuadre":
      return <PasoEncuadre vista={ejemploVista("ambar")} continuar={sinAccion} />;
    case "microfono":
      return <PasoMicrofono microfono={MICROFONO} continuar={sinAccion} />;
    case "calibracion":
      return (
        <PasoCalibracion
          vista={ejemploVista("verde")}
          modelo={{ primeraBlanca: 60, ultimaBlanca: 84, blancas: 15, teclas: [] }}
          rango={{ min: 60, max: 84 }}
          toques={[]}
          aPlano={null}
          confirmada={false}
          repetir={sinAccion}
          usarGuardada={sinAccion}
          confirmar={sinAccion}
        />
      );
    case "preparacion":
      return (
        <PasoEjecucion
          vista={ejemploVista("ambar")}
          contexto={CONTEXTO}
          esperadas={ESPERADAS}
          secuencia="provisional"
          rango={{ min: 60, max: 84 }}
          aPlano={[1, 0, 0, 0, 1, 0, 0, 0, 1]}
          microfono={MICROFONO}
          soloVision={false}
        />
      );
    case "conteo":
      return (
        <>
          <h2>Prepárate…</h2>
          <VistaConteo pulso={2} tempo={60} />
        </>
      );
    case "ejecucion":
      return (
        <>
          <h2>Tocando</h2>
          <VistaTocando latido conMetronomo />
          <Boton variante="secundario" className="boton-grande">
            Cancelar
          </Boton>
        </>
      );
    case "analizando":
    case "resultado":
      return (
        <Resultado
          estado={ANALIZANDO}
          respuesta={nombre === "resultado" ? RESPUESTA : null}
          guardado="Guardado"
          contexto={CONTEXTO}
          esperadas={ESPERADAS}
          otro={sinAccion}
        />
      );
    case "no-evaluable":
      return (
        <EstadoVista tipo="no-evaluable" titulo="No evaluable">
          <p>Se perdieron las manos durante gran parte de la ejecución.</p>
        </EstadoVista>
      );
    default:
      return null;
  }
}

/** Un paso de la práctica con datos de ejemplo, sin cámara ni micrófono. */
export function VistaEjemplo() {
  const { nombre = "" } = useParams();
  if (!VISTAS.includes(nombre)) return <Navigate to="/design" replace />;
  return (
    <MarcoPractica
      titulo="Ejemplo con datos ficticios"
      volverA="/design"
      escena={
        <div className="muestra-escena">
          <TecladoEjemplo />
        </div>
      }
    >
      {panelDe(nombre)}
    </MarcoPractica>
  );
}

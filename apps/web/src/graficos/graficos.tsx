import type { CalificacionVariable } from "@skilltrack/contracts";
import { PRM_22 } from "@skilltrack/core";
import { CircleCheck, CircleHelp, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { DesfaseDeAtaque } from "./datos.ts";

/**
 * Gráficos en SVG propio (sin biblioteca). Cada uno tiene título, texto alternativo y una tabla
 * con los mismos datos; ninguno depende solo del color: el nivel va escrito con su icono, y la
 * posición respecto de la franja o de los umbrales se ve en la geometría.
 */

type Nivel = CalificacionVariable["nivel"];

export const NIVEL_GRAFICO: Record<Nivel, { texto: string; icono: LucideIcon }> = {
  logrado: { texto: "Logrado", icono: CircleCheck },
  "en-desarrollo": { texto: "En desarrollo", icono: TrendingUp },
  "por-mejorar": { texto: "Por mejorar", icono: TriangleAlert },
  "no-evaluado": { texto: "No evaluado", icono: CircleHelp },
};

/** Marco común: título visible, el gráfico y la tabla equivalente plegada. */
export function Figura({
  titulo,
  nota,
  tabla,
  children,
  ...resto
}: {
  titulo: string;
  nota?: ReactNode;
  tabla?: ReactNode;
  children: ReactNode;
} & Record<`data-${string}`, string | number | undefined>) {
  // La figcaption da el nombre accesible de la figura.
  return (
    <figure className="grafico" {...resto}>
      <figcaption className="grafico-titulo">{titulo}</figcaption>
      {children}
      {nota && <p className="suave grafico-nota">{nota}</p>}
      {tabla && (
        <details className="grafico-tabla">
          <summary>Ver los datos en una tabla</summary>
          {tabla}
        </details>
      )}
    </figure>
  );
}

/** Tabla simple para la vista equivalente de un gráfico. */
export function TablaDatos({
  titulo,
  columnas,
  filas,
}: {
  titulo: string;
  columnas: string[];
  filas: { clave: string; celdas: ReactNode[] }[];
}) {
  return (
    <div className="tabla-contenedor" tabIndex={0} role="region" aria-label={titulo}>
      <table className="tabla" aria-label={titulo}>
        <thead>
          <tr>
            {columnas.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave}>
              {f.celdas.map((c, i) => (i === 0 ? <th key={i}>{c}</th> : <td key={i}>{c}</td>))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const redondearArriba = (x: number, paso: number) => Math.max(paso, Math.ceil(x / paso) * paso);

/**
 * Línea de tiempo de los ataques: una barra por nota, hacia arriba si llegó tarde y hacia abajo
 * si se adelantó, sobre la franja de tolerancia de cada nota.
 */
export function GraficoDesfase({
  puntos,
  etiqueta,
}: {
  puntos: DesfaseDeAtaque[];
  etiqueta: (idx: number) => string;
}) {
  const medidos = puntos.filter((p) => p.ms !== null);
  const tope = redondearArriba(
    Math.max(0, ...medidos.flatMap((p) => [Math.abs(p.ms!), p.tolerancia ?? 0])),
    50,
  );
  const paso = 16;
  const margen = { izq: 44, der: 8, arr: 12, aba: 22 };
  const alto = 140;
  const ancho = margen.izq + margen.der + Math.max(puntos.length, 8) * paso;
  const y = (ms: number) => margen.arr + ((tope - ms) / (2 * tope)) * alto;
  const x = (i: number) => margen.izq + i * paso;
  const cada = Math.ceil(puntos.length / 16);
  const fuera = medidos.filter((p) => !p.dentro).length;
  const alt = medidos.length
    ? `${medidos.length} ataques medidos; ${medidos.length - fuera} dentro de la tolerancia y ${fuera} fuera. Escala de −${tope} a +${tope} ms.`
    : "Sin ataques medibles en este intento.";
  return (
    <svg
      className="grafico-svg"
      viewBox={`0 0 ${ancho} ${alto + margen.arr + margen.aba}`}
      role="img"
      aria-label={alt}
      data-grafico="desfase"
    >
      <title>{alt}</title>
      {puntos.map((p, i) =>
        p.tolerancia === null ? null : (
          <rect
            key={`f${p.idx}`}
            className="grafico-franja"
            x={x(i)}
            width={paso}
            y={y(p.tolerancia)}
            height={y(-p.tolerancia) - y(p.tolerancia)}
          />
        ),
      )}
      <line className="grafico-eje" x1={margen.izq} x2={ancho - margen.der} y1={y(0)} y2={y(0)} />
      <text className="grafico-texto" x={margen.izq - 4} y={y(tope) + 4} textAnchor="end">
        +{tope}
      </text>
      <text className="grafico-texto" x={margen.izq - 4} y={y(0) + 4} textAnchor="end">
        0
      </text>
      <text className="grafico-texto" x={margen.izq - 4} y={y(-tope)} textAnchor="end">
        −{tope}
      </text>
      {puntos.map((p, i) => {
        const cx = x(i) + paso / 2;
        return (
          <g key={p.idx} data-idx={p.idx} data-dentro={p.dentro === null ? "" : String(p.dentro)}>
            {p.ms === null ? (
              <circle className="grafico-sin-dato" cx={cx} cy={y(0)} r={2} />
            ) : (
              <rect
                className={p.dentro ? "grafico-barra" : "grafico-barra fuera"}
                x={cx - 4}
                width={8}
                y={Math.min(y(p.ms), y(0))}
                height={Math.max(1, Math.abs(y(p.ms) - y(0)))}
                rx={2}
              >
                <title>
                  {`${etiqueta(p.idx)}: ${p.ms > 0 ? "+" : ""}${p.ms} ms (${p.dentro ? "dentro" : "fuera"} de ±${p.tolerancia} ms)`}
                </title>
              </rect>
            )}
            {i % cada === 0 && (
              <text
                className="grafico-texto"
                x={cx}
                y={alto + margen.arr + margen.aba - 4}
                textAnchor="middle"
              >
                {p.idx + 1}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/** Barra horizontal 0–100 con los umbrales de PRM-22 marcados. */
function BarraPct({ pct, clase }: { pct: number | null; clase: string }) {
  return (
    <svg
      className="grafico-barra-pct"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect className="grafico-pista" width={100} height={10} rx={2} />
      {pct !== null && <rect className={clase} width={pct} height={10} rx={2} />}
      {[PRM_22.enDesarrollo, PRM_22.logrado].map((u) => (
        <line key={u} className="grafico-umbral" x1={u} x2={u} y1={0} y2={10} />
      ))}
    </svg>
  );
}

/** Calificación por variable: barra con el %, el nivel escrito con su icono y, si falta, el motivo. */
export function BarrasNivel({
  filas,
}: {
  filas: {
    clase: string;
    nombre: string;
    nivel: Nivel;
    pct: number | null;
    motivo?: string | undefined;
  }[];
}) {
  return (
    <ul className="barras" data-grafico="niveles">
      {filas.map((f) => {
        const { texto, icono: Icono } = NIVEL_GRAFICO[f.nivel];
        return (
          <li key={f.clase} className="barras-fila" data-clase={f.clase} data-nivel={f.nivel}>
            <span className="barras-etiqueta">{f.nombre}</span>
            <BarraPct pct={f.pct} clase={`grafico-relleno nivel-${f.nivel}`} />
            <span className={`barras-valor nivel-${f.nivel}`}>
              <Icono aria-hidden="true" />
              {f.pct === null ? texto : `${f.pct} % · ${texto}`}
            </span>
            {f.pct === null && f.motivo && (
              <span className="barras-motivo suave">Motivo: {f.motivo}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Conteo en barras: "en n de total intentos". */
export function BarrasConteo({
  filas,
  total,
}: {
  filas: { clave: string; nombre: string; n: number }[];
  total: number;
}) {
  return (
    <ul className="barras" data-grafico="conteo">
      {filas.map((f) => (
        <li key={f.clave} className="barras-fila" data-clase={f.clave} data-intentos={f.n}>
          <span className="barras-etiqueta">{f.nombre}</span>
          <BarraConteo n={f.n} total={total} />
          <span className="barras-valor">
            En {f.n} de {total} {total === 1 ? "intento" : "intentos"}
          </span>
        </li>
      ))}
    </ul>
  );
}

function BarraConteo({ n, total }: { n: number; total: number }) {
  return (
    <svg
      className="grafico-barra-pct"
      viewBox="0 0 100 10"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <rect className="grafico-pista" width={100} height={10} rx={2} />
      <rect className="grafico-relleno" width={total ? (100 * n) / total : 0} height={10} rx={2} />
    </svg>
  );
}

/**
 * Minigráfico de línea. Los huecos (null) cortan la línea; el último punto va resaltado.
 * `umbrales` dibuja líneas de referencia punteadas (p. ej. los de PRM-22).
 */
export function Minilinea({
  valores,
  max,
  alt,
  umbrales = [],
}: {
  valores: (number | null)[];
  max: number;
  alt: string;
  umbrales?: number[];
}) {
  const ancho = 120;
  const alto = 36;
  const m = 4;
  const x = (i: number) =>
    m + (valores.length > 1 ? (i * (ancho - 2 * m)) / (valores.length - 1) : (ancho - 2 * m) / 2);
  const y = (v: number) => alto - m - (Math.min(v, max) / (max || 1)) * (alto - 2 * m);
  const tramos: string[][] = [];
  let actual: string[] = [];
  valores.forEach((v, i) => {
    if (v === null) {
      if (actual.length) tramos.push(actual);
      actual = [];
    } else actual.push(`${x(i)},${y(v)}`);
  });
  if (actual.length) tramos.push(actual);
  const ultimo = valores.findLastIndex((v) => v !== null);
  return (
    <svg className="minilinea" viewBox={`0 0 ${ancho} ${alto}`} role="img" aria-label={alt}>
      <title>{alt}</title>
      {umbrales.map((u) => (
        <line key={u} className="grafico-umbral" x1={m} x2={ancho - m} y1={y(u)} y2={y(u)} />
      ))}
      {tramos.map((t) =>
        t.length === 1 ? null : (
          <polyline key={t.join(" ")} className="minilinea-trazo" points={t.join(" ")} />
        ),
      )}
      {valores.map((v, i) =>
        v === null ? null : (
          <circle
            key={i}
            className={i === ultimo ? "minilinea-punto ultimo" : "minilinea-punto"}
            cx={x(i)}
            cy={y(v)}
            r={i === ultimo ? 3 : 2}
          />
        ),
      )}
    </svg>
  );
}

/** Una línea pequeña por variable (múltiplos pequeños: el nombre identifica cada serie). */
export function LineasPorVariable({
  series,
  sufijo = "",
}: {
  series: { clase: string; nombre: string; valores: (number | null)[]; ultimoTexto: string }[];
  sufijo?: string;
}) {
  return (
    <ul className="lineas-variables" data-grafico="lineas">
      {series.map((s) => {
        const conDato = s.valores.filter((v) => v !== null) as number[];
        const alt = conDato.length
          ? `${s.nombre}${sufijo}: ${conDato.map((v) => `${v} %`).join(", ")}.`
          : `${s.nombre}${sufijo}: sin datos.`;
        return (
          <li key={s.clase} className="linea-variable" data-clase={s.clase}>
            <span className="linea-variable-nombre">{s.nombre}</span>
            <Minilinea
              valores={s.valores}
              max={100}
              alt={alt}
              umbrales={[PRM_22.enDesarrollo, PRM_22.logrado]}
            />
            <span className="suave linea-variable-ultimo">{s.ultimoTexto}</span>
          </li>
        );
      })}
    </ul>
  );
}

export const NOTA_UMBRALES = `Las líneas punteadas marcan ${PRM_22.enDesarrollo} % (En desarrollo) y ${PRM_22.logrado} % (Logrado).`;

/** Minigráfico de una tarjeta de resumen, con su tabla para lectores de pantalla. */
export function MiniTendencia({
  titulo,
  serie,
}: {
  titulo: string;
  serie: { desde: string; valor: number }[];
}) {
  const alt = `${titulo}: ${serie.map((p) => p.valor).join(", ")}.`;
  return (
    <span className="mini-tendencia" data-grafico="mini">
      <Minilinea
        valores={serie.map((p) => p.valor)}
        max={Math.max(1, ...serie.map((p) => p.valor))}
        alt={alt}
      />
      <div className="visualmente-oculto">
        <table>
          <caption>{titulo}</caption>
          <thead>
            <tr>
              <th>Semana del</th>
              <th>Intentos</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((p) => (
              <tr key={p.desde}>
                <td>{p.desde}</td>
                <td>{p.valor}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </span>
  );
}

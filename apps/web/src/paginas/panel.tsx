import {
  AvanceTarea,
  EstudianteResumen,
  IntentoGuardado,
  MiGrupo,
  MiProgreso,
  Tarea,
} from "@skilltrack/contracts";
import { CLASES, type Clase } from "@skilltrack/core";
import {
  BookOpen,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  Music,
  Play,
  Repeat,
  TableProperties,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { z } from "zod";
import { pedir } from "../api.ts";
import { Cargado, NOMBRE_MANOS, fechaLegible, useCarga } from "../componentes.tsx";
import { NOMBRE_NIVEL, NOMBRE_VARIABLE } from "../captura/resultados.ts";
import { useSesion } from "../sesion.tsx";
import { EnlaceBoton, EstadoVista } from "../ui/base.tsx";
import { Portada, SeccionCabecera, TarjetaResumen } from "../ui/portada.tsx";
import { filasDeProgreso, tendencia } from "./tableros.tsx";

/**
 * Paneles de inicio (diseño v2). Solo datos que ya existen: tareas, repeticiones de hoy,
 * intentos de la semana y la calificación por variable del último intento con su tendencia
 * semanal. Sin estrellas, rachas, niveles ni porcentajes globales.
 */

const PENDIENTES = new Set<Tarea["estado"]>(["Asignada", "En práctica", "Vencida"]);

/** Lunes 00:00 (hora local) de la semana de `fecha`. */
export function inicioDeSemana(fecha: Date): Date {
  const d = new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Intentos de esta semana y de la anterior (desde el lunes, hora local). */
export function intentosPorSemana(
  intentos: readonly Pick<IntentoGuardado, "iniciado_en">[],
  ahora: Date,
): { esta: number; anterior: number } {
  const lunes = inicioDeSemana(ahora).getTime();
  const lunesAnterior = lunes - 7 * 86_400_000;
  let esta = 0;
  let anterior = 0;
  for (const i of intentos) {
    const t = new Date(i.iniciado_en).getTime();
    if (t >= lunes) esta++;
    else if (t >= lunesAnterior) anterior++;
  }
  return { esta, anterior };
}

export function cambioSemanal({ esta, anterior }: { esta: number; anterior: number }): string {
  const d = esta - anterior;
  if (d === 0) return "igual que la semana anterior";
  return `${d > 0 ? "+" : "−"}${Math.abs(d)} frente a la semana anterior`;
}

/** Primer nombre, sin títulos abreviados ("Prof.", "Lic."). */
export const primerNombre = (nombre: string) =>
  nombre
    .trim()
    .split(/\s+/)
    .find((p) => !p.endsWith(".")) ?? nombre;

function Saludo({ frase, accion }: { frase: string; accion: ReactNode }) {
  const { estado } = useSesion();
  const nombre = estado.tipo === "activo" ? primerNombre(estado.usuario.nombre_visible) : "";
  return <Portada titulo={`¡Hola, ${nombre}!`} frase={<p>{frase}</p>} accion={accion} />;
}

function UltimaCalificacion({
  intentos,
  progreso,
}: {
  intentos: IntentoGuardado[];
  progreso: MiProgreso;
}) {
  const ultimo = intentos.find((i) => i.estado === "evaluado" && i.calificacion);
  if (!ultimo) {
    return (
      <p className="suave">
        Cuando tengas un intento evaluado, aquí verás cómo te fue en cada variable.
      </p>
    );
  }
  const { filas } = filasDeProgreso(progreso.semanas);
  const [actual, previa] = [filas.at(-1), filas.at(-2)];
  return (
    <ul className="calificaciones" aria-label="Calificación del último intento">
      {CLASES.map((c: Clase) => {
        const nivel = ultimo.calificacion!.find((x) => x.clase === c)?.nivel ?? "no-evaluado";
        const cambio = tendencia(actual?.pct[c], previa?.pct[c]);
        return (
          <li key={c} className="calificacion vidrio" data-clase={c} data-nivel={nivel}>
            <span className="calificacion-variable">{NOMBRE_VARIABLE[c]}</span>
            <span className="calificacion-nivel">{NOMBRE_NIVEL[nivel]}</span>
            <span className="suave">{cambio ? `Esta semana: ${cambio}` : "Sin tendencia aún"}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ProximoEjercicio({ tarea }: { tarea: Tarea }) {
  return (
    <li className="proximo vidrio">
      <span className="insignia" aria-hidden="true">
        <Music />
      </span>
      <span className="proximo-texto">
        <Link className="proximo-titulo" to={`/tareas/${tarea.id}`}>
          {tarea.ejercicio.nombre}
        </Link>
        <span className="suave">
          {NOMBRE_MANOS[tarea.manos]} · ♩ = {tarea.tempo_min_bpm}–{tarea.tempo_max_bpm} · Plazo{" "}
          {fechaLegible(tarea.fecha_limite)}
        </span>
      </span>
      <EnlaceBoton
        to={`/practicar/${tarea.id}`}
        icono={Play}
        aria-label={`Practicar ${tarea.ejercicio.nombre}`}
      >
        Practicar
      </EnlaceBoton>
    </li>
  );
}

export function PanelEstudiante() {
  const { carga } = useCarga(async () => {
    const [tareas, intentos, progreso] = await Promise.all([
      pedir("GET", "/mis-tareas", z.array(Tarea)),
      pedir("GET", "/mis-intentos", z.array(IntentoGuardado)),
      pedir("GET", "/tableros/mi-progreso", MiProgreso),
    ]);
    const pendientes = tareas.filter((t) => PENDIENTES.has(t.estado));
    const proxima = pendientes[0];
    const avance = proxima ? await pedir("GET", `/tareas/${proxima.id}/avance`, AvanceTarea) : null;
    return { pendientes, intentos, progreso, avance };
  }, []);
  return (
    <div className="panel">
      <Cargado carga={carga}>
        {({ pendientes, intentos, progreso, avance }) => {
          const proxima = pendientes[0];
          const semana = intentosPorSemana(intentos, new Date());
          return (
            <>
              <Saludo
                frase="La música también se aprende con constancia."
                accion={
                  proxima ? (
                    <EnlaceBoton
                      to={`/practicar/${proxima.id}`}
                      icono={Play}
                      className="boton-portada"
                    >
                      Continuar práctica
                    </EnlaceBoton>
                  ) : (
                    <EnlaceBoton to="/catalogo" icono={BookOpen} className="boton-portada">
                      Ver ejercicios
                    </EnlaceBoton>
                  )
                }
              />
              <section className="resumen" aria-label="Resumen">
                <TarjetaResumen
                  icono={ClipboardList}
                  etiqueta="Tareas pendientes"
                  valor={pendientes.length}
                  detalle={
                    proxima ? `La próxima: ${proxima.ejercicio.nombre}` : "Ninguna por ahora"
                  }
                  data-resumen="pendientes"
                />
                <TarjetaResumen
                  icono={Repeat}
                  etiqueta="Repeticiones de hoy"
                  valor={avance ? `${avance.validas_hoy} de ${avance.meta_por_dia}` : "—"}
                  detalle={proxima ? proxima.ejercicio.nombre : "Sin tarea en curso"}
                  data-resumen="hoy"
                />
                <TarjetaResumen
                  icono={CalendarCheck}
                  etiqueta="Intentos esta semana"
                  valor={semana.esta}
                  detalle={cambioSemanal(semana)}
                  data-resumen="semana"
                />
              </section>
              <SeccionCabecera
                titulo="Tu último intento"
                enlace={<Link to="/mi-progreso">Ver tu progreso</Link>}
              />
              <UltimaCalificacion intentos={intentos} progreso={progreso} />
              <SeccionCabecera
                titulo="Tus próximos ejercicios"
                enlace={<Link to="/tareas">Ver todas</Link>}
              />
              {pendientes.length === 0 ? (
                <EstadoVista tipo="vacio" titulo="Sin tareas pendientes" data-vacio="true">
                  <p>Cuando tu docente te asigne una tarea, aparecerá aquí.</p>
                </EstadoVista>
              ) : (
                <ul className="proximos">
                  {pendientes.slice(0, 3).map((t) => (
                    <ProximoEjercicio key={t.id} tarea={t} />
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </Cargado>
    </div>
  );
}

export function PanelDocente() {
  const { carga } = useCarga(
    () =>
      Promise.all([
        pedir("GET", "/mis-estudiantes", z.array(EstudianteResumen)),
        pedir("GET", "/tableros/mi-grupo?ultimos=10", MiGrupo),
      ]),
    [],
  );
  return (
    <div className="panel">
      <Cargado carga={carga}>
        {([estudiantes, grupo]) => {
          const conIntentos = grupo.estudiantes.filter((e) => e.intentos_considerados > 0).length;
          const porClase = CLASES.map((c) => ({
            c,
            n: grupo.estudiantes.filter((e) => e.errores.some((x) => x.clase === c)).length,
          })).filter((x) => x.n > 0);
          const frecuente = porClase.reduce<(typeof porClase)[number] | null>(
            (a, b) => (a === null || b.n > a.n ? b : a),
            null,
          );
          return (
            <>
              <Saludo
                frase="Acompaña la práctica de tus estudiantes, intento a intento."
                accion={
                  <EnlaceBoton to="/estudiantes" icono={GraduationCap} className="boton-portada">
                    Ver mis estudiantes
                  </EnlaceBoton>
                }
              />
              <section className="resumen" aria-label="Resumen">
                <TarjetaResumen
                  icono={UsersRound}
                  etiqueta="Estudiantes asignados"
                  valor={estudiantes.length}
                  data-resumen="estudiantes"
                />
                <TarjetaResumen
                  icono={CalendarCheck}
                  etiqueta="Con intentos evaluados"
                  valor={`${conIntentos} de ${grupo.estudiantes.length}`}
                  detalle="En sus últimos 10 intentos"
                  data-resumen="con-intentos"
                />
                <TarjetaResumen
                  icono={TableProperties}
                  etiqueta="Error más frecuente del grupo"
                  valor={frecuente ? NOMBRE_VARIABLE[frecuente.c] : "—"}
                  detalle={
                    frecuente
                      ? `En ${frecuente.n} ${frecuente.n === 1 ? "estudiante" : "estudiantes"}`
                      : "Sin errores recurrentes"
                  }
                  data-resumen="frecuente"
                />
              </section>
              <SeccionCabecera
                titulo="Tus estudiantes"
                enlace={<Link to="/mi-grupo">Ver el grupo</Link>}
              />
              {estudiantes.length === 0 ? (
                <EstadoVista tipo="vacio" titulo="Sin estudiantes por ahora">
                  <p>El administrador de tu institución te los asigna.</p>
                </EstadoVista>
              ) : (
                <ul className="proximos">
                  {estudiantes.slice(0, 5).map((e) => (
                    <li key={e.id} className="proximo vidrio">
                      <span className="insignia" aria-hidden="true">
                        <UserRound />
                      </span>
                      <span className="proximo-texto">
                        <span className="proximo-titulo">{e.nombre_visible}</span>
                        <span className="suave">{e.usuario}</span>
                      </span>
                      <EnlaceBoton
                        to={`/estudiantes/${e.id}`}
                        variante="secundario"
                        aria-label={`Ver la ficha de ${e.nombre_visible}`}
                      >
                        Ver ficha
                      </EnlaceBoton>
                    </li>
                  ))}
                </ul>
              )}
            </>
          );
        }}
      </Cargado>
    </div>
  );
}

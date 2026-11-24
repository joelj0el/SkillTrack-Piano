import {
  InstitucionCreada,
  InstitucionListada,
  MiPlan,
  Plan,
  SolicitudAcceso,
  Suscripcion,
  type Periodo,
} from "@skilltrack/contracts";
import {
  Building2,
  CheckCheck,
  CircleCheck,
  CircleOff,
  Plus,
  QrCode,
  Save,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { ErrorApi, pedir } from "../api.ts";
import { Cargado, fechaLegible, useCarga } from "../componentes.tsx";
import { useSesion } from "../sesion.tsx";
import { Boton, Chip, EstadoVista, PaginaCabecera, useAviso } from "../ui/base.tsx";
import { limiteTexto, precioTexto } from "./planes.tsx";

/**
 * HU-39 (ADR-004): gestión de planes, instituciones y convenios (superadministrador), "Mi plan"
 * (administrador de la institución) y solicitudes de acceso. Ningún precio ni límite se inventa:
 * vacío es "—".
 */

const ESTADO_SUSCRIPCION: Record<Suscripcion["estado"], string> = {
  pendiente: "Pendiente",
  activa: "Activa",
  vencida: "Vencida",
  cancelada: "Cancelada",
};

function mensajeDe(e: unknown): string {
  if (e instanceof ErrorApi) {
    const campos = e.campos();
    if (Object.keys(campos).length) {
      return Object.entries(campos)
        .map(([campo, msg]) => `${campo}: ${msg}`)
        .join(" · ");
    }
    return e.message;
  }
  return "No se pudo completar la operación. Revisa tu conexión.";
}

const texto = (d: FormData, campo: string) => String(d.get(campo) ?? "").trim();
const numeroONulo = (d: FormData, campo: string) => {
  const v = texto(d, campo);
  return v === "" ? null : Number(v);
};
const textoONulo = (d: FormData, campo: string) => texto(d, campo) || null;

function datosPlan(d: FormData) {
  return {
    nombre: texto(d, "nombre"),
    descripcion: texto(d, "descripcion"),
    beneficios: texto(d, "beneficios")
      .split("\n")
      .map((b) => b.trim())
      .filter(Boolean),
    precio_bs: numeroONulo(d, "precio_bs"),
    periodo: texto(d, "periodo") as Periodo,
    limite_docentes: numeroONulo(d, "limite_docentes"),
    limite_estudiantes: numeroONulo(d, "limite_estudiantes"),
    destacado: d.get("destacado") === "on",
    activo: d.get("activo") === "on",
  };
}

/** Campos de un plan; vacío en precio o límites = sin definir ("—"). */
function CamposPlan({ plan }: { plan?: Plan }) {
  return (
    <>
      <label>
        Nombre
        <input name="nombre" required maxLength={80} defaultValue={plan?.nombre} />
      </label>
      <label>
        Descripción
        <input name="descripcion" required maxLength={240} defaultValue={plan?.descripcion} />
      </label>
      <label>
        Beneficios (uno por línea)
        <textarea name="beneficios" rows={4} defaultValue={plan?.beneficios.join("\n")} />
      </label>
      <label>
        Precio en Bs (vacío: sin definir)
        <input
          name="precio_bs"
          type="number"
          min={0}
          step="0.01"
          defaultValue={plan?.precio_bs ?? ""}
        />
      </label>
      <label>
        Periodo
        <select name="periodo" defaultValue={plan?.periodo ?? "mensual"}>
          <option value="mensual">Mensual</option>
          <option value="anual">Anual</option>
        </select>
      </label>
      <label>
        Límite de docentes (vacío: sin definir)
        <input
          name="limite_docentes"
          type="number"
          min={1}
          defaultValue={plan?.limite_docentes ?? ""}
        />
      </label>
      <label>
        Límite de estudiantes (vacío: sin definir)
        <input
          name="limite_estudiantes"
          type="number"
          min={1}
          defaultValue={plan?.limite_estudiantes ?? ""}
        />
      </label>
      <label className="fila">
        <input name="destacado" type="checkbox" defaultChecked={plan?.destacado ?? false} />{" "}
        Recomendado
      </label>
      <label className="fila">
        <input name="activo" type="checkbox" defaultChecked={plan?.activo ?? true} /> Activo
        (visible en la página de inicio)
      </label>
    </>
  );
}

export function GestionPlanes() {
  const { carga, recargar } = useCarga(
    () =>
      Promise.all([
        pedir("GET", "/admin/planes", z.array(Plan)),
        pedir("GET", "/admin/instituciones", z.array(InstitucionListada)),
        pedir("GET", "/admin/suscripciones", z.array(Suscripcion)),
      ]),
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [clave, setClave] = useState<InstitucionCreada | null>(null);
  const avisar = useAviso();

  async function enviar(accion: () => Promise<unknown>, aviso: string, f?: HTMLFormElement) {
    try {
      await accion();
      setError(null);
      avisar(aviso);
      f?.reset();
      await recargar();
    } catch (e) {
      setError(mensajeDe(e));
    }
  }

  return (
    <section className="pila-secciones">
      <PaginaCabecera
        titulo="Planes y convenios"
        detalle="Los planes activos se muestran en la página de inicio. Un precio o un límite vacío aparece como «—»."
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {clave && (
        <div className="aviso" role="status" data-clave-temporal={clave.clave_temporal}>
          <p>
            Clave temporal de <strong>{clave.admin_usuario}</strong>:{" "}
            <code>{clave.clave_temporal}</code>
          </p>
          <p>Anótala ahora: no se volverá a mostrar.</p>
        </div>
      )}
      <Cargado carga={carga}>
        {([planes, instituciones, suscripciones]) => (
          <>
            <section aria-labelledby="t-planes" className="pila-secciones">
              <h2 id="t-planes">Planes</h2>
              <ul className="lista" aria-label="Planes">
                {planes.map((p) => (
                  <li key={p.id} className="tarjeta" data-plan={p.nombre}>
                    <span className="tarjeta-titulo">{p.nombre}</span>
                    <span className="suave">
                      {precioTexto(p)} · Docentes: {limiteTexto(p.limite_docentes)} · Estudiantes:{" "}
                      {limiteTexto(p.limite_estudiantes)}
                    </span>
                    <span>
                      <Chip
                        tono={p.activo ? "correcto" : "no-evaluable"}
                        icono={p.activo ? CircleCheck : CircleOff}
                      >
                        {p.activo ? "Activo" : "Inactivo"}
                      </Chip>{" "}
                      {p.destacado && <Chip icono={Sparkles}>Recomendado</Chip>}
                    </span>
                    <details>
                      <summary>Editar {p.nombre}</summary>
                      <form
                        aria-label={`Editar ${p.nombre}`}
                        onSubmit={(e) => {
                          e.preventDefault();
                          const d = new FormData(e.currentTarget);
                          void enviar(
                            () => pedir("PATCH", `/admin/planes/${p.id}`, Plan, datosPlan(d)),
                            "Plan guardado",
                          );
                        }}
                      >
                        <CamposPlan plan={p} />
                        <Boton type="submit" icono={Save}>
                          Guardar
                        </Boton>
                      </form>
                    </details>
                  </li>
                ))}
              </ul>
              <details className="tarjeta">
                <summary>Nuevo plan</summary>
                <form
                  aria-label="Nuevo plan"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = e.currentTarget;
                    void enviar(
                      () => pedir("POST", "/admin/planes", Plan, datosPlan(new FormData(f))),
                      "Plan creado",
                      f,
                    );
                  }}
                >
                  <CamposPlan />
                  <Boton type="submit" icono={Plus}>
                    Crear plan
                  </Boton>
                </form>
              </details>
            </section>

            <section aria-labelledby="t-suscripciones" className="pila-secciones">
              <h2 id="t-suscripciones">Suscripciones y convenios</h2>
              {suscripciones.length === 0 ? (
                <p className="suave">Ninguna institución tiene suscripción todavía.</p>
              ) : (
                <div
                  className="tabla-contenedor"
                  tabIndex={0}
                  role="region"
                  aria-label="Suscripciones"
                >
                  <table className="tabla" aria-label="Suscripciones">
                    <thead>
                      <tr>
                        <th>Institución</th>
                        <th>Plan</th>
                        <th>Estado</th>
                        <th>Vigencia</th>
                        <th>Convenio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {suscripciones.map((s) => (
                        <tr key={s.id} data-suscripcion={s.id}>
                          <th scope="row">{s.institucion}</th>
                          <td>{s.plan}</td>
                          <td>
                            <select
                              aria-label={`Estado de la suscripción de ${s.institucion}`}
                              value={s.estado}
                              onChange={(e) =>
                                void enviar(
                                  () =>
                                    pedir("PATCH", `/admin/suscripciones/${s.id}`, Suscripcion, {
                                      estado: e.target.value,
                                    }),
                                  "Estado actualizado",
                                )
                              }
                            >
                              {Object.entries(ESTADO_SUSCRIPCION).map(([v, n]) => (
                                <option key={v} value={v}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            {s.inicio ? fechaLegible(s.inicio) : "—"} –{" "}
                            {s.fin ? fechaLegible(s.fin) : "—"}
                          </td>
                          <td>
                            {s.convenio
                              ? `Sí · ${s.condiciones ?? "sin condiciones escritas"} · Docentes: ${limiteTexto(s.limite_docentes)} · Estudiantes: ${limiteTexto(s.limite_estudiantes)}`
                              : "No"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <details className="tarjeta">
                <summary>Nueva suscripción o convenio</summary>
                <form
                  aria-label="Nueva suscripción"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = e.currentTarget;
                    const d = new FormData(f);
                    const convenio = d.get("convenio") === "on";
                    void enviar(
                      () =>
                        pedir("POST", "/admin/suscripciones", Suscripcion, {
                          institucion_id: Number(d.get("institucion_id")),
                          plan_id: Number(d.get("plan_id")),
                          estado: texto(d, "estado"),
                          inicio: textoONulo(d, "inicio"),
                          fin: textoONulo(d, "fin"),
                          convenio,
                          condiciones: convenio ? textoONulo(d, "condiciones") : null,
                          limite_docentes: convenio ? numeroONulo(d, "limite_docentes") : null,
                          limite_estudiantes: convenio
                            ? numeroONulo(d, "limite_estudiantes")
                            : null,
                        }),
                      "Suscripción creada",
                      f,
                    );
                  }}
                >
                  <label>
                    Institución
                    <select name="institucion_id" required>
                      {instituciones.map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Plan
                    <select name="plan_id" required>
                      {planes.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Estado
                    <select name="estado" defaultValue="activa">
                      {Object.entries(ESTADO_SUSCRIPCION).map(([v, n]) => (
                        <option key={v} value={v}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Inicio
                    <input name="inicio" type="date" />
                  </label>
                  <label>
                    Fin
                    <input name="fin" type="date" />
                  </label>
                  <label className="fila">
                    <input name="convenio" type="checkbox" /> Convenio especial (sus condiciones y
                    límites reemplazan a los del plan)
                  </label>
                  <label>
                    Condiciones del convenio
                    <textarea name="condiciones" rows={3} maxLength={1000} />
                  </label>
                  <label>
                    Límite de docentes del convenio (vacío: sin definir)
                    <input name="limite_docentes" type="number" min={1} />
                  </label>
                  <label>
                    Límite de estudiantes del convenio (vacío: sin definir)
                    <input name="limite_estudiantes" type="number" min={1} />
                  </label>
                  <Boton type="submit" icono={Plus}>
                    Crear suscripción
                  </Boton>
                </form>
              </details>
            </section>

            <section aria-labelledby="t-instituciones" className="pila-secciones">
              <h2 id="t-instituciones">Instituciones</h2>
              <ul className="lista" aria-label="Instituciones">
                {instituciones.map((i) => (
                  <li key={i.id} className="tarjeta">
                    {i.nombre}
                  </li>
                ))}
              </ul>
              <details className="tarjeta">
                <summary>Nueva institución o docente independiente</summary>
                <form
                  aria-label="Nueva institución"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = e.currentTarget;
                    const d = new FormData(f);
                    void (async () => {
                      try {
                        const creada = await pedir(
                          "POST",
                          "/admin/instituciones",
                          InstitucionCreada,
                          {
                            nombre: texto(d, "nombre"),
                            independiente: d.get("independiente") === "on",
                            admin_usuario: texto(d, "admin_usuario"),
                            admin_nombre: texto(d, "admin_nombre"),
                            admin_email: textoONulo(d, "admin_email"),
                          },
                        );
                        setClave(creada);
                        setError(null);
                        f.reset();
                        await recargar();
                      } catch (err) {
                        setError(mensajeDe(err));
                      }
                    })();
                  }}
                >
                  <label>
                    Nombre de la institución
                    <input name="nombre" required maxLength={160} />
                  </label>
                  <label className="fila">
                    <input name="independiente" type="checkbox" /> Docente independiente (una
                    institución de un solo docente, que también la administra)
                  </label>
                  <label>
                    Usuario del administrador
                    <input name="admin_usuario" required pattern="[a-z0-9._\-]{3,64}" />
                  </label>
                  <label>
                    Nombre visible del administrador
                    <input name="admin_nombre" required maxLength={120} />
                  </label>
                  <label>
                    Correo (opcional)
                    <input name="admin_email" type="email" />
                  </label>
                  <Boton type="submit" icono={Building2}>
                    Crear institución
                  </Boton>
                </form>
              </details>
            </section>
          </>
        )}
      </Cargado>
    </section>
  );
}

export function Solicitudes() {
  const { carga, recargar } = useCarga(
    () => pedir("GET", "/admin/solicitudes-acceso", z.array(SolicitudAcceso)),
    [],
  );
  return (
    <section>
      <PaginaCabecera
        titulo="Solicitudes de acceso"
        detalle="Pedidos enviados desde la página de inicio. Las pendientes van primero."
      />
      <Cargado carga={carga}>
        {(solicitudes) =>
          solicitudes.length === 0 ? (
            <EstadoVista tipo="vacio" titulo="Sin solicitudes" data-vacio="true">
              <p>Cuando alguien pida información desde la página de inicio, aparecerá aquí.</p>
            </EstadoVista>
          ) : (
            <ul className="lista" aria-label="Solicitudes">
              {solicitudes.map((s) => (
                <li key={s.id} className="tarjeta" data-solicitud={s.id}>
                  <span className="tarjeta-titulo">
                    {s.nombre} · {s.institucion}
                  </span>
                  <span className="suave">
                    {fechaLegible(s.creada_en)} · {s.correo}
                    {s.telefono && ` · ${s.telefono}`} · Plan: {s.plan ?? "sin elegir"}
                  </span>
                  {s.mensaje && <p>{s.mensaje}</p>}
                  <div className="tarjeta-pie">
                    {s.atendida ? (
                      <Chip tono="correcto" icono={CircleCheck}>
                        Atendida
                      </Chip>
                    ) : (
                      <Boton
                        variante="secundario"
                        icono={CheckCheck}
                        onClick={() =>
                          void pedir(
                            "POST",
                            `/admin/solicitudes-acceso/${s.id}/atender`,
                            SolicitudAcceso,
                          ).then(recargar)
                        }
                      >
                        Marcar como atendida
                      </Boton>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )
        }
      </Cargado>
    </section>
  );
}

const usado = (n: number, limite: number | null) =>
  limite === null ? `${n} (límite: —)` : `${n} de ${limite}`;

export function MiPlanPagina() {
  const { estado } = useSesion();
  const institucionId =
    estado.tipo === "activo"
      ? estado.usuario.membresias.find((m) => m.rol === "admin_inst")?.institucion_id
      : undefined;
  const { carga } = useCarga(
    () => pedir("GET", `/instituciones/${institucionId}/mi-plan`, MiPlan),
    [institucionId],
  );
  return (
    <section className="pila-secciones">
      <PaginaCabecera titulo="Mi plan" />
      <Cargado carga={carga}>
        {(d) => (
          <>
            <div className="tarjeta vidrio" data-mi-plan="true">
              <h2>{d.suscripcion ? d.suscripcion.plan : "Sin plan"}</h2>
              <dl className="datos">
                <dt>Institución</dt>
                <dd>{d.institucion}</dd>
                <dt>Estado</dt>
                <dd data-estado={d.suscripcion?.estado ?? "ninguna"}>
                  {d.suscripcion ? ESTADO_SUSCRIPCION[d.suscripcion.estado] : "Sin suscripción"}
                  {d.suscripcion?.convenio && " · convenio especial"}
                </dd>
                <dt>Vence</dt>
                <dd>{d.suscripcion?.fin ? fechaLegible(d.suscripcion.fin) : "—"}</dd>
                <dt>Docentes</dt>
                <dd data-usados="docentes">{usado(d.docentes, d.limite_docentes)}</dd>
                <dt>Estudiantes</dt>
                <dd data-usados="estudiantes">{usado(d.estudiantes, d.limite_estudiantes)}</dd>
              </dl>
              {d.suscripcion?.condiciones && (
                <p className="suave">Condiciones: {d.suscripcion.condiciones}</p>
              )}
            </div>
            <EstadoVista tipo="vacio" titulo="Pago por QR en integración con el banco">
              <p>
                Pronto podrás pagar tu plan con un código QR del Banco Económico desde esta
                pantalla. Mientras tanto, la activación y la renovación las hace el
                superadministrador.
              </p>
              <Boton icono={QrCode} disabled>
                Pagar con QR
              </Boton>
            </EstadoVista>
          </>
        )}
      </Cargado>
    </section>
  );
}

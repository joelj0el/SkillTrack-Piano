import { MiPago, type QrDePago } from "@skilltrack/contracts";
import { CircleX, Hourglass, LogOut, QrCode, RefreshCw, TimerOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ErrorApi, pedir } from "../api.ts";
import { fechaLegible } from "../componentes.tsx";
import { useSesion } from "../sesion.tsx";
import { Boton, Chip, EstadoVista, Esqueleto, PaginaCabecera } from "../ui/base.tsx";
import { precioTexto } from "./planes.tsx";

/**
 * Pago por QR (ADR-004, ADR-005). `PagoConQr` sirve a la cuenta pendiente de pago (/pago) y a la
 * renovación desde "Mi plan". Con el banco, consulta a nuestro servidor cada 5 s mientras el QR
 * espera el pago; el servidor consulta al banco como mucho una vez cada 5 s por pago.
 */

export const INTERVALO_CONSULTA_MS = 5000;
const NO_SE_PUDO = "No pudimos generar el QR. Intenta de nuevo en unos minutos.";

function CodigoQr({ qr, monto }: { qr: QrDePago; monto: string }) {
  if (qr.imagen_png) {
    return (
      <img
        className="qr-pago"
        src={`data:image/png;base64,${qr.imagen_png}`}
        alt={`Código QR para pagar ${monto}`}
      />
    );
  }
  return (
    <div className="qr-pago qr-simulado" role="img" aria-label="QR simulado: no sirve para pagar">
      <QrCode aria-hidden="true" />
      <span>QR simulado</span>
    </div>
  );
}

export const montoTexto = (d: MiPago) =>
  d.monto_bs === null ? "Bs —" : precioTexto({ precio_bs: d.monto_bs, periodo: d.periodo });

type Estado =
  | { tipo: "cargando" }
  | { tipo: "listo"; pago: MiPago }
  | { tipo: "sin-pago" }
  | { tipo: "no-administra" }
  | { tipo: "error"; mensaje: string };

/**
 * QR del monto del plan, con su estado. `automatico`: genera el QR al abrir si no hay uno.
 * `alActivar` se llama cuando el plan quedó activo (o ya no hay pago pendiente).
 */
export function PagoConQr({
  base,
  automatico,
  alActivar,
}: {
  base: string;
  automatico: boolean;
  alActivar: (pago: MiPago | null) => void;
}) {
  const [estado, setEstado] = useState<Estado>({ tipo: "cargando" });
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /** Confirmado el pago: la cuenta pendiente quedó activa, o en "Mi plan" el QR ya no espera. */
  const recibir = useCallback(
    (nuevo: MiPago, antes: MiPago) => {
      setEstado({ tipo: "listo", pago: nuevo });
      const confirmado =
        nuevo.estado === "activa" &&
        (antes.estado !== "activa" || (antes.qr?.estado === "pendiente" && nuevo.qr === null));
      if (confirmado) alActivar(nuevo);
    },
    [alActivar],
  );

  const fallo = useCallback(
    (e: unknown) => {
      if (e instanceof ErrorApi && e.estado === 404) {
        setEstado({ tipo: "sin-pago" });
        alActivar(null);
      } else if (e instanceof ErrorApi && e.estado === 403) {
        setEstado({ tipo: "no-administra" });
      } else if (e instanceof ErrorApi && e.estado === 503) {
        setAviso(e.message || NO_SE_PUDO);
      } else if (e instanceof ErrorApi && e.estado === 409) {
        setAviso(e.message);
      } else {
        setAviso("No pudimos comunicarnos con el servidor. Revisa tu conexión.");
      }
    },
    [alActivar],
  );

  const generar = useCallback(async () => {
    setOcupado(true);
    setAviso(null);
    try {
      setEstado({ tipo: "listo", pago: await pedir("POST", `${base}/qr`, MiPago) });
    } catch (e) {
      fallo(e);
    }
    setOcupado(false);
  }, [base, fallo]);

  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const pago = await pedir("GET", base, MiPago);
        if (!vivo) return;
        setEstado({ tipo: "listo", pago });
        const sinImagen =
          pago.proveedor === "baneco" && pago.qr?.estado === "pendiente" && !pago.qr.imagen_png;
        const sinQr = !pago.qr || sinImagen;
        if (automatico && sinQr && pago.monto_bs !== null && pago.monto_bs > 0) await generar();
      } catch (e) {
        if (vivo) {
          fallo(e);
          setEstado((actual) =>
            actual.tipo === "cargando" ? { tipo: "error", mensaje: NO_SE_PUDO } : actual,
          );
        }
      }
    })();
    return () => {
      vivo = false;
    };
  }, [base, automatico, generar, fallo]);

  const pago = estado.tipo === "listo" ? estado.pago : null;

  const verificar = useCallback(
    async (manual: boolean) => {
      if (!pago) return;
      try {
        const nuevo = await pedir("POST", `${base}/verificar`, MiPago);
        recibir(nuevo, pago);
        if (manual && nuevo.estado !== "activa") {
          setAviso("Todavía no se confirmó el pago. Vuelve a verificar en unos minutos.");
        }
      } catch (e) {
        fallo(e);
      }
    },
    [base, pago, recibir, fallo],
  );

  // Con el banco, consulta cada 5 s mientras el QR espera el pago.
  const esperando = pago?.proveedor === "baneco" && pago.qr?.estado === "pendiente";
  useEffect(() => {
    if (!esperando) return;
    const reloj = window.setInterval(() => void verificar(false), INTERVALO_CONSULTA_MS);
    return () => window.clearInterval(reloj);
  }, [esperando, verificar]);

  async function cancelar() {
    setOcupado(true);
    try {
      setEstado({ tipo: "listo", pago: await pedir("POST", `${base}/cancelar`, MiPago) });
    } catch (e) {
      fallo(e);
    }
    setOcupado(false);
  }

  if (estado.tipo === "cargando" || estado.tipo === "sin-pago") return <Esqueleto tarjetas={1} />;
  if (estado.tipo === "no-administra") {
    return (
      <EstadoVista tipo="vacio" titulo="Tu institución tiene el pago pendiente">
        <p>Pide a la administración de tu institución que complete el pago del plan.</p>
      </EstadoVista>
    );
  }
  if (estado.tipo === "error") {
    return (
      <EstadoVista tipo="error" titulo={estado.mensaje}>
        <p>El superadministrador también puede activar tu plan cuando verifique el pago.</p>
      </EstadoVista>
    );
  }

  const d = estado.pago;
  const monto = montoTexto(d);
  const banco = d.proveedor === "baneco";
  // Con el banco, un QR pendiente sin imagen (la API se reinició) se reemplaza por uno nuevo.
  const sinImagen = banco && d.qr?.estado === "pendiente" && !d.qr.imagen_png;
  const qr = d.qr && d.qr.estado !== "pagado" && !sinImagen ? d.qr : null;

  return (
    <div className="pila-secciones" data-proveedor={d.proveedor}>
      <div className="tarjeta vidrio" data-pago={d.estado}>
        <h2>{d.plan}</h2>
        <dl className="datos">
          <dt>Institución</dt>
          <dd>{d.institucion}</dd>
          <dt>Monto</dt>
          <dd data-monto="true">{monto}</dd>
          {d.codigo_convenio && (
            <>
              <dt>Convenio</dt>
              <dd>{d.codigo_convenio}</dd>
            </>
          )}
          {qr?.estado === "pendiente" && (
            <>
              <dt>Estado</dt>
              <dd>
                <Chip tono="tiempo" icono={Hourglass}>
                  {banco ? "Esperando el pago…" : "Pago en verificación"}
                </Chip>
              </dd>
            </>
          )}
        </dl>
      </div>
      {qr?.estado === "pendiente" && (
        <div className="tarjeta vidrio pago-qr" data-qr={qr.estado}>
          <CodigoQr qr={qr} monto={monto} />
          {qr.simulado ? (
            <p>
              El pago por QR está en integración con el banco: este código es simulado y no sirve
              para pagar. El superadministrador verificará tu pago y activará tu cuenta.
            </p>
          ) : (
            <>
              <p>Escanea el código con la aplicación de tu banco y paga {monto}.</p>
              <p>Vence el {fechaLegible(qr.vence_en)}.</p>
              <p className="suave" role="status">
                Esperando el pago… La pantalla se actualiza sola.
              </p>
            </>
          )}
          <p className="suave">Transacción: {qr.id_transaccion}</p>
        </div>
      )}
      {qr && qr.estado !== "pendiente" && (
        <EstadoVista tipo="vacio" titulo="El QR venció">
          <p>Genera un QR nuevo para pagar {monto}.</p>
        </EstadoVista>
      )}
      {sinImagen && (
        <EstadoVista tipo="vacio" titulo="El QR ya no se puede mostrar">
          <p>Genera un QR nuevo para pagar {monto}.</p>
        </EstadoVista>
      )}
      {!qr && d.monto_bs === null && (
        <EstadoVista tipo="vacio" titulo="El monto de tu plan todavía no está definido">
          <p>El superadministrador verificará tu cuenta y la activará.</p>
        </EstadoVista>
      )}
      {aviso && (
        <p className="aviso" role="status">
          {aviso}
        </p>
      )}
      <div className="perfil-acciones">
        {qr?.estado === "pendiente" && !banco && (
          <Boton icono={RefreshCw} onClick={() => void verificar(true)}>
            Ya pagué: verificar
          </Boton>
        )}
        {(!qr || qr.estado !== "pendiente") && d.monto_bs !== null && d.monto_bs > 0 && (
          <Boton icono={QrCode} cargando={ocupado} onClick={() => void generar()}>
            {qr || sinImagen ? "Generar nuevo QR" : "Pagar con QR"}
          </Boton>
        )}
        {qr?.estado === "pendiente" && banco && (
          <Boton
            variante="secundario"
            icono={CircleX}
            cargando={ocupado}
            onClick={() => void cancelar()}
          >
            Cancelar
          </Boton>
        )}
      </div>
      {aviso === NO_SE_PUDO && (
        <p className="suave">
          <TimerOff aria-hidden="true" /> Mientras tanto, el superadministrador puede activar tu
          plan cuando verifique el pago.
        </p>
      )}
    </div>
  );
}

/** Pantalla de la cuenta pendiente de pago: lo único que ve, junto con "Cerrar sesión". */
export function PantallaPago() {
  const { salir, recargar } = useSesion();
  const activada = useCallback(() => void recargar(), [recargar]);
  return (
    <section className="pila-secciones pagina-pago">
      <PaginaCabecera
        titulo="Pago de tu plan"
        detalle="Tu cuenta está creada. Cuando se confirme el pago, se habilita la aplicación."
      />
      <PagoConQr base="/mi-pago" automatico alActivar={activada} />
      <div className="perfil-acciones">
        <Boton variante="secundario" icono={LogOut} onClick={() => void salir()}>
          Cerrar sesión
        </Boton>
      </div>
    </section>
  );
}

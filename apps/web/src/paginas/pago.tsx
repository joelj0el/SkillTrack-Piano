import { MiPago, type QrDePago } from "@skilltrack/contracts";
import { Hourglass, LogOut, QrCode, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorApi, pedir } from "../api.ts";
import { Cargado, useCarga } from "../componentes.tsx";
import { useSesion } from "../sesion.tsx";
import { Boton, Chip, EstadoVista, Esqueleto, PaginaCabecera } from "../ui/base.tsx";
import { precioTexto } from "./planes.tsx";

/**
 * Pantalla de la cuenta pendiente de pago (ADR-005): el plan, el monto y el QR del adaptador
 * vigente (simulado mientras no esté el del banco). Es lo único que ve, junto con "Cerrar sesión".
 * Confirmado el pago (por el adaptador o por el superadministrador), la sesión se recarga y la
 * aplicación se habilita.
 */

/** Sin pago pendiente (404): el plan ya se activó. Otro miembro de la institución: 403. */
async function cargarPago(): Promise<MiPago | "activada" | "no-administra"> {
  try {
    const pago = await pedir("GET", "/mi-pago", MiPago);
    if (pago.qr === null && pago.monto_bs !== null && pago.monto_bs > 0) {
      return await pedir("POST", "/mi-pago/qr", MiPago);
    }
    return pago;
  } catch (e) {
    if (e instanceof ErrorApi && e.estado === 404) return "activada";
    if (e instanceof ErrorApi && e.estado === 403) return "no-administra";
    throw e;
  }
}

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

/** El plan ya se activó: recarga la sesión y la aplicación se habilita. */
function YaActivada() {
  const { recargar } = useSesion();
  useEffect(() => {
    void recargar();
  }, [recargar]);
  return <Esqueleto tarjetas={1} />;
}

export function PantallaPago() {
  const { salir, recargar } = useSesion();
  const { carga, recargar: recargarPago } = useCarga(cargarPago, []);
  const [verificando, setVerificando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function verificar() {
    setVerificando(true);
    try {
      const pago = await pedir("POST", "/mi-pago/verificar", MiPago);
      if (pago.estado === "activa") await recargar();
      else setAviso("Todavía no se confirmó el pago. Vuelve a verificar en unos minutos.");
    } catch (e) {
      // 404: ya no hay pago pendiente (lo activó el superadministrador).
      if (e instanceof ErrorApi && e.estado === 404) await recargar();
      else setAviso("No se pudo verificar el pago. Revisa tu conexión e intenta de nuevo.");
    }
    setVerificando(false);
  }

  const cerrar = (
    <Boton variante="secundario" icono={LogOut} onClick={() => void salir()}>
      Cerrar sesión
    </Boton>
  );

  return (
    <section className="pila-secciones pagina-pago">
      <PaginaCabecera
        titulo="Pago de tu plan"
        detalle="Tu cuenta está creada. Cuando se confirme el pago, se habilita la aplicación."
      />
      <Cargado carga={carga}>
        {(d) => {
          if (d === "activada") return <YaActivada />;
          if (d === "no-administra") {
            return (
              <EstadoVista tipo="vacio" titulo="Tu institución tiene el pago pendiente">
                <p>Pide a la administración de tu institución que complete el pago del plan.</p>
                {cerrar}
              </EstadoVista>
            );
          }
          const monto =
            d.monto_bs === null
              ? "Bs —"
              : precioTexto({ precio_bs: d.monto_bs, periodo: d.periodo });
          return (
            <>
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
                  <dt>Estado</dt>
                  <dd>
                    <Chip tono="tiempo" icono={Hourglass}>
                      Pago en verificación
                    </Chip>
                  </dd>
                </dl>
              </div>
              {d.qr ? (
                <div className="tarjeta vidrio pago-qr">
                  <CodigoQr qr={d.qr} monto={monto} />
                  {d.qr.simulado ? (
                    <p>
                      El pago por QR está en integración con el banco: este código es simulado y no
                      sirve para pagar. El superadministrador verificará tu pago y activará tu
                      cuenta.
                    </p>
                  ) : (
                    <p>Escanea el código con la aplicación de tu banco y paga {monto}.</p>
                  )}
                  <p className="suave">Transacción: {d.qr.id_transaccion}</p>
                </div>
              ) : (
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
                <Boton
                  icono={RefreshCw}
                  cargando={verificando}
                  onClick={() => void verificar().then(recargarPago)}
                >
                  Ya pagué: verificar
                </Boton>
                {cerrar}
              </div>
            </>
          );
        }}
      </Cargado>
    </section>
  );
}

import { ArrowLeft, Scale } from "lucide-react";
import type { ReactNode } from "react";
import { Chip, EnlaceBoton, PaginaCabecera } from "../ui/base.tsx";

/**
 * Términos y política de privacidad (ADR-005): texto base que acepta quien se registra. Está
 * marcado "pendiente de revisión legal" hasta tener el texto definitivo.
 */

function PaginaLegal({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="pagina-planes legal">
      <EnlaceBoton to="/registro" variante="secundario" icono={ArrowLeft} className="volver">
        Volver al registro
      </EnlaceBoton>
      <PaginaCabecera titulo={titulo} />
      <p>
        <Chip tono="tiempo" icono={Scale}>
          Pendiente de revisión legal
        </Chip>
      </p>
      <div className="tarjeta vidrio legal-texto">{children}</div>
    </section>
  );
}

export function PaginaTerminos() {
  return (
    <PaginaLegal titulo="Términos y condiciones">
      <h2>Quién puede registrarse</h2>
      <p>
        Pueden registrarse personas adultas que usen SkillTrack-Piano como docentes independientes o
        en representación de una institución. Los estudiantes no se registran solos: sus cuentas las
        crea su docente o su institución, que responde por ellas.
      </p>
      <h2>Tu cuenta</h2>
      <p>
        Eres responsable de mantener tu contraseña en reserva y de los usuarios que crees en tu
        institución. Puedes cerrar tu sesión en cualquier momento.
      </p>
      <h2>Planes y pagos</h2>
      <p>
        El plan elegido se activa cuando se confirma su pago o cuando un convenio lo deja sin costo.
        Mientras el pago esté pendiente, solo podrás ver la pantalla de pago. No se guardan datos de
        tarjeta.
      </p>
      <h2>Uso de la aplicación</h2>
      <p>
        SkillTrack-Piano es una herramienta de apoyo a la práctica de piano: sus correcciones no
        reemplazan el criterio de tu docente.
      </p>
    </PaginaLegal>
  );
}

export function PaginaPrivacidad() {
  return (
    <PaginaLegal titulo="Política de privacidad">
      <h2>Qué datos guardamos</h2>
      <p>
        De quien se registra: nombre, correo, teléfono, usuario, el nombre de su clase o
        institución, el plan elegido y el momento en que aceptó estos textos. No se guardan datos de
        tarjeta.
      </p>
      <h2>Quién los ve</h2>
      <p>
        Tu correo y tu teléfono solo los ves tú y el superadministrador del sistema, que los usa
        para verificar tu pago y contactarte. Las listas de usuarios de tu institución no los
        muestran.
      </p>
      <h2>Tu práctica no sale del teléfono</h2>
      <p>
        El análisis se hace en el dispositivo: ningún video, audio ni imagen se envía al servidor.
        Solo se guardan los resultados de cada intento.
      </p>
    </PaginaLegal>
  );
}

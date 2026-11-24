import {
  Building2,
  Camera,
  ClipboardList,
  GraduationCap,
  LogIn,
  Mail,
  MessageSquareText,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router";
import { CORREO_CONTACTO } from "../config/planes.ts";
import { EnlaceBoton } from "../ui/base.tsx";
import { Portada, SeccionCabecera } from "../ui/portada.tsx";
import { BotonPlanes } from "./planes.tsx";

const PASOS: { icono: LucideIcon; titulo: string; texto: string }[] = [
  {
    icono: ClipboardList,
    titulo: "Tu docente te asigna una tarea",
    texto: "Un ejercicio del catálogo, con el tempo, las manos y las repeticiones de cada día.",
  },
  {
    icono: Camera,
    titulo: "Practicas con tu teléfono",
    texto: "Lo apoyas frente al teclado y tocas: la cámara y el micrófono siguen tu ejecución.",
  },
  {
    icono: MessageSquareText,
    titulo: "Recibes una corrección clara",
    texto: "Una corrección principal por intento, y tu docente ve cómo avanzas.",
  },
];

const PUBLICO: { icono: LucideIcon; titulo: string; texto: string }[] = [
  {
    icono: UserRound,
    titulo: "Estudiantes",
    texto: "Principiantes que practican en casa y quieren saber qué mejorar en cada intento.",
  },
  {
    icono: GraduationCap,
    titulo: "Docentes",
    texto: "Asignan tareas y siguen la práctica de cada estudiante entre clase y clase.",
  },
  {
    icono: Building2,
    titulo: "Instituciones",
    texto: "Escuelas y conservatorios que organizan a sus docentes y estudiantes.",
  },
];

function SolicitarAcceso({ variante }: { variante?: "secundario" }) {
  return CORREO_CONTACTO ? (
    <a
      className={["boton-enlace", variante].filter(Boolean).join(" ")}
      href={`mailto:${CORREO_CONTACTO}?subject=${encodeURIComponent("Acceso para mi institución")}`}
    >
      <Mail aria-hidden="true" />
      Solicitar acceso para mi institución
    </a>
  ) : (
    // Sin correo definido todavía: lleva a los planes, que explican cómo se obtiene el acceso.
    <Link className={["boton-enlace", variante].filter(Boolean).join(" ")} to="/planes">
      <Mail aria-hidden="true" />
      Solicitar acceso para mi institución
    </Link>
  );
}

/** Página de inicio pública (sin sesión): qué es, cómo funciona y para quién; los planes, en su ventana. */
export function InicioPublico() {
  return (
    <div className="publica">
      <Portada
        antetitulo="Aprende · Practica · Progresa"
        titulo="Aprende piano a tu ritmo"
        frase={
          <p>
            SkillTrack-Piano analiza tu práctica con la cámara y el micrófono del teléfono y te dice
            qué corregir. Tu docente sigue tu avance.
          </p>
        }
        accion={
          <>
            <EnlaceBoton to="/entrar" icono={LogIn} className="boton-portada">
              Iniciar sesión
            </EnlaceBoton>
            <BotonPlanes />
            <SolicitarAcceso variante="secundario" />
          </>
        }
      />

      <SeccionCabecera titulo="Cómo funciona" />
      <ol className="pasos">
        {PASOS.map(({ icono: Icono, titulo, texto }, i) => (
          <li key={titulo} className="paso vidrio">
            <span className="insignia" aria-hidden="true">
              <Icono />
            </span>
            <span className="paso-numero" aria-hidden="true">
              {i + 1}
            </span>
            <h3>{titulo}</h3>
            <p className="suave">{texto}</p>
          </li>
        ))}
      </ol>

      <SeccionCabecera titulo="Para quién" />
      <ul className="pasos">
        {PUBLICO.map(({ icono: Icono, titulo, texto }) => (
          <li key={titulo} className="paso vidrio">
            <span className="insignia" aria-hidden="true">
              <Icono />
            </span>
            <h3>{titulo}</h3>
            <p className="suave">{texto}</p>
          </li>
        ))}
      </ul>

      <section className="privacidad vidrio" aria-labelledby="t-privacidad">
        <span className="insignia" aria-hidden="true">
          <ShieldCheck />
        </span>
        <div>
          <h2 id="t-privacidad">Tu video no sale del teléfono</h2>
          <p>
            El análisis se hace en tu dispositivo. Ningún video, audio ni imagen se envía al
            servidor: solo se guardan los resultados de cada intento.
          </p>
        </div>
      </section>

      <section className="cierre vidrio" aria-label="Empezar">
        <h2>¿Listo para practicar?</h2>
        <div className="cierre-acciones">
          <EnlaceBoton to="/entrar" icono={LogIn}>
            Iniciar sesión
          </EnlaceBoton>
          <SolicitarAcceso variante="secundario" />
        </div>
      </section>
    </div>
  );
}

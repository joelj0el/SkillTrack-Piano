/**
 * Planes de la página pública: solo informativos. No hay facturación, registro ni ruta de la API
 * para planes (fuera del alcance del proyecto); el acceso lo crea el administrador. Los precios y
 * el correo de contacto quedan pendientes hasta que se definan.
 */
export interface Plan {
  nombre: string;
  para: string;
  precio: string;
  beneficios: string[];
}

export const PLANES: Plan[] = [
  {
    nombre: "Docente",
    para: "Para un docente con su grupo de estudiantes",
    precio: "Bs —",
    beneficios: [
      "Tareas con tempo, manos y repeticiones por día",
      "Ficha de cada estudiante con sus intentos",
      "Errores recurrentes del grupo, sin rankings",
    ],
  },
  {
    nombre: "Institución",
    para: "Para escuelas, conservatorios e institutos",
    precio: "Bs —",
    beneficios: [
      "Varios docentes y sus estudiantes",
      "Administración de usuarios y asignaciones",
      "Los mismos ejercicios para toda la institución",
    ],
  },
  {
    nombre: "Convenio especial",
    para: "Para proyectos de investigación y programas públicos",
    precio: "Bs —",
    beneficios: [
      "Condiciones acordadas con la institución",
      "Acompañamiento en la puesta en marcha",
      "Datos de investigación solo con consentimiento",
    ],
  },
];

/** Correo para solicitar acceso; vacío mientras no se defina (la página lo dice). */
export const CORREO_CONTACTO = "";

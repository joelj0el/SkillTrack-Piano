/**
 * Planes de la página pública: solo informativos. No hay facturación, registro ni ruta de la API
 * para planes (fuera del alcance del proyecto); el acceso lo crea el administrador. Cada precio o
 * límite que todavía no está definido se muestra como "—": no se inventan cifras.
 */
export interface Plan {
  nombre: string;
  para: string;
  precio: string;
  destacado: boolean;
  /** Solo funciones que ya existen en el sistema. */
  incluye: string[];
}

export const PLANES: Plan[] = [
  {
    nombre: "Docente",
    para: "Para un docente y sus estudiantes",
    precio: "Bs —",
    destacado: false,
    incluye: [
      "1 docente",
      "Hasta — estudiantes",
      "Catálogo de ejercicios con partitura y digitación",
      "Asignación de tareas con tempo y repeticiones",
      "Análisis de cada intento con resultado nota por nota",
      "Seguimiento de cada estudiante",
    ],
  },
  {
    nombre: "Institución",
    para: "Para escuelas y conservatorios con varios docentes",
    precio: "Bs —",
    destacado: true,
    incluye: [
      "Varios docentes (— docentes, — estudiantes)",
      "Todo lo del plan Docente",
      "Administración de usuarios por la institución",
      "Vista «Mi grupo» para cada docente",
      "Soporte para la puesta en marcha",
    ],
  },
  {
    nombre: "Convenio especial",
    para: "Para conservatorios e institutos",
    precio: "Bs —",
    destacado: false,
    incluye: [
      "Condiciones a medida para conservatorios e institutos",
      "Cantidad de docentes y estudiantes a convenir",
      "Acompañamiento en la capacitación",
      "Precio según el convenio",
    ],
  },
];

/** Correo para solicitar información o acceso; vacío mientras no se defina (la página lo dice). */
export const CORREO_CONTACTO = "";

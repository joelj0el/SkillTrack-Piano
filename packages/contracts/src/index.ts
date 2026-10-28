import { ClaseError, Ejercicio } from "./catalogo.ts";
import { CambioClave, InicioSesion, UsuarioActual } from "./identidad.ts";
import {
  Asignacion,
  AsignacionNueva,
  ClaveRestablecida,
  EstudianteResumen,
  UsuarioCreado,
  UsuarioListado,
  UsuarioNuevo,
} from "./instituciones.ts";
import { ObservacionNueva, Observacion, Tarea, TareaCambio, TareaNueva } from "./pedagogia.ts";
import { Salud } from "./salud.ts";

export * from "./catalogo.ts";
export * from "./identidad.ts";
export * from "./instituciones.ts";
export * from "./pedagogia.ts";
export { Salud };

// Cada entrada se exporta como schemas/<clave>.json y genera apps/api/app/contracts_gen/<clave>.py.
export const esquemas = {
  salud: Salud,
  inicio_sesion: InicioSesion,
  usuario_actual: UsuarioActual,
  cambio_clave: CambioClave,
  usuario_nuevo: UsuarioNuevo,
  usuario_creado: UsuarioCreado,
  usuario_listado: UsuarioListado,
  asignacion_nueva: AsignacionNueva,
  asignacion: Asignacion,
  estudiante_resumen: EstudianteResumen,
  clave_restablecida: ClaveRestablecida,
  ejercicio: Ejercicio,
  clase_error: ClaseError,
  tarea_nueva: TareaNueva,
  tarea_cambio: TareaCambio,
  tarea: Tarea,
  observacion_nueva: ObservacionNueva,
  observacion: Observacion,
};

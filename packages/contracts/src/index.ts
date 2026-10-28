import { CambioClave, InicioSesion, UsuarioActual } from "./identidad.ts";
import { Salud } from "./salud.ts";

export * from "./identidad.ts";
export { Salud };

// Cada entrada se exporta como schemas/<clave>.json y genera apps/api/app/contracts_gen/<clave>.py.
export const esquemas = {
  salud: Salud,
  inicio_sesion: InicioSesion,
  usuario_actual: UsuarioActual,
  cambio_clave: CambioClave,
};

import { Salud } from "./salud.ts";

export { Salud };

// Cada entrada se exporta como schemas/<clave>.json y genera apps/api/app/contracts_gen/<clave>.py.
export const esquemas = { salud: Salud };

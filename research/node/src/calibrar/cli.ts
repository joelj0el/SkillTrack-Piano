// Herramienta local para calibrar el teclado de una sesión. Uso:
//   pnpm calibrar --sesion <carpeta de paquetes de la sesión> [--puerto 5180]
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { crearServidor } from "./servidor.ts";

const { values } = parseArgs({
  options: {
    sesion: { type: "string" },
    puerto: { type: "string", default: "5180" },
  },
});

if (!values.sesion) {
  console.error("Falta --sesion <carpeta de paquetes de la sesión>");
  process.exit(2);
}
const carpeta = resolve(values.sesion);
if (!existsSync(resolve(carpeta, "calibracion"))) {
  console.error(`En ${carpeta} no hay clips de calibración: ejecuta antes la ingesta.`);
  process.exit(2);
}

crearServidor(carpeta).listen(Number(values.puerto), "127.0.0.1", () => {
  console.log(`Abre http://127.0.0.1:${values.puerto} en Chrome o Edge (Ctrl+C para terminar).`);
});

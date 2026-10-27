// Exporta cada esquema Zod a JSON Schema (entrada de la generación de modelos Pydantic).
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { esquemas } from "../src/index.ts";

const destino = new URL("../schemas/", import.meta.url);
mkdirSync(destino, { recursive: true });
for (const archivo of readdirSync(destino)) {
  if (archivo.endsWith(".json")) rmSync(new URL(archivo, destino));
}
for (const [nombre, esquema] of Object.entries(esquemas)) {
  const json = JSON.stringify(z.toJSONSchema(esquema), null, 2);
  writeFileSync(new URL(`${nombre}.json`, destino), `${json}\n`);
}

// Deja con LF los archivos de texto de una carpeta. datamodel-codegen escribe CRLF en Windows y el
// repositorio versiona LF: sin este paso, la generación dejaría cambios falsos en la copia de trabajo.
// Uso: node tools/normalizar-lf.ts <carpeta>
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export function normalizarLf(carpeta: string): void {
  for (const entrada of readdirSync(carpeta, { withFileTypes: true, recursive: true })) {
    if (!entrada.isFile()) continue;
    const ruta = join(entrada.parentPath, entrada.name);
    const texto = readFileSync(ruta, "utf8");
    if (texto.includes("\r\n")) writeFileSync(ruta, texto.replaceAll("\r\n", "\n"));
  }
}

if (import.meta.main) {
  const carpeta = process.argv[2];
  if (!carpeta) throw new Error("Uso: node tools/normalizar-lf.ts <carpeta>");
  normalizarLf(carpeta);
}

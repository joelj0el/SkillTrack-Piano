// Ejecuta Prettier solo sobre los archivos que git versiona o versionaría (respeta todas las reglas de ignorado de git).
// Uso: node tools/formato.mjs [--check | --write]
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const modo = process.argv[2] === "--write" ? "--write" : "--check";
const archivos = execFileSync(
  "git",
  ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
  {
    encoding: "utf8",
  },
)
  .split("\0")
  .filter((f) => f && existsSync(f));
const prettier = createRequire(import.meta.url).resolve("prettier/bin/prettier.cjs");

let estado = 0;
for (let i = 0; i < archivos.length; i += 200) {
  const lote = archivos.slice(i, i + 200);
  const r = spawnSync(process.execPath, [prettier, modo, "--ignore-unknown", ...lote], {
    stdio: "inherit",
  });
  estado ||= r.status ?? 1;
}
process.exit(estado);

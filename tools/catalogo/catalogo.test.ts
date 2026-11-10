import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const PRUEBA = fileURLToPath(new URL("./fixtures/PRUEBA-escala-do.musicxml", import.meta.url));

describe("herramientas del catálogo", () => {
  it("PU-catalogo-01: la partitura dibujada tiene cada nota con su digitación", () => {
    const carpeta = mkdtempSync(join(tmpdir(), "catalogo-"));
    copyFileSync(PRUEBA, join(carpeta, "EJ-01.musicxml"));
    const r = spawnSync("uv", ["run", "tools/catalogo/svg.py", carpeta], {
      cwd: raiz,
      encoding: "utf8",
    });
    expect(r.status, r.stderr).toBe(0);
    const svg = readFileSync(join(carpeta, "EJ-01.svg"), "utf8");
    expect(svg.match(/class="note"/g)).toHaveLength(58);
    expect(svg.match(/class="fing"/g)).toHaveLength(58);
  }, 180_000);

  it("PU-catalogo-02: la partitura de prueba está marcada como sintética", () => {
    expect(readFileSync(PRUEBA, "utf8")).toContain("PRUEBA SINTÉTICA");
  });
});

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const { scripts } = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
) as {
  scripts: Record<string, string>;
};
const COMANDOS = ["docs:diagrams", "docs:er", "docs:tests", "docs:trace", "docs:build"];

function ejecutar(comando: string, ...argumentos: string[]) {
  const [programa = "", ...resto] = (scripts[comando] ?? "").split(" ");
  return spawnSync(programa, [...resto, ...argumentos], { cwd: raiz, encoding: "utf8" });
}

describe("esqueletos docs:*", () => {
  it("PU-docs-01: los cinco comandos existen y apuntan a un archivo de tools/docs", () => {
    for (const comando of COMANDOS) {
      const archivo = scripts[comando]?.match(/tools\/docs\/\S+\.(mjs|py)/)?.[0];
      expect(archivo, comando).toBeDefined();
      expect(existsSync(`${raiz}${archivo}`), comando).toBe(true);
    }
  });

  it("PU-docs-02: docs:trace exige it-N y dice claramente que está pendiente", () => {
    expect(ejecutar("docs:trace", "iteracion-1").status).not.toBe(0);

    const valido = ejecutar("docs:trace", "it-1");
    expect(valido.status).toBe(0);
    expect(valido.stdout).toMatch(/pendiente: se implementa en P-06/);
  }, 120_000);

  it("PU-docs-03: docs:tests arma la tabla de PA y el resumen de PU desde los reportes JUnit", () => {
    const carpeta = mkdtempSync(join(tmpdir(), "n6-"));
    const salida = join(carpeta, "n6.md");
    const reportes = fileURLToPath(new URL("./fixtures/junit/", import.meta.url));

    const r = ejecutar("docs:tests", "it-1", "--reportes", reportes, "--salida", salida);
    expect(r.status, r.stderr).toBe(0);
    const n6 = readFileSync(salida, "utf8");

    // Un PA parametrizado con un caso fallido queda como fallido.
    expect(n6).toMatch(/\| PA-HU14-02 \| pytest \| 2 \| fallida \|/);
    expect(n6).toMatch(/\| PA-HU17-01 \| Playwright \| 1 \| aprobada \|/);
    expect(n6).toMatch(/\| core \| 1 \| 1 \| 0 \|/);
    expect(n6).toMatch(/\| identity \| 1 \| 1 \| 0 \|/);
    expect(n6).not.toContain("sin-id");
    expect(ejecutar("docs:tests", "iteracion-1").status).not.toBe(0);
  }, 120_000);
});

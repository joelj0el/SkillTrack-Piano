import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
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

  it("PU-docs-02: docs:tests y docs:trace exigen it-N y dicen claramente que están pendientes", () => {
    for (const comando of ["docs:tests", "docs:trace"]) {
      const invalido = ejecutar(comando, "iteracion-1");
      expect(invalido.status, comando).not.toBe(0);

      const valido = ejecutar(comando, "it-1");
      expect(valido.status, comando).toBe(0);
      expect(valido.stdout, comando).toMatch(/pendiente: se implementa en P-06/);
    }
  }, 120_000);
});

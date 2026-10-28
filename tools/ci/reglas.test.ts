import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { cruise, type IRuleSetType } from "dependency-cruiser";
import { ESLint } from "eslint";
import { describe, expect, it } from "vitest";

const raiz = fileURLToPath(new URL("../../", import.meta.url));
const PREFIJO = "tools/ci/fixtures/";
const configuracion = createRequire(import.meta.url)(
  "../../.dependency-cruiser.cjs",
) as IRuleSetType;

// Las reglas reales, con sus rutas ancladas (^…) desplazadas a la carpeta de fixtures. Se usa la raíz
// como baseDir para que vitest y fast-check se resuelvan igual que en el repositorio.
const reglas = JSON.parse(JSON.stringify(configuracion), (clave, valor) => {
  if (clave !== "path" && clave !== "pathNot") return valor;
  const desplazar = (patron: string) => patron.replace(/^\^/, `^${PREFIJO}`);
  return Array.isArray(valor) ? valor.map(desplazar) : desplazar(valor);
}) as IRuleSetType;

async function violaciones(archivos: string[]): Promise<string[]> {
  const { output } = await cruise(
    archivos.map((archivo) => PREFIJO + archivo),
    {
      baseDir: raiz,
      validate: true,
      ruleSet: reglas,
      tsPreCompilationDeps: true,
      doNotFollow: { path: "node_modules" },
    },
  );
  if (typeof output === "string") throw new Error(output);
  return output.summary.violations.map(
    ({ rule, from }) => `${rule.name} ${from.slice(PREFIJO.length)}`,
  );
}

describe("dependency-cruiser", () => {
  it("PU-ci-01: el código del núcleo no puede importar módulos de Node ni paquetes npm", async () => {
    const resultado = await violaciones([
      "packages/core/src/usa-fs.ts",
      "packages/core/src/usa-fast-check.ts",
    ]);

    expect(resultado).toContain("nucleo-puro packages/core/src/usa-fs.ts");
    expect(resultado).toContain("nucleo-puro packages/core/src/usa-fast-check.ts");
  });

  it("PU-ci-02: los contratos no pueden importar el núcleo", async () => {
    const resultado = await violaciones(["packages/contracts/src/usa-core.ts"]);

    expect(resultado).toContain("contratos-hoja packages/contracts/src/usa-core.ts");
  });

  it("PU-ci-04: una prueba del núcleo puede importar vitest y fast-check, y el núcleo puede importar los contratos", async () => {
    const resultado = await violaciones(["packages/core/src/propiedad.test.ts"]);

    expect(resultado).toEqual([]);
  });
});

describe("ESLint en el núcleo", () => {
  const codigo = [
    "export const a = Date.now();",
    "export const b = Math.random();",
    "export const c = performance.now();",
    "export const d = new Date();",
    "setTimeout(() => {}, 1);",
  ].join("\n");

  async function erroresDePureza(filePath: string): Promise<number> {
    const [resultado] = await new ESLint({ cwd: raiz }).lintText(codigo, { filePath });
    return (resultado?.messages ?? []).filter((m) => m.ruleId?.startsWith("no-restricted-")).length;
  }

  it("PU-ci-03: el núcleo no usa reloj, temporizadores ni azar sin inyectar; fuera del núcleo sí se permite", async () => {
    expect(await erroresDePureza("packages/core/src/sonda.ts")).toBeGreaterThanOrEqual(5);
    expect(await erroresDePureza("packages/contracts/src/sonda.ts")).toBe(0);
  }, 30_000);
});

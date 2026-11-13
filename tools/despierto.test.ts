import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ESTADO_DESPIERTO, guardianWindows } from "./despierto.ts";

describe("mantener el equipo despierto durante las pruebas", () => {
  it("PU-ci-07: en Windows pide no suspender ni apagar la pantalla mientras viva el proceso", () => {
    // ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED
    expect(ESTADO_DESPIERTO).toBe(0x80000003);
    const guion = guardianWindows(1234);
    // En decimal y como uint32: Windows PowerShell 5.1 lee 0x80000003 como entero con signo.
    expect(guion).toContain("SetThreadExecutionState([uint32]2147483651)");
    expect(guion).toContain("Get-Process -Id 1234");
  });

  it("PU-ci-08: devuelve el código de salida del comando que envuelve", () => {
    const carpeta = mkdtempSync(join(tmpdir(), "despierto-"));
    const script = join(carpeta, "sale.mjs");
    writeFileSync(script, "process.exit(3);");
    const r = spawnSync(process.execPath, ["tools/despierto.ts", script, "x"], {
      encoding: "utf8",
    });
    expect(r.status).toBe(3);
  });

  it("PU-ci-09: Vitest y las E2E corren sin que el equipo entre en espera", () => {
    // La espera moderna detiene los workers a mitad de una prueba: la prueba "dura" lo que dura
    // la espera y agota su límite de tiempo aunque no tenga ningún problema.
    const { scripts } = JSON.parse(readFileSync("package.json", "utf8"));
    expect(scripts.test).toMatch(
      /^node .*tools\/despierto\.ts node_modules\/vitest\/vitest\.mjs run/,
    );
    expect(scripts.e2e).toMatch(/tools\/despierto\.ts /);
  });

  it("PU-ci-10: Vitest usa como mucho la mitad de los núcleos", async () => {
    // Con un worker por núcleo, en un equipo cargado (o a batería) los workers no alcanzan a
    // arrancar a tiempo y Vitest los da por perdidos aunque ninguna prueba falle.
    const { default: config } = await import("../vitest.config.ts");
    expect(config.test?.maxWorkers).toBe("50%");
    // El proyecto web declara el mismo valor: Vitest no admite valores distintos por proyecto.
    expect(readFileSync("apps/web/vite.config.ts", "utf8")).toMatch(/maxWorkers: "50%"/);
  });
});

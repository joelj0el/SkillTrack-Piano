import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const flujo = readFileSync(new URL("../.github/workflows/deploy.yml", import.meta.url), "utf8");

describe("flujo de despliegue", () => {
  it("PU-infra-09: solo se ejecuta con el botón y nunca dos a la vez", () => {
    const disparadores = flujo.slice(flujo.indexOf("\non:"), flujo.indexOf("\npermissions:"));
    expect(disparadores.trim()).toBe("on:\n  workflow_dispatch:");
    expect(flujo).toMatch(/concurrency:\n {2}group: despliegue\n {2}cancel-in-progress: false/);
  });

  it("PU-infra-10: migra antes de levantar la versión nueva y comprueba que responde", () => {
    const pasos = ["pull", "run --rm api alembic upgrade head", "up -d"].map((p) =>
      flujo.indexOf(`docker compose -f docker-compose.prod.yml ${p}`),
    );
    expect(pasos.every((p) => p > 0)).toBe(true);
    expect([...pasos].sort((a, b) => a - b)).toEqual(pasos);
    expect(flujo).toMatch(/curl --fail .*\/api\/health/);
  });

  it("PU-infra-11: las acciones van fijadas por commit y el permiso de escribir paquetes es solo de la construcción", () => {
    for (const [, referencia] of flujo.matchAll(/uses: \S+@(\S+)/g)) {
      expect(referencia).toMatch(/^[0-9a-f]{40}$/);
    }
    expect(flujo.match(/packages: write/g)).toHaveLength(1);
    expect(flujo.indexOf("packages: write")).toBeLessThan(flujo.indexOf("\n  desplegar:"));
  });

  it("PU-infra-12: la clave SSH viene de los secretos y el servidor se verifica por su huella", () => {
    expect(flujo).toContain("${{ secrets.SSH_CLAVE }}");
    expect(flujo).toContain("~/.ssh/known_hosts");
    expect(flujo).not.toMatch(/StrictHostKeyChecking=no/);
  });
});

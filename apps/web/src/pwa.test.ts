import { describe, expect, it } from "vitest";
import { opcionesPwa } from "./pwa.ts";

describe("configuración de la PWA", () => {
  it("PU-web-03: el manifiesto cumple los campos de instalación", () => {
    const manifiesto = opcionesPwa.manifest;
    if (!manifiesto) throw new Error("sin manifiesto");

    expect(manifiesto.name).toBe("SkillTrack-Piano");
    expect(manifiesto.short_name).toBeTruthy();
    expect(manifiesto.start_url).toBe("/");
    expect(manifiesto.display).toBe("standalone");
    const tamanos = manifiesto.icons?.map((i) => i.sizes) ?? [];
    expect(tamanos).toContain("192x192");
    expect(tamanos).toContain("512x512");
  });

  it("PU-web-04: el fallback de navegación del service worker no captura /api", () => {
    const excluidas = opcionesPwa.workbox?.navigateFallbackDenylist ?? [];

    expect(excluidas.some((patron) => patron.test("/api/health"))).toBe(true);
    expect(excluidas.some((patron) => patron.test("/tareas"))).toBe(false);
  });
});

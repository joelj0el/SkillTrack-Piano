/**
 * PA-HU06-01: pruebas golden del diagnóstico con la plantilla de reglas v1 publicada. Cada
 * fixture es un intento SINTÉTICO (origen "sintetico") con las clases e indicadores esperados.
 */
import { describe, expect, it } from "vitest";
import type { BandaDeReferencia } from "./desviaciones.ts";
import { diagnosticar, type EventoDiagnosticable, type ReglasMotor } from "./reglas.ts";

declare global {
  interface ImportMeta {
    glob(patrones: string[], opciones: object): Record<string, unknown>;
  }
}

interface Golden {
  origen: string;
  nombre: string;
  modo: "V" | "A" | "VA";
  cambio_tempo_pct: number | null;
  bandas_uniformes: Record<string, [number, number]>;
  eventos: EventoDiagnosticable[];
  esperado: { clases: string[]; indicadores: string[]; eventos?: Record<string, number[]> };
}

// Vitest resuelve los JSON al cargar la prueba; el núcleo no lee archivos.
const fixtures = Object.entries(
  import.meta.glob(["../../fixtures/golden/*.json"], { eager: true, import: "default" }),
)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([, g]) => g as Golden);
const [REGLAS] = Object.values(
  import.meta.glob(["../../../../tools/catalogo/conjunto_reglas.v1.json"], {
    eager: true,
    import: "default",
  }),
) as ReglasMotor[];

/** Las bandas uniformes se repiten en cada evento; cambio_tempo.pct es de toda la ejecución. */
function bandas(g: Golden): BandaDeReferencia[] {
  return Object.entries(g.bandas_uniformes).flatMap(([rasgo, [inferior, superior]]) => {
    const unidades =
      rasgo === "cambio_tempo.pct" ? ["ejecucion"] : g.eventos.map((e) => `e${e.idx}`);
    const centro = (inferior + superior) / 2;
    return unidades.map((unidad) => ({ unidad, rasgo, inferior, superior, centro }));
  });
}

describe("golden del diagnóstico (plantilla de reglas v1)", () => {
  it("PA-HU06-01: cada fixture golden es sintética y el diagnóstico da exactamente sus clases e indicadores", () => {
    expect(REGLAS?.version).toBe(1);
    expect(fixtures.length).toBeGreaterThanOrEqual(8);
    for (const g of fixtures) {
      expect(g.origen, g.nombre).toBe("sintetico");
      const r = diagnosticar({
        eventos: g.eventos,
        cambioTempoPct: g.cambio_tempo_pct,
        referencia: { version: 1, bandas: bandas(g) },
        reglas: REGLAS!,
        modo: g.modo,
      });
      const indicadores = [...new Set(r.diagnosticos.map((d) => d.indicador))].sort();
      const clases = [...new Set(r.diagnosticos.map((d) => d.clase))].sort();
      expect({ clases, indicadores }, g.nombre).toEqual({
        clases: [...g.esperado.clases].sort(),
        indicadores: [...g.esperado.indicadores].sort(),
      });
      for (const [indicador, eventos] of Object.entries(g.esperado.eventos ?? {})) {
        const d = r.diagnosticos.filter((x) => x.indicador === indicador);
        expect(d.flatMap((x) => x.eventos).sort(), `${g.nombre} ${indicador}`).toEqual(eventos);
      }
    }
  });
});

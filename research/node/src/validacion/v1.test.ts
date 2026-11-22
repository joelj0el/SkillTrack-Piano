import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { prepararEsquema, type Base } from "../ingesta/registro.ts";
import { tomasParaV1 } from "./consulta.ts";
import { evento, resultado } from "./sinteticos.ts";
import { leerAnotacionVisual, midiDe, v1Visual, type TomaV1 } from "./v1.ts";
import { tablaV1Visual } from "./v1-informe.ts";

// Datos SINTÉTICOS: eventos y anotaciones inventados (ninguna grabación).
const PLANTILLA = resolve(import.meta.dirname, "../../../plantillas/v1-visual.csv");

const toma = (codigo: string, cambios: Partial<TomaV1> = {}): TomaV1 => ({
  codigo_toma: codigo,
  origen: "real",
  instrumento: "digital",
  resultado: resultado(
    codigo,
    [0, 1, 2, 3].map((i) => evento(i)),
  ),
  tiempo: { proceso_s: 20, video_s: 10 },
  ...cambios,
});

describe("V1 visual", () => {
  it("PU-research-80: la plantilla de anotación visual se lee y las teclas se escriben como Do4, Fa#3 o MIDI", () => {
    const filas = leerAnotacionVisual(readFileSync(PLANTILLA, "utf8"));
    expect(filas.length).toBeGreaterThan(0);
    expect(filas[0]).toMatchObject({ nota: 1, mano: "MD", dedo: 1, tecla: 60 });
    expect([midiDe("Do4"), midiDe("Fa#3"), midiDe("Sib2"), midiDe("C4"), midiDe("61")]).toEqual([
      60, 54, 46, 60, 61,
    ]);
    expect(midiDe("")).toBeNull();
    expect(() => midiDe("Dox")).toThrow(/ilegible/);
    expect(() => leerAnotacionVisual("codigo_toma,nota,mano,dedo,tecla\nT1,1,XX,1,Do4")).toThrow(
      /MI o MD/,
    );
  });

  it("PU-research-81: exactitud dedo–tecla y de digitación contra la anotación, sin contar lo que no se ve", () => {
    const tomas = [
      toma("T1", {
        resultado: resultado("T1", [
          evento(0),
          // El análisis vio el dedo 3 en la tecla correcta: dedo equivocado, digitación incorrecta.
          evento(1, { dedo: { valor: 3, estado: "incorrecto", modalidad: "V" } }),
          // Sin evento visual: no vio ni dedo ni tecla.
          evento(2, {
            dedo: { valor: null, estado: "no-detectado", modalidad: null },
            tecla: { midi: null, zona: null, modalidad: null },
          }),
          evento(3),
        ]),
      }),
    ];
    const anotadas = [
      { codigo_toma: "T1", nota: 1, mano: "MD" as const, dedo: 2, tecla: 60 },
      // El anotador vio el dedo 2 (el esperado): el análisis se equivocó.
      { codigo_toma: "T1", nota: 2, mano: "MD" as const, dedo: 2, tecla: 61 },
      { codigo_toma: "T1", nota: 3, mano: "MD" as const, dedo: 2, tecla: 62 },
      // No se ve el dedo: solo cuenta para la tecla.
      { codigo_toma: "T1", nota: 4, mano: "MD" as const, dedo: null, tecla: 63 },
    ];
    const [fila] = v1Visual(tomas, anotadas);
    expect(fila!.dedo_tecla).toEqual({ n: 3, aciertos: 1 });
    expect(fila!.tecla).toEqual({ n: 4, aciertos: 3 });
    expect(fila!.dedo).toEqual({ n: 3, aciertos: 1 });
    expect(fila!.digitacion).toEqual({ n: 2, aciertos: 1, no_detectadas: 1 });
    expect(fila!.sin_evento_visual).toBe(1);
    expect(fila!.notas).toBe(4);
  });

  it("PU-research-82: % de tomas válidas, tiempo de extracción y todo separado por origen", () => {
    const tomas = [
      toma("T1"),
      toma("T2", { resultado: resultado("T2", [evento(0)], { final: false }) }),
      toma("T3", { resultado: null, tiempo: null }),
      toma("A1", {
        origen: "actuado",
        resultado: resultado("A1", [evento(0)], { origen: "actuado" }),
        tiempo: { proceso_s: 40, video_s: 10 },
      }),
    ];
    const filas = v1Visual(tomas, []);
    expect(filas.map((f) => f.origen)).toEqual(["actuado", "real"]);
    const real = filas.find((f) => f.origen === "real")!;
    expect([real.tomas, real.validas, real.sin_reprocesar]).toEqual([3, 1, 1]);
    expect(real.extraccion).toEqual({ n: 2, mediana_s: 20, maximo_s: 20, por_s_video: 2 });
    const tabla = tablaV1Visual(filas);
    expect(tabla).toContain("## Origen: real");
    expect(tabla).toContain("33.3 %");
    // Menos de 10 tomas anotadas: aviso explícito.
    expect(tabla).toMatch(/n chico: 0 tomas anotadas \(< 10\)/);
  });

  it("PU-research-83: la consulta de V1 trae todas las tomas del ejercicio, también las no evaluables, con su instrumento", async () => {
    const pg = new PGlite();
    const base: Base = { consulta: (sql, p) => pg.query(sql, p) as ReturnType<Base["consulta"]> };
    await prepararEsquema(base);
    await base.consulta(
      `INSERT INTO participante VALUES ('P01', 'I', 'estudiante', null, null, null)`,
    );
    await base.consulta(
      `INSERT INTO sesion_grabacion (fecha, instrumento) VALUES ('2026-11-09', 'acustico')`,
    );
    for (const [codigo, evaluable, version] of [
      ["T1", true, "EJ-01@1"],
      ["T2", false, "EJ-01@1"],
      ["T3", true, "EJ-02@1"],
    ] as const) {
      await base.consulta(
        `INSERT INTO ejecucion (codigo_toma, participante, version_ejercicio, sesion, campana, manos,
           tempo_elegido_bpm, modo_metronomo, paquete_sha256, ruta, evaluable, origen)
         VALUES ($1, 'P01', $2, 1, 'A', 'MD', 60, 'sin', 'x', '/r/' || $1, $3, 'real')`,
        [codigo, version, evaluable],
      );
    }
    expect(await tomasParaV1(base, "EJ-01@1")).toEqual([
      { codigo_toma: "T1", origen: "real", instrumento: "acustico", ruta: "/r/T1" },
      { codigo_toma: "T2", origen: "real", instrumento: "acustico", ruta: "/r/T2" },
    ]);
    await pg.close();
  });
});

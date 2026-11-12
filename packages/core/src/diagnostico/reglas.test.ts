import { describe, expect, it } from "vitest";
import type { BandaDeReferencia } from "./desviaciones.ts";
import {
  diagnosticar,
  type EventoDiagnosticable,
  type ReglaMotor,
  type ReglasMotor,
} from "./reglas.ts";

// Vitest (Vite) resuelve import.meta.glob al cargar la prueba; el núcleo no tiene sus tipos.
declare global {
  interface ImportMeta {
    glob(patrones: string[], opciones: object): Record<string, unknown>;
  }
}

// Datos SINTÉTICOS: reglas, bandas y eventos inventados para probar cada frontera.
const PENDIENTE = "pendiente de aprobación del panel";

function conjunto(reglas: ReglaMotor[], noEvaluables: string[] = []): ReglasMotor {
  const indicadores: ReglasMotor["indicadores"] = {};
  for (const r of reglas) {
    indicadores[r.indicador] = {
      clase: `ER-${r.indicador.charAt(4)}`,
      evaluable: true,
      motivo_no_evaluable: null,
      mensaje: PENDIENTE,
    };
  }
  for (const codigo of noEvaluables) {
    indicadores[codigo] = {
      clase: `ER-${codigo.charAt(4)}`,
      evaluable: false,
      motivo_no_evaluable: "No evaluable por diseño: sin rasgo",
      mensaje: PENDIENTE,
    };
  }
  return { version: 1, indicadores, reglas };
}

function evento(idx: number, cambios: Partial<EventoDiagnosticable> = {}): EventoDiagnosticable {
  return {
    idx,
    mano: "MD",
    estado: "evaluado",
    ataque_ms: idx * 250,
    modalidad: "VA",
    nota: { estado: "correcta" },
    dedo: { estado: "correcto" },
    desfase_manos: null,
    tecla: { zona: null },
    rasgos: {},
    ...cambios,
  };
}

const zona = (idx: number, inferior: number, superior: number): BandaDeReferencia => ({
  unidad: `e${idx}`,
  rasgo: "tecla.zona",
  inferior,
  superior,
  centro: (inferior + superior) / 2,
});

const R_A1: ReglaMotor = {
  id: "R-A1-01",
  indicador: "IND-A1",
  alcance: "evento",
  modalidad: "A",
  condicion: { tipo: "estado", dato: "nota", valores: ["incorrecta", "faltante"] },
  minimo_eventos: 1,
};
const R_D2: ReglaMotor = {
  id: "R-D2-01",
  indicador: "IND-D2",
  alcance: "evento",
  modalidad: "V",
  condicion: { tipo: "fuera_de_banda", rasgo: "tecla.zona", lado: "debajo" },
  minimo_eventos: 2,
};
const R_B1: ReglaMotor = {
  id: "R-B1-01",
  indicador: "IND-B1",
  alcance: "intento",
  modalidad: "A",
  condicion: { tipo: "fuera_de_banda", rasgo: "cambio_tempo.pct", lado: "cualquiera" },
};
const bandaTempo: BandaDeReferencia = {
  unidad: "ejecucion",
  rasgo: "cambio_tempo.pct",
  inferior: -3,
  superior: 3,
  centro: 0,
};

function correr(
  reglas: ReglasMotor,
  eventos: EventoDiagnosticable[],
  bandas: BandaDeReferencia[] = [],
  cambioTempoPct: number | null = null,
) {
  return diagnosticar({
    eventos,
    cambioTempoPct,
    referencia: { version: 3, bandas },
    reglas,
  });
}

describe("motor de reglas", () => {
  it("PU-diagnostico-06: regla de estado: una nota incorrecta dispara IND-A1 con su evento; todas correctas, sin error", () => {
    const r = correr(conjunto([R_A1]), [evento(0), evento(1, { nota: { estado: "incorrecta" } })]);
    expect(r.diagnosticos).toEqual([
      { indicador: "IND-A1", clase: "ER-A", regla: "R-A1-01", eventos: [1], mensaje: PENDIENTE },
    ]);
    expect(r.indicadores["IND-A1"]).toEqual({ estado: "detectado", motivo: null });
    const bien = correr(conjunto([R_A1]), [evento(0), evento(1)]);
    expect(bien.diagnosticos).toEqual([]);
    expect(bien.indicadores["IND-A1"]!.estado).toBe("sin-error");
  });

  it("PU-diagnostico-07: frontera de banda y de mínimo de eventos: en el borde no dispara; con un solo evento fuera, tampoco (mínimo 2)", () => {
    const bandas = [zona(0, 0.2, 0.6), zona(1, 0.2, 0.6), zona(2, 0.2, 0.6)];
    const conZona = (z: number[]) => z.map((v, i) => evento(i, { tecla: { zona: v } }));
    // En el borde inferior: dentro.
    expect(correr(conjunto([R_D2]), conZona([0.2, 0.2, 0.2]), bandas).diagnosticos).toEqual([]);
    // Uno fuera: no alcanza el mínimo.
    const uno = correr(conjunto([R_D2]), conZona([0.19, 0.3, 0.3]), bandas);
    expect(uno.indicadores["IND-D2"]!.estado).toBe("sin-error");
    // Dos fuera: dispara con esos dos eventos.
    const dos = correr(conjunto([R_D2]), conZona([0.19, 0.3, 0.1]), bandas);
    expect(dos.diagnosticos[0]).toMatchObject({ regla: "R-D2-01", eventos: [0, 2] });
    // Por encima de la banda no es el lado de D2.
    expect(correr(conjunto([R_D2]), conZona([0.9, 0.9, 0.9]), bandas).diagnosticos).toEqual([]);
  });

  it("PU-diagnostico-08: regla de intento: el cambio de tempo justo en el borde no dispara; apenas fuera, sí y sin eventos", () => {
    expect(correr(conjunto([R_B1]), [evento(0)], [bandaTempo], 3).diagnosticos).toEqual([]);
    const fuera = correr(conjunto([R_B1]), [evento(0)], [bandaTempo], -3.01);
    expect(fuera.diagnosticos).toEqual([
      { indicador: "IND-B1", clase: "ER-B", regla: "R-B1-01", eventos: [], mensaje: PENDIENTE },
    ]);
  });

  it("PU-diagnostico-09: sin banda o sin referencia, el indicador es no evaluable, nunca un diagnóstico dudoso", () => {
    const sinBanda = correr(conjunto([R_D2]), [evento(0, { tecla: { zona: 0.01 } })], []);
    expect(sinBanda.indicadores["IND-D2"]).toEqual({
      estado: "no-evaluable",
      motivo: "La referencia no tiene banda para tecla.zona",
    });
    const sinReferencia = diagnosticar({
      eventos: [evento(0)],
      cambioTempoPct: 10,
      referencia: null,
      reglas: conjunto([R_B1]),
    });
    expect(sinReferencia.diagnosticos).toEqual([]);
    expect(sinReferencia.version_referencia).toBeNull();
    expect(sinReferencia.indicadores["IND-B1"]).toEqual({
      estado: "no-evaluable",
      motivo: "Sin referencia publicada",
    });
  });

  it("PU-diagnostico-10: un indicador no evaluable por diseño se informa con su motivo", () => {
    const r = correr(conjunto([R_A1], ["IND-E1"]), [evento(0)]);
    expect(r.indicadores["IND-E1"]).toEqual({
      estado: "no-evaluable",
      motivo: "No evaluable por diseño: sin rasgo",
    });
  });

  it("PU-diagnostico-11: los eventos no evaluables y los datos sin medir no cuentan", () => {
    const r = correr(conjunto([R_A1]), [
      evento(0, { estado: "no-evaluable", nota: { estado: "incorrecta" } }),
      evento(1),
    ]);
    expect(r.diagnosticos).toEqual([]);
    const sinDedo: ReglaMotor = {
      id: "R-C1-01",
      indicador: "IND-C1",
      alcance: "evento",
      modalidad: "V",
      condicion: { tipo: "estado", dato: "dedo", valores: ["incorrecto"] },
      minimo_eventos: 1,
    };
    const ciego = correr(conjunto([sinDedo]), [evento(0, { dedo: { estado: "no-detectado" } })]);
    expect(ciego.indicadores["IND-C1"]).toEqual({
      estado: "no-evaluable",
      motivo: "Sin datos de dedo",
    });
  });
});

describe("el diagnóstico no usa aprendizaje automático", () => {
  it("PU-diagnostico-12: el módulo solo importa código del núcleo y no menciona modelos ni clasificadores", () => {
    const fuentes = import.meta.glob(["./*.ts", "!./*.test.ts"], {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>;
    expect(Object.keys(fuentes).length).toBeGreaterThan(0);
    for (const [archivo, codigo] of Object.entries(fuentes)) {
      const importaciones = [...codigo.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]!);
      for (const origen of importaciones) expect(origen, archivo).toMatch(/^\.\.?\//);
      expect(codigo, archivo).not.toMatch(
        /onnx|tflite|mediapipe|tensorflow|clasificador|import\(/i,
      );
    }
  });
});

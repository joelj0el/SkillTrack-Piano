import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { ConjuntoReglas, ResultadoReproceso, type EventoResultado } from "@skilltrack/contracts";
import { describe, expect, it } from "vitest";
import { CLASES_ERROR } from "../ingesta/validar.ts";
import type { FilaEtiqueta } from "../validacion/etiquetas.ts";
import { exportarEjecuciones } from "./exportar.ts";

// Datos SINTÉTICOS: una toma inventada y sus etiquetas.
const REGLAS = ConjuntoReglas.parse(
  JSON.parse(
    readFileSync(
      resolve(import.meta.dirname, "../../../../tools/catalogo/conjunto_reglas.v1.json"),
      "utf8",
    ),
  ),
);

function evento(idx: number, cambios: Partial<EventoResultado> = {}): EventoResultado {
  return {
    idx,
    mano: "MD",
    midi_esperado: 60 + idx,
    dedo_esperado: 2,
    estado: "evaluado",
    motivo: null,
    ataque_ms: idx * 250,
    modalidad: "VA",
    nota: {
      estado: "correcta",
      midi: 60 + idx,
      clase_oida: idx % 12,
      modalidad: "VA",
    },
    dedo: { valor: 2, estado: "correcto", modalidad: "V" },
    tecla: { midi: 60 + idx, zona: 0.3, modalidad: "V" },
    desfase_manos: null,
    rasgos: {},
    rasgos_modalidad: null,
    ...cambios,
  };
}

const sha = "0".repeat(64);
const resultado = ResultadoReproceso.parse({
  version: 1,
  codigo_toma: "E01-R1",
  origen: "real",
  versiones: {
    nucleo: "0.9.0",
    modelo_mano: "m@1",
    ejercicio: "EJ-01@1",
    referencia: null,
    reglas: null,
    clasificador: null,
    reprocesamiento: "1.2.0",
  },
  secuencia_esperada: "partitura",
  calibracion: { sesion: "s", clip: "CAL-digital-1" },
  video: {
    archivo: "v.mp4",
    sha256: sha,
    codec_video: "h264",
    codec_audio: "aac",
    ancho: 1280,
    alto: 720,
    duracion_s: 10,
  },
  deteccion: { delegado: "CPU", fotogramas: 300, con_manos: 300, perdidos: 0 },
  landmarks_sha256: sha,
  audio_events_sha256: sha,
  analisis: {
    notas: [],
    visuales: [],
    acustico: { tempo: { cambioPct: 2 } },
    eventos: [
      evento(0),
      evento(1, {
        nota: { estado: "incorrecta", midi: 65, clase_oida: 5, modalidad: "A" },
      }),
      evento(2, { dedo: { valor: 3, estado: "incorrecto", modalidad: "V" } }),
      evento(3),
    ],
  },
  porcentaje_evaluable: 100,
  evaluable: { planilla: true, analisis: true, final: true },
});

const doble = (clase: string, a: boolean, b: boolean): FilaEtiqueta[] => [
  {
    codigo_toma: "E01-R1",
    etiquetador: "ETQ-1",
    clase_error: clase,
    presente: a,
    ronda: "doble",
  },
  {
    codigo_toma: "E01-R1",
    etiquetador: "ETQ-2",
    clase_error: clase,
    presente: b,
    ronda: "doble",
  },
];

describe("exportación para el dataset", () => {
  it("PU-research-79: cada ejecución sale con seudónimo, origen, diagnóstico de las reglas y etiquetas, sin rutas ni video", () => {
    const [fila] = exportarEjecuciones(
      [
        {
          codigo_toma: "E01-R1",
          sujeto: "E01",
          origen: "real",
          version_ejercicio: "EJ-01@1",
          resultado,
        },
      ],
      [...doble("ER-A", true, true), ...doble("ER-C", true, false)],
      {
        version: 1,
        bandas: [0, 1, 2, 3].map((i) => ({
          unidad: `e${i}`,
          rasgo: "tecla.zona",
          inferior: 0.2,
          superior: 0.6,
          centro: 0.4,
        })),
      },
      REGLAS,
      CLASES_ERROR,
    );
    expect(fila!.sujeto).toBe("E01");
    expect(fila!.origen).toBe("real");
    expect(fila!.reglas.clases).toEqual(["ER-A", "ER-C"]);
    expect(fila!.etiquetas).toEqual({ "ER-A": true, "ER-C": null });
    expect(fila!.juicios_dobles).toEqual({
      "ER-A": [true, true],
      "ER-C": [true, false],
    });
    expect(fila!.eventos[1]).toMatchObject({
      nota: "incorrecta",
      nota_midi: 65,
      tecla_midi: 61,
    });
    const zona = fila!.desviaciones.find((d) => d.rasgo === "tecla.zona")!;
    expect(zona).toMatchObject({
      posicion: "dentro",
      inferior: 0.2,
      superior: 0.6,
    });
    const texto = JSON.stringify(fila);
    for (const prohibido of ["ruta", "sha256", "video", "landmarks", ".mp4"]) {
      expect(texto).not.toContain(prohibido);
    }
  });
});

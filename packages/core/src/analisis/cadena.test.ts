import { describe, expect, it } from "vitest";
import { secuencia } from "../audio/sintesis.ts";
import { secuenciaEscala } from "../ejercicio/escala.ts";
import { homografia } from "../geometria/homografia.ts";
import {
  analizar,
  crearAsignador,
  fraccionEvaluable,
  muestrasDelFotograma,
  type MuestraMano,
  type RespuestaAnalisis,
} from "./cadena.ts";

const manoEn = (x: number, z = 0) => Array.from({ length: 21 }, () => ({ x, y: 0.5, z }));

describe("cadena compartida por la app y el reprocesamiento", () => {
  it("PU-cadena-01: la mano de la izquierda de la imagen es la izquierda, salvo en espejo", () => {
    const directa = crearAsignador(() => false)([manoEn(0.8), manoEn(0.2)]);
    expect(directa.MI?.datos[0]?.x).toBe(0.2);
    const espejo = crearAsignador(() => true)([manoEn(0.8), manoEn(0.2)]);
    expect(espejo.MI?.datos[0]?.x).toBe(0.8);
  });

  it("PU-cadena-02: cada mano da la altura relativa de cada punta y su posición en píxeles", () => {
    const m = manoEn(0.5).map((p, i) => ({ ...p, x: i === 5 ? 0.4 : i === 17 ? 0.6 : p.x }));
    m[8] = { x: 0.25, y: 0.5, z: -0.1 };
    const s = muestrasDelFotograma({ MD: { datos: m } }, 1000, 500, 2);
    expect(s.MI).toBeUndefined();
    expect(s.MD?.t).toBe(2);
    expect(s.MD?.puntas.indice).toEqual({ x: 250, y: 250 });
    expect(s.MD?.alturas.indice).toBeCloseTo(0.5, 6);
  });

  it("PU-cadena-03: con audio cuentan las notas oídas; sin audio, las vistas", () => {
    const visual = (estado: "detectada" | "no-evaluable") =>
      ({
        idx: 0,
        mano: "MD",
        midiEsperado: 60,
        resultado:
          estado === "detectada"
            ? { estado, dedo: "indice", t: 0 }
            : { estado, motivo: "sin evento visual" },
      }) as RespuestaAnalisis["notas"][number];
    const base = { visuales: [], duracionAnalisisMs: 0, porMano: null, eventos: [] };
    const sinAudio: RespuestaAnalisis = {
      ...base,
      acustico: null,
      notas: [
        visual("detectada"),
        visual("no-evaluable"),
        visual("detectada"),
        visual("detectada"),
      ],
    };
    expect(fraccionEvaluable(sinAudio)).toBe(0.75);
    const conAudio: RespuestaAnalisis = {
      ...base,
      notas: [visual("no-evaluable")],
      acustico: {
        ataques: [],
        oidas: [],
        tempo: null,
        fusion: [],
        notas: {
          extras: [],
          esperadas: [
            { estado: "correcta", t: 0 },
            { estado: "dudosa", t: 1 },
          ],
        },
      },
    };
    expect(fraccionEvaluable(conAudio)).toBe(0.5);
    expect(fraccionEvaluable({ ...base, acustico: null, notas: [] })).toBe(0);
  });

  it("PU-cadena-04: cada ataque oído conserva su croma y su clase", () => {
    const esperadas = secuenciaEscala("Do mayor", "MD").slice(0, 4);
    const tasa = 22050;
    const muestras = secuencia(
      esperadas.map((n, i) => ({ midi: n.midi, t: 0.2 + i * 0.5 })),
      2.5,
      tasa,
    );
    const identidad = homografia(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
    );
    const { acustico } = analizar(
      {
        series: {},
        calibracion: identidad,
        rango: { min: 60, max: 72 },
        esperadas,
        audio: { muestras, tasa, t0: 1 },
      },
      () => 0,
    );
    expect(acustico?.oidas.length).toBe(acustico?.ataques.length);
    const primera = acustico!.oidas[0]!;
    expect(primera.t).toBe(acustico!.ataques[0]);
    expect(primera.croma).toHaveLength(12);
    expect(primera.clase).toBe(0);
  });
});

describe("análisis al terminar la ejecución", () => {
  it("PU-capture-12: un índice que baja sobre Re4 produce esa nota con el dedo detectado", () => {
    const esperadas = secuenciaEscala("Do mayor", "MD").slice(0, 2); // Do4, Re4
    // Plano del teclado = imagen (calibración identidad sobre el tramo Do4–Do6).
    const identidad = homografia(
      [
        { x: 0, y: 0 },
        { x: 15, y: 0 },
        { x: 0, y: 1 },
        { x: 15, y: 1 },
      ],
      [
        { x: 0, y: 0 },
        { x: 15, y: 0 },
        { x: 0, y: 1 },
        { x: 15, y: 1 },
      ],
    );
    const serie: MuestraMano[] = [1, 0.9, 0.8, 0.9, 1].map((altura, i) => ({
      t: i / 10,
      alturas: { indice: altura },
      puntas: { indice: { x: 1.5, y: 0.5 } }, // segunda blanca del tramo: Re4
    }));

    const r = analizar(
      { series: { MD: serie }, calibracion: identidad, rango: { min: 60, max: 84 }, esperadas },
      () => 0,
    );

    expect(r.notas[1]!.resultado).toEqual({ estado: "detectada", dedo: "indice", t: 0.2 });
    expect(r.notas[0]!.resultado.estado).toBe("no-evaluable");
  });
});

describe("análisis con audio", () => {
  it("PU-capture-13: una escala sintética a 44,1 kHz se oye correcta, con tempo estable", () => {
    const esperadas = secuenciaEscala("Do mayor", "MD").slice(0, 8);
    const tasa = 44100;
    const senal = secuencia(
      esperadas.map((n, i) => ({ midi: n.midi, t: 0.3 + i * 0.25 })),
      2.6,
      tasa,
    );
    const r = analizar(
      {
        series: {},
        audio: { muestras: senal, tasa, t0: 4 },
        metronomo: "sin",
        tempoElegido: 60,
        calibracion: homografia(
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
          ],
          [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: 1, y: 1 },
          ],
        ),
        rango: { min: 60, max: 84 },
        esperadas,
      },
      () => 0,
    );
    const acustico = r.acustico!;
    expect(acustico.notas.esperadas.map((n) => n.estado)).toEqual(new Array(8).fill("correcta"));
    expect(acustico.ataques[0]).toBeCloseTo(4.3, 1);
    expect(acustico.tempo?.estado).toBe("estable");
    expect(acustico.tempo?.tempoInicial).toBeCloseTo(60, 0);
    // Sin eventos visuales, cada ataque queda solo con audio.
    expect(acustico.fusion.every((f) => f.modalidad === "A")).toBe(true);
    // Registro v2: uno por nota esperada; sin cámara, la nota es solo audio y no hay dedo.
    expect(r.eventos).toHaveLength(8);
    expect(r.eventos.every((e) => e.nota.estado === "correcta" && e.nota.modalidad === "A")).toBe(
      true,
    );
    expect(r.eventos.every((e) => e.dedo.estado === "no-detectado")).toBe(true);
  });
});

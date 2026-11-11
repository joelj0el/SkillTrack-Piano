import { z } from "zod";
import { Manos } from "./catalogo.ts";

/**
 * ResultadoIntento: lo único que sale del teléfono después de un intento. Es estricto: no admite
 * campos extra, así que no hay dónde meter video, audio, imágenes ni series de puntos de la mano.
 * Los rasgos van agregados por evento. La v2 registra cada evento con la modalidad de cada dato
 * (A = audio, V = visión, VA = ambos); la API sigue aceptando la v1 y la convierte.
 */
export const LIMITE_CUERPO_BYTES = 256 * 1024;

export const SecuenciaEsperada = z.enum(["partitura", "provisional"]);
export type SecuenciaEsperada = z.infer<typeof SecuenciaEsperada>;

export const EventoResultadoV1 = z
  .strictObject({
    idx: z.int().nonnegative(),
    estado: z.enum(["digitacion-correcta", "dedo-incorrecto", "no-evaluable"]),
    motivo: z.string().max(80).nullable(),
    mano: z.enum(["MI", "MD"]).nullable(),
    dedo: z.int().min(1).max(5).nullable(),
    midi: z.int().min(0).max(127).nullable(),
    rasgos: z.record(z.string().max(40), z.number()),
  })
  .meta({ title: "EventoResultadoV1" });
export type EventoResultadoV1 = z.infer<typeof EventoResultadoV1>;

export const Modalidad = z.enum(["A", "V", "VA"]);
export type Modalidad = z.infer<typeof Modalidad>;
const Mano = z.enum(["MI", "MD"]);
const Midi = z.int().min(0).max(127);

/** Un registro por evento esperado, con la modalidad de cada dato (PA-HU11-02). */
export const EventoResultado = z
  .strictObject({
    idx: z.int().nonnegative(),
    mano: Mano.nullable(),
    midi_esperado: Midi.nullable(),
    dedo_esperado: z.int().min(1).max(5).nullable(),
    estado: z.enum(["evaluado", "no-evaluable"]),
    motivo: z.string().max(80).nullable(),
    /** Tiempo del ataque (ms desde el inicio del intento) y de dónde sale. */
    ataque_ms: z.int().nonnegative().nullable(),
    modalidad: Modalidad.nullable(),
    nota: z.strictObject({
      // "sin-dato": intento anterior a la v2, que no registraba el estado de la nota.
      estado: z.enum(["correcta", "incorrecta", "dudosa", "faltante", "sin-dato"]),
      midi: Midi.nullable(),
      clase_oida: z.int().min(0).max(11).nullable(),
      modalidad: Modalidad.nullable(),
    }),
    dedo: z.strictObject({
      valor: z.int().min(1).max(5).nullable(),
      estado: z.enum(["correcto", "incorrecto", "sin-esperado", "no-detectado"]),
      modalidad: z.literal("V").nullable(),
    }),
    tecla: z.strictObject({
      midi: Midi.nullable(),
      /** Posición del contacto a lo largo de la tecla (0 = borde frontal). */
      zona: z.number().nullable(),
      modalidad: z.literal("V").nullable(),
    }),
    /** IND-B3; null fuera de los instantes a manos juntas. */
    desfase_manos: z
      .strictObject({
        estado: z.enum(["a-tiempo", "tarde", "una-nota-atras", "no-medible"]),
        ms: z.number().nonnegative().nullable(),
        mano_tarde: Mano.nullable(),
        modalidad: Modalidad.nullable(),
      })
      .nullable(),
    rasgos: z.record(z.string().max(40), z.number()),
    rasgos_modalidad: z.literal("V").nullable(),
  })
  .meta({ title: "EventoResultado" });
export type EventoResultado = z.infer<typeof EventoResultado>;

const camposComunes = {
  client_uuid: z.uuid(),
  version_ejercicio_id: z.int().positive(),
  tarea_id: z.int().positive().nullable(),
  version_nucleo: z.string().min(1).max(32),
  version_modelo_mano: z.string().min(1).max(64),
  instrumento: z.enum(["acustico", "digital", "teclado", "no_declarado"]),
  manos: Manos,
  // Clase de dispositivo (p. ej. "Android/Chrome"), nunca un identificador.
  clase_dispositivo: z.string().max(40),
  modo: z.enum(["V", "A", "VA"]),
  modo_metronomo: z.enum(["con", "sin"]).nullable(),
  tempo_elegido_bpm: z.int().min(40).max(75).nullable(),
  estado: z.enum(["evaluado", "no_evaluable"]),
  motivo_no_evaluable: z.string().max(120).nullable(),
  iniciado_en: z.iso.datetime({ offset: true }),
  duracion_ms: z.int().nonnegative(),
  pct_eventos_evaluables: z.number().min(0).max(100).nullable(),
  pct_digitacion_correcta: z.number().min(0).max(100).nullable(),
  // De dónde salieron las notas esperadas: la partitura importada o la escala provisional.
  // Opcional para los intentos que ya estaban en cola: sin el campo, la API registra "provisional".
  secuencia_esperada: SecuenciaEsperada.optional(),
};

export const ResultadoIntentoV1 = z
  .strictObject({ ...camposComunes, eventos: z.array(EventoResultadoV1).max(400) })
  .meta({ title: "ResultadoIntentoV1" });
export type ResultadoIntentoV1 = z.infer<typeof ResultadoIntentoV1>;

export const ResultadoIntento = z
  .strictObject({
    version: z.literal(2),
    ...camposComunes,
    // Medidas temporales del intento (E9b); null sin audio. El servidor decide si cuenta.
    tempo_medido_bpm: z.number().positive().max(400).nullable(),
    referencia_temporal: z.enum(["tempo_elegido", "tempo_inicial"]).nullable(),
    cambio_tempo_pct: z.number().min(-100).max(1000).nullable(),
    // Si el navegador respetó las 3 restricciones de audio (PA-HU20-02); null sin micrófono.
    audio_sin_procesar: z.boolean().nullable(),
    eventos: z.array(EventoResultado).max(400),
  })
  .meta({ title: "ResultadoIntento" });
export type ResultadoIntento = z.infer<typeof ResultadoIntento>;

export const IntentoGuardado = z
  .strictObject({
    id: z.int().positive(),
    client_uuid: z.uuid(),
    estudiante_id: z.int().positive(),
    tarea_id: z.int().positive().nullable(),
    estado: z.enum(["evaluado", "no_evaluable"]),
    motivo_no_evaluable: z.string().nullable(),
    cuenta_para_tarea: z.boolean(),
    motivo_no_cuenta: z.string().nullable(),
    version_nucleo: z.string(),
    version_modelo_mano: z.string(),
    instrumento: z.string(),
    manos: Manos,
    modo_metronomo: z.enum(["con", "sin"]).nullable(),
    tempo_elegido_bpm: z.int().nullable(),
    tempo_medido_bpm: z.number().nullable(),
    secuencia_esperada: SecuenciaEsperada,
    iniciado_en: z.iso.datetime({ offset: true }),
  })
  .meta({ title: "IntentoGuardado" });
export type IntentoGuardado = z.infer<typeof IntentoGuardado>;

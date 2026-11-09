import type { PaqueteListo } from "./paquetes.ts";
import { CLASES_ERROR, type TomaEjecucion } from "./validar.ts";

export interface Base {
  consulta(sql: string, parametros?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const ESQUEMA = [
  `CREATE TABLE IF NOT EXISTS participante (
    seudonimo text PRIMARY KEY,
    institucion text,
    rol text NOT NULL CHECK (rol IN ('docente_ref', 'estudiante', 'etiquetador', 'experto')),
    grupo_edad text,
    mano_dominante text,
    nivel text
  )`,
  `CREATE TABLE IF NOT EXISTS sesion_grabacion (
    id serial PRIMARY KEY,
    fecha date NOT NULL,
    institucion text,
    instrumento text NOT NULL CHECK (instrumento IN ('acustico', 'digital', 'teclado')),
    dispositivo text,
    condiciones text,
    UNIQUE NULLS NOT DISTINCT (fecha, institucion, instrumento, dispositivo, condiciones)
  )`,
  `CREATE TABLE IF NOT EXISTS ejecucion (
    id serial PRIMARY KEY,
    codigo_toma text NOT NULL UNIQUE,
    participante text NOT NULL REFERENCES participante (seudonimo),
    version_ejercicio text NOT NULL,
    sesion integer NOT NULL REFERENCES sesion_grabacion (id),
    campana text NOT NULL CHECK (campana IN ('A', 'B', 'C')),
    manos text NOT NULL CHECK (manos IN ('MI', 'MD', 'juntas')),
    tempo_elegido_bpm integer NOT NULL,
    modo_metronomo text NOT NULL CHECK (modo_metronomo IN ('con', 'sin')),
    paquete_sha256 text NOT NULL,
    ruta text NOT NULL,
    evaluable boolean NOT NULL,
    origen text NOT NULL CHECK (origen IN ('real', 'actuado'))
  )`,
  `CREATE TABLE IF NOT EXISTS etiqueta (
    id serial PRIMARY KEY,
    ejecucion integer NOT NULL REFERENCES ejecucion (id) ON DELETE CASCADE,
    etiquetador text NOT NULL REFERENCES participante (seudonimo),
    clase_error text NOT NULL,
    presente boolean NOT NULL,
    compas_aprox text,
    evaluable boolean NOT NULL,
    ronda text NOT NULL CHECK (ronda IN ('piloto', 'simple', 'doble', 'desempate')),
    UNIQUE (ejecucion, etiquetador, clase_error, ronda)
  )`,
];

export async function prepararEsquema(base: Base): Promise<void> {
  for (const sentencia of ESQUEMA) await base.consulta(sentencia);
}

const INSERTAR_PARTICIPANTE = `INSERT INTO participante (seudonimo, rol) VALUES ($1, $2)
  ON CONFLICT (seudonimo) DO NOTHING`;

/** Primero quienes tocan: un docente que además etiqueta conserva su rol de referencia. */
export async function registrarParticipantes(base: Base, tomas: TomaEjecucion[]): Promise<void> {
  for (const t of tomas) await base.consulta(INSERTAR_PARTICIPANTE, [t.participante, t.rol]);
}

async function sesionDe(base: Base, t: TomaEjecucion): Promise<number> {
  const clave = [t.fecha, t.institucion, t.instrumento, t.dispositivo, t.condiciones];
  await base.consulta(
    `INSERT INTO sesion_grabacion (fecha, institucion, instrumento, dispositivo, condiciones)
     VALUES ($1::date, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
    clave,
  );
  const { rows } = await base.consulta(
    `SELECT id FROM sesion_grabacion WHERE fecha = $1::date
       AND institucion IS NOT DISTINCT FROM $2::text AND instrumento = $3
       AND dispositivo IS NOT DISTINCT FROM $4::text AND condiciones IS NOT DISTINCT FROM $5::text`,
    clave,
  );
  return rows[0]!.id as number;
}

async function registrar(base: Base, t: TomaEjecucion, paquete: PaqueteListo): Promise<void> {
  const sesion = await sesionDe(base, t);
  await base.consulta(
    `INSERT INTO ejecucion (codigo_toma, participante, version_ejercicio, sesion, campana, manos,
       tempo_elegido_bpm, modo_metronomo, paquete_sha256, ruta, evaluable, origen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (codigo_toma) DO NOTHING`,
    [
      t.codigo,
      t.participante,
      t.versionEjercicio,
      sesion,
      t.campana,
      t.manos,
      t.tempo,
      t.modoMetronomo,
      paquete.sha256,
      paquete.ruta,
      t.evaluable,
      t.origen,
    ],
  );
  const { rows } = await base.consulta("SELECT id FROM ejecucion WHERE codigo_toma = $1", [
    t.codigo,
  ]);
  const ejecucion = rows[0]!.id as number;
  for (const e of t.etiquetas) {
    await base.consulta(INSERTAR_PARTICIPANTE, [e.etiquetador, "etiquetador"]);
    // Una clase no marcada también es un dato: la concordancia necesita los ausentes.
    for (const clase of CLASES_ERROR) {
      await base.consulta(
        `INSERT INTO etiqueta (ejecucion, etiquetador, clase_error, presente, compas_aprox,
           evaluable, ronda)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (ejecucion, etiquetador, clase_error, ronda) DO NOTHING`,
        [
          ejecucion,
          e.etiquetador,
          clase,
          e.clases.includes(clase),
          e.compasAprox,
          t.evaluable,
          e.ronda,
        ],
      );
    }
  }
}

/** Cada toma entra completa o no entra. */
export async function registrarToma(
  base: Base,
  toma: TomaEjecucion,
  paquete: PaqueteListo,
): Promise<void> {
  await base.consulta("BEGIN");
  try {
    await registrar(base, toma, paquete);
    await base.consulta("COMMIT");
  } catch (error) {
    await base.consulta("ROLLBACK");
    throw error;
  }
}

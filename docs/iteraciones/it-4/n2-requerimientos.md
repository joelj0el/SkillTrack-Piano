# n.2 Requerimientos — Iteración 4 (en curso)

## HU-22 · Bandas por consenso con regla de retención

| PA         | Estado    | Motivo / prueba                                                                                                                                                                                      |
| ---------- | --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU22-01 | Cumplido  | Publicar una versión que ya existe da 409; no hay ruta para editar ni borrar y un disparador rechaza UPDATE y DELETE; admin, docente, estudiante e investigador reciben 403 (PA-HU22-01)             |
| PA-HU22-02 | Pendiente | Manual. El script calcula el V2 dejando un docente fuera (PU-bandas-13 a 15, PP-bandas-05, PU-research-71); falta ejecutarlo sobre la Campaña A y fijar el umbral de G-1                             |
| PA-HU22-03 | Prototipo | La regla de retención descarta el rasgo ruidoso con su motivo e informa los que no evalúa (PU-bandas-07 a 12, PP-bandas-04, PU-research-67); la verificación manual con la Campaña A queda pendiente |
| PA-HU22-04 | Pendiente | La referencia publicada guarda su origen (campaña, rol, tomas, versiones del núcleo y del reprocesamiento; PU-contracts-22, PA-HU22-01); reemplazar PRM-09 a PRM-11 requiere la Campaña A            |

## Parámetros de las bandas

Las cifras salen de `research/node/src/bandas/parametros.plantilla.json`:

- Percentiles P10–P90 y factor de retención 1,0: [PROVISIONAL].
- Diferencia buscada de los rasgos temporales: PRM-09 (cambio de tempo, 5 %), PRM-10 (desvío del ataque, 25 % del intervalo local) y PRM-11 (desfase entre manos, 50 ms), todas [PROVISIONAL].
- Rasgos visuales (`altura.<dedo>`): diferencia buscada PENDIENTE; su retención no se evalúa y el script lo informa.
- Bandas por compás: pendiente hasta que la partitura traiga el mapa de evento a compás; hoy la unidad es el evento.

## HU-23 · Revisar y versionar reglas con el panel

| PA         | Estado   | Motivo / prueba                                                                                                                                                         |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU23-01 | Cumplido | Publicar `conjunto_reglas vN` exige una versión existente de la taxonomía; repetida, 409; inmutable; admin, docente, estudiante e investigador reciben 403 (PA-HU23-01) |
| PA-HU23-02 | Cumplido | Para un intento de ejemplo sintético, la herramienta muestra qué regla disparó cada diagnóstico y con qué eventos (E2E PA-HU23-02)                                      |

## Referencia y reglas en el cliente y en el intento

- Al abrir la práctica de una tarea, el cliente descarga la referencia vigente de su versión de ejercicio y las reglas vigentes, y las guarda en IndexedDB; sin red usa lo guardado (PU-web-17 a 19).
- El intento envía `referencia_id` y `conjunto_reglas_id` (null si aún no hay nada publicado); la API los guarda con clave foránea y rechaza con 422 un id inexistente o una referencia de otro ejercicio (PU-attempts-07, 08).
- La publicación de la taxonomía (resto de TI-HU23-01) queda pendiente: hoy la taxonomía v0.1 llega por migración.

## HU-06 · Tipificar errores por reglas

| PA         | Estado    | Motivo / prueba                                                                                                                                                                                                                      |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PA-HU06-01 | Cumplido  | 8 intentos sintéticos (origen "sintetico") con la plantilla de reglas v1: el diagnóstico da exactamente sus clases, indicadores y eventos (PA-HU06-01, prueba Vitest del núcleo con las fixtures de `packages/core/fixtures/golden`) |
| PA-HU06-02 | Cumplido  | Durante el diagnóstico en V, A y VA no se pide ningún detector, modelo ni WASM (E2E PA-HU06-02); el módulo del núcleo solo importa código propio (PU-diagnostico-12)                                                                 |
| PA-HU06-03 | Pendiente | Manual: V3a en G-1. El script `pnpm validacion v3a` ya existe (PU-research-72 a 74 y 76, datos sintéticos); falta correrlo con los datos reales                                                                                      |

## HU-24 · Diagnóstico en modo V / A / VA

| PA         | Estado    | Motivo / prueba                                                                                                                                                 |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU24-01 | Cumplido  | El mismo intento en V, A y VA solo difiere en los indicadores de la modalidad excluida y el resultado registra el modo (E2E PA-HU24-01, PU-diagnostico-13 y 14) |
| PA-HU24-02 | Pendiente | Manual: V3b en G-1. El script `pnpm validacion v3b` ya existe (PU-research-75, datos sintéticos); falta correrlo con los datos reales                           |

## HU-07, 25, 26, 27 y 28 · Pantalla de resultados (P-42)

| PA         | Estado    | Motivo / prueba                                                                                                                                                                        |
| ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU07-01 | Cumplido  | Del fin de la ejecución al resultado, 1,7 s en la corrida completa (≤ 5 s, PRM-03); el Worker se crea durante el conteo (E2E PA-HU07-01)                                               |
| PA-HU07-02 | Cumplido  | Bloques en el orden del panel, una corrección principal con las demás plegadas y sin estrellas ni puntaje (E2E PA-HU07-02)                                                             |
| PA-HU07-03 | Cumplido  | axe-core sin errores graves ni críticos en la pantalla de resultados (E2E PA-HU07-03)                                                                                                  |
| PA-HU07-04 | Pendiente | Manual: V4                                                                                                                                                                             |
| PA-HU25-01 | Cumplido  | Cada nota con su familia, icono y texto; al tocarla, mano, dedo y ms (E2E PA-HU25-01)                                                                                                  |
| PA-HU25-02 | Cumplido  | Las notas no evaluables muestran su motivo (E2E PA-HU25-02)                                                                                                                            |
| PA-HU26-01 | Prototipo | La más crítica (§4.2, propuesta) es la corrección principal, con nombre, dónde y mensaje (E2E PA-HU26-01); el mensaje es el texto "pendiente de aprobación del panel" hasta PA-HU26-03 |
| PA-HU26-02 | Cumplido  | Última observación del docente con su aspecto (E2E PA-HU26-02)                                                                                                                         |
| PA-HU26-03 | Pendiente | Manual: el panel aprueba los mensajes (acta)                                                                                                                                           |
| PA-HU27-01 | Cumplido  | Un intento incompleto es No evaluable con su motivo y una acción sugerida (E2E PA-HU27-01)                                                                                             |
| PA-HU27-02 | Cumplido  | Sin datos, la variable es No evaluado con su motivo; IND-E1 e IND-F1 a F4 nunca se califican (E2E PA-HU27-02, PU-diagnostico-18)                                                       |
| PA-HU28-01 | Cumplido  | Calificación por variable de los intentos anteriores del mismo ejercicio y manos (E2E PA-HU28-01, PU-attempts-09)                                                                      |
| PA-HU28-02 | Cumplido  | Reintentar vuelve al conteo con la misma calibración y el mismo tempo (E2E PA-HU28-02)                                                                                                 |

## HU-30 (mínima) · Ver los intentos de mis estudiantes

| PA         | Estado   | Motivo / prueba                                                                                                                                                                                                                               |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU30-01 | Cumplido | Solo el docente con asignación vigente ve los intentos de la tarea; otro docente, el de otra institución, un estudiante o una asignación cerrada reciben 403; cada lectura y cada rechazo quedan en la auditoría (PA-HU30-01, PU-attempts-10) |
| PA-HU30-02 | Cumplido | Por tarea: fecha, tempo, metrónomo, calificación por variable e indicadores deficientes de cada intento (E2E PA-HU30-02, PU-web-25)                                                                                                           |

## HU-38 · Valorar la tarea

| PA         | Estado   | Motivo / prueba                                                                                                                                                                             |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU38-01 | Cumplido | El docente marca Por repetir con aspecto, observación y plazo nuevo (vuelve a En práctica) y luego Lograda (Revisada); el estudiante ve la valoración y la observación (E2E PA-HU38-01)     |
| PA-HU38-02 | Cumplido | Solo el docente asignado valora (403 a los demás); la valoración guarda fecha y docente; Por repetir sin observación o sin aspecto → 422 (PA-HU38-02, PU-pedagogy-10 y 11, PU-contracts-29) |

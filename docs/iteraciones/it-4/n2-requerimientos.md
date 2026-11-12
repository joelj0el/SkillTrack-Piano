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

| PA         | Estado    | Motivo / prueba                                                                                                                                                      |
| ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU06-01 | Pendiente | Golden de diagnósticos (TI-HU06-04)                                                                                                                                  |
| PA-HU06-02 | Cumplido  | Durante el diagnóstico en V, A y VA no se pide ningún detector, modelo ni WASM (E2E PA-HU06-02); el módulo del núcleo solo importa código propio (PU-diagnostico-12) |
| PA-HU06-03 | Pendiente | Manual: V3a en G-1                                                                                                                                                   |

## HU-24 · Diagnóstico en modo V / A / VA

| PA         | Estado    | Motivo / prueba                                                                                                                                                 |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU24-01 | Cumplido  | El mismo intento en V, A y VA solo difiere en los indicadores de la modalidad excluida y el resultado registra el modo (E2E PA-HU24-01, PU-diagnostico-13 y 14) |
| PA-HU24-02 | Pendiente | Manual: V3b en G-1                                                                                                                                              |

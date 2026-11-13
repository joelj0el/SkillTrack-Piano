# n.2 Requerimientos — Iteración 5 (en curso)

## HU-33 · Dataset versionado

| PA         | Estado    | Motivo / prueba                                                                                                                                                                   |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU33-01 | Pendiente | Manual. El protocolo está escrito y congelado (2026-11-12, sha256 en `protocolo.congelado.json`) y el pipeline lo verifica (PU-clasificador-09); falta la aprobación de la tutora |
| PA-HU33-02 | Pendiente | Manual. El dataset lleva su sha256 y solo seudónimos (PU-dataset-01 a 05, PU-research-79, datos sintéticos); falta construirlo con los datos reales                               |

## HU-34 · Entrenar y evaluar el clasificador

| PA         | Estado    | Motivo / prueba                                                                                                                                           |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU34-01 | Pendiente | Manual. La partición por sujeto da 0 sujetos compartidos en todos los pliegues con datos sintéticos (PU-clasificador-04 y 05); falta con los datos reales |
| PA-HU34-02 | Pendiente | Manual. El informe V3c existe (PU-clasificador-06, 10 y 11); falta correrlo con los datos reales                                                          |
| PA-HU34-03 | Pendiente | Manual. Las clases con < 8 sujetos reales se excluyen con constancia (PU-clasificador-08); falta con los datos reales                                     |

## HU-15 · Tableros descriptivos

| PA         | Estado   | Motivo / prueba                                                                                                                                                                                                                                                                         |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU15-01 | Cumplido | "Mi progreso": % promedio por variable y semana (lunes a domingo, hora de La Paz) del propio estudiante, con el cambio frente a su semana anterior; un docente recibe 403 (E2E PA-HU15-01, PA-HU15-01 API, PU-analytics-01, PU-web-26 y 27)                                             |
| PA-HU15-02 | Cumplido | "Mi grupo": en cuántos de los últimos N intentos evaluados apareció cada clase, por estudiante con asignación vigente, en orden alfabético y sin rankings ni puntajes; un estudiante recibe 403 (E2E PA-HU15-02, PA-HU15-02 API, PU-analytics-02 y 03, PU-contracts-30 y 31, PU-web-28) |

## HU-35 · Etiqueta del clasificador en resultados

| PA         | Estado    | Motivo / prueba                                                                                                                                                                                                                                                                                                                  |
| ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU35-01 | Prototipo | Con la bandera apagada (por defecto), la pantalla y lo guardado son idénticos a lo de las reglas (E2E PA-HU35-01, PU-classifier-01, PU-web-29 y 30). Con la bandera encendida, la etiqueta marcada como tal solo se prueba con un modelo de prueba (PU-web-30): no hay modelo publicado porque V3c no se corrió con datos reales |

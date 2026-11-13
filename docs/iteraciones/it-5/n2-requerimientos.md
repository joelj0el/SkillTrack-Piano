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

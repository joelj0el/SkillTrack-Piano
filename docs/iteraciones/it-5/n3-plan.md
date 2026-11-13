# n.3 Plan — Iteración 5 (en curso)

## Tareas de ingeniería por historia

| Tarea      | Descripción                                                                                                                    | Estado                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| TI-HU33-01 | Protocolo de evaluación escrito y congelado antes de entrenar (`protocolo.md`, `protocolo.congelado.json`)                     | Implementado (commit `d10ab66`); falta la aprobación de la tutora                                            |
| TI-HU33-02 | Exportación por ejecución (`pnpm dataset:exportar`) y dataset con origen, sujeto seudónimo y hash                              | Implementado (commit `df2b303`)                                                                              |
| TI-HU33-03 | Informe de concordancia (κ)                                                                                                    | Cubierto por `pnpm validacion v3a` (It-4, commit `17a2221`) y por la condición de κ de G-2 en el informe V3c |
| TI-HU33-04 | Aumento sintético con semilla registrada; cada fila marcada `sintetico` con su fila de origen (tarea nueva del plan acelerado) | Implementado (commit `0c38e1d`)                                                                              |
| TI-HU34-01 | Rasgos agregados por ejecución, incluidos los rasgos entre modalidades                                                         | Implementado (commit `800eb93`)                                                                              |
| TI-HU34-02 | Partición por sujeto sin fuga, regresión logística y árbol, líneas base (reglas congeladas y mayoritaria), G-2 y DP-06         | Implementado (commit `2997787`)                                                                              |
| TI-HU34-03 | Ablación V / A / VA e informe V3c con métricas por origen y matrices de confusión                                              | Implementado (commit `01853ac`); falta correrlo con los datos reales                                         |
| TI-HU34-04 | Exportación a ONNX solo si el modelo supera a las reglas, con prueba de paridad                                                | Implementado (commit `89d0916`)                                                                              |

## Notas de ejecución

- La rama `it-5/nucleo` sale de `main` (1a54e7f), que ya contiene `it-4/nucleo`.
- Dependencias nuevas de `research/python`: numpy 2.5.4, scikit-learn 1.9.1, skl2onnx 1.20.0 y onnxruntime 1.31.1.
- El pipeline verifica el sha256 del protocolo congelado antes de entrenar y se niega si cambió (PU-clasificador-09).
- Las filas actuadas y sintéticas llevan el sujeto de su fila de origen: caen siempre en el mismo pliegue (PU-clasificador-04).
- Las reglas no se evalúan sobre filas sintéticas: el aumento no inventa su diagnóstico ni juicios de etiquetadores.
- Todas las pruebas usan ejecuciones sintéticas (`research/python/tests/sinteticos.py`); ninguna cifra de V3c existe todavía.
- Las E2E no cambian en esta tarea (no hay cambios en la web ni en la API); n6 usa el reporte de la última suite completa.
- Intermitentes (carga de la máquina, sin cambios en TypeScript): en dos corridas del gate, Vitest agotó el tiempo en PP-bandas-04 y PP-geometry-01, y luego en PU-audio-17, PP-features-01 y PU-ci-01 (56–62 s); Vitest solo pasó entero (68 archivos, 352 casos) y el tercer intento del gate quedó en verde.

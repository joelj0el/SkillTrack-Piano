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
| TI-HU15-01 | Vistas `v_progreso_estudiante`, `v_errores_recurrentes` y `v_grupo_docente` (migración 0017)                                   | Implementado (commit `5bd8193`)                                                                              |
| TI-HU15-02 | Endpoints `GET /api/tableros/mi-progreso` y `GET /api/tableros/mi-grupo?ultimos=N` (contratos `MiProgreso` y `MiGrupo`)        | Implementado (commit `9caaffa`)                                                                              |
| TI-HU15-03 | Pantallas "Mi progreso" (estudiante) y "Mi grupo" (docente)                                                                    | Implementado (commit `977499b`)                                                                              |
| TI-HU35-01 | `core/clasificador`: etiqueta opcional, cargador inyectado y perezoso, bandera apagada por defecto                             | Implementado (commit `6d636f6`); sin ejecución ONNX en el navegador                                          |
| TI-HU35-02 | Etiqueta en el bloque de variables, marcada como del clasificador y sin cambiar la calificación                                | Implementado (commit `cbeb03e`)                                                                              |
| TI-HU35-03 | E2E con la bandera apagada                                                                                                     | Implementado (commit `9d886d7`); con la bandera encendida, pendiente (no hay modelo publicado)               |
| TC-02      | Vitest estable bajo carga                                                                                                      | Implementado (commits `dbde955` y `1947f27`)                                                                 |

## Notas de ejecución

- La rama `it-5/nucleo` sale de `main` (1a54e7f), que ya contiene `it-4/nucleo`.
- Dependencias nuevas de `research/python`: numpy 2.5.4, scikit-learn 1.9.1, skl2onnx 1.20.0 y onnxruntime 1.31.1.
- El pipeline verifica el sha256 del protocolo congelado antes de entrenar y se niega si cambió (PU-clasificador-09).
- Las filas actuadas y sintéticas llevan el sujeto de su fila de origen: caen siempre en el mismo pliegue (PU-clasificador-04).
- Las reglas no se evalúan sobre filas sintéticas: el aumento no inventa su diagnóstico ni juicios de etiquetadores.
- Todas las pruebas usan ejecuciones sintéticas (`research/python/tests/sinteticos.py`); ninguna cifra de V3c existe todavía.
- HU-33 y HU-34 no cambian las E2E (no tocan la web ni la API).
- Intermitentes (carga de la máquina, sin cambios en TypeScript): en dos corridas del gate, Vitest agotó el tiempo en PP-bandas-04 y PP-geometry-01, y luego en PU-audio-17, PP-features-01 y PU-ci-01 (56–62 s); Vitest solo pasó entero (68 archivos, 352 casos) y el tercer intento del gate quedó en verde.
- Vitest bajo carga (TC-02): las dos caídas del gate del 12-nov coinciden con la espera moderna de Windows (registro del sistema: 18:38→18:40 y 18:44→18:47 del 12-nov, justo antes de los logs de las 18:41 y 18:48). `pnpm test` pasa ahora por `tools/despierto.ts`, como las E2E (PU-ci-09). Además, a batería y con poca carga, 8 archivos web no alcanzaron a arrancar su worker: Vitest usa como mucho la mitad de los núcleos en los dos proyectos (PU-ci-10).
- PA-HU07-01 (PRM-03) falló tres veces a batería (7,6–8,2 s; análisis 4,5–4,8 s) y pasó con el equipo enchufado (1,3 s). Las mediciones de PRM-03 se toman con el equipo conectado a la corriente.
- Tableros (HU-15): sin rankings, comparaciones entre estudiantes, estrellas ni puntajes globales. Mi grupo va en orden alfabético; los contratos estrictos rechazan campos de posición o puntaje (PU-contracts-30 y 31). Mi progreso compara cada variable solo con la semana anterior del mismo estudiante.
- Errores recurrentes: la clase sale del código del indicador (IND-B2 → ER-B); cuentan los intentos evaluados con reglas (indicadores no nulos), del más reciente al más antiguo.
- HU-35: no se agregó ninguna dependencia. Ejecutar ONNX en el navegador exigiría `onnxruntime-web` y `'wasm-unsafe-eval'` en la CSP; solo se decide si V3c muestra que el modelo supera a las reglas. Con la bandera apagada el cargador ni se llama.

# n.3 Plan — Iteración 4 (en curso)

| Tarea      | Descripción                                                                                                           | Estado                                                                 |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| TI-HU22-01 | Bandas por percentiles ponderados (cada docente pesa lo mismo) por evento × rasgo                                     | Implementado (commit `f1e3ff5`)                                        |
| TI-HU22-02 | Regla de retención DM-12b con `rasgos_descartados` y rasgos sin evaluar, cada uno con su motivo                       | Implementado (commit `55caf85`)                                        |
| TI-HU22-03 | Script `pnpm bandas` sobre la Campaña A → `referencia vN` (JSON), contrato `Referencia`                               | Implementado (commit `e2390d1`)                                        |
| TI-HU22-04 | Publicación inmutable de la referencia (API superadmin)                                                               | Implementado (commit `e8c4115`)                                        |
| TI-HU22-05 | V2 dejando un docente fuera (núcleo y script)                                                                         | Implementado (commit `a88ed14`)                                        |
| TI-HU23-01 | Publicación inmutable de `conjunto_reglas vN` con su versión de taxonomía; caché de referencia y reglas en el cliente | Implementado (commit `f3efc85`); falta publicar la taxonomía           |
| TI-HU23-02 | Herramienta del investigador: reglas y eventos de cada diagnóstico sobre un intento de ejemplo                        | Implementado (commit `c1da85a`); E2E de los ids del intento: `c5fc40f` |
| TI-HU06-01 | Contrato `ConjuntoReglas` con la forma completa de cada regla y plantilla v1                                          | Implementado (commit `a1b3a64`)                                        |
| TI-HU06-02 | Valores medidos y desviaciones respecto de la banda                                                                   | Implementado (commit `b2bba5a`)                                        |
| TI-HU06-03 | Motor de reglas con evidencia por evento                                                                              | Implementado (commit `e7d8084`)                                        |
| TI-HU06-04 | Golden de diagnósticos                                                                                                | Pendiente                                                              |
| TI-HU24-01 | Modo V, A o VA en el motor                                                                                            | Implementado (commit `f474358`)                                        |
| TI-HU24-02 | Scripts V3a y V3b                                                                                                     | Pendiente                                                              |

## Notas de ejecución

- El script lo ejecuta el autor sobre la base de investigación: `pnpm bandas --ejercicio EJ-01@1 --version 1 --parametros <archivo.json> --salida <carpeta>`. Las pruebas usan solo la planilla sintética de `research/node/fixtures/ingesta` y resultados inventados.
- La consulta filtra por `rol = 'docente_ref'`, el valor que guarda la ingesta (PU-research-65).
- Indicadores evaluables en la plantilla v1 (`tools/catalogo/conjunto_reglas.v1.json`): IND-A1, IND-B1, IND-B2, IND-B3, IND-C1, IND-D1 e IND-D2. IND-E1 e IND-F1 a IND-F4 quedan "no evaluable por diseño": el núcleo no registra por evento la flexión, la muñeca, los dedos libres ni el ángulo pulgar–índice. Los mensajes dicen "pendiente de aprobación del panel".
- El tropiezo conserva su comparación original con el desvío compartido (commit `20fe681`, PP-audio-01 con 1000 casos).
- La semilla de demostración incluye `superadmin.demo`, que publica la referencia y las reglas (sin institución).

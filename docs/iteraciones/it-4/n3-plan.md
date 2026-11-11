# n.3 Plan — Iteración 4 (en curso)

| Tarea      | Descripción                                                                                                           | Estado                                                       |
| ---------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| TI-HU22-01 | Bandas por percentiles ponderados (cada docente pesa lo mismo) por evento × rasgo                                     | Implementado (commit `f1e3ff5`)                              |
| TI-HU22-02 | Regla de retención DM-12b con `rasgos_descartados` y rasgos sin evaluar, cada uno con su motivo                       | Implementado (commit `55caf85`)                              |
| TI-HU22-03 | Script `pnpm bandas` sobre la Campaña A → `referencia vN` (JSON), contrato `Referencia`                               | Implementado (commit `e2390d1`)                              |
| TI-HU22-04 | Publicación inmutable de la referencia (API superadmin)                                                               | Implementado (commit `e8c4115`)                              |
| TI-HU22-05 | V2 dejando un docente fuera (núcleo y script)                                                                         | Implementado (commit `a88ed14`)                              |
| TI-HU23-01 | Publicación inmutable de `conjunto_reglas vN` con su versión de taxonomía; caché de referencia y reglas en el cliente | Implementado (commit `f3efc85`); falta publicar la taxonomía |

## Notas de ejecución

- El script lo ejecuta el autor sobre la base de investigación: `pnpm bandas --ejercicio EJ-01@1 --version 1 --parametros <archivo.json> --salida <carpeta>`. Las pruebas usan solo la planilla sintética de `research/node/fixtures/ingesta` y resultados inventados.
- La consulta filtra por `rol = 'docente_ref'`, el valor que guarda la ingesta (PU-research-65).

# n.6 Pruebas — Iteración 4 (en curso)

El detalle por prueba está en `n6-pruebas.generado.md`, generado desde los reportes de la suite completa (Vitest, pytest y Playwright).

## Pruebas inestables

| Prueba              | Observación                                                                                                                                                                             |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PU-accesibilidad-06 | Falló 1 vez (contraste del título y de las tarjetas de "Mis estudiantes" en oscuro) en una corrida completa; pasó al repetirla y en la corrida completa siguiente. Causa no investigada |
| PU-ci-01            | Agotó una vez el límite de 5 s de Vitest (5,5 s: ejecuta dependency-cruiser) en una corrida de la suite; pasó al repetirla. Causa: tiempo de la máquina, no lógica                      |

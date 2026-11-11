# n.6 Pruebas

## Pruebas de aceptación (PA)

## Pruebas unitarias (PU) con casos de frontera

## Validación del OE

## Pruebas inestables

| Prueba     | Observación                                                  |
| ---------- | ------------------------------------------------------------ |
| PA-HU03-05 | prueba inestable: se colgó 1 vez de 6, causa no identificada |

Causa identificada: los tres cuelgues coinciden con la espera moderna de Windows (Kernel-Power 506/507), que suspende el equipo a mitad de la prueba; `pnpm e2e` corre ahora con `tools/despierto.ts`, que mantiene despierto el equipo (PU-ci-07, 08). Los ejecutores de la CI no se suspenden.

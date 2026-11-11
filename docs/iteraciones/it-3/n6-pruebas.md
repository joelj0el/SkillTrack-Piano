# n.6 Pruebas — Iteración 3 (versión de avance)

## Pruebas de aceptación (PA)

Ninguna PA de la It-3 se ejecuta de punta a punta en esta versión (ver n.2). Los resultados de todas las pruebas, generados desde los reportes JUnit, están en [`n6-pruebas.generado.md`](n6-pruebas.generado.md):

```bash
pnpm vitest run packages apps src/ research infra tools/ci tools/docs tools/normalizar \
  --reporter=default --reporter=junit --outputFile.junit=reports/vitest.xml
pnpm docs:tests it-3 --historias HU-19,HU-20,HU-10,HU-21,HU-11
```

## Pruebas unitarias (PU) con señales sintéticas

| Módulo  | Qué se verifica                                                                                                                                                                                                                                                                                                                                                                                                            |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| audio   | FFT (impulso, constante, tono en su bin); ataques con error ≤ 10 ms en señal limpia, también en el registro grave; F1 con ±50 ms justo dentro y fuera; silencio sin ataques; tempo estable, aceleraste y frenaste; frontera de PRM-09 (4,99 % y 6 %); tropiezo con frontera de PRM-10 (24 % y 26 %); referencia temporal; croma correcto en las cuatro escalas del repertorio, nota incorrecta, octava paralela y "dudosa" |
| tempo   | Conteo de 4 pulsos a ♩ = 60 y 75; pulso visual solo con metrónomo; selector de 40 a 70 con práctica lenta                                                                                                                                                                                                                                                                                                                  |
| quality | Puerta acústica: verde, ruido, saturación y sin sonido del piano                                                                                                                                                                                                                                                                                                                                                           |
| align   | Dedo atribuido; frontera de la ventana (80 y 81 ms); un evento visual no se usa dos veces                                                                                                                                                                                                                                                                                                                                  |

Las señales son sintéticas y deterministas (nota con fundamental y dos armónicos con caída exponencial; ruido como suma de senos no armónicos). No reemplazan a las grabaciones del autor con piano acústico, digital y teclado.

## Estado de esta versión

Implementado: las PU de la tabla. Pendiente: golden de audio, fixtures de micrófono y PA de punta a punta.

## Pruebas inestables

| Prueba              | Observación                                                                                                                                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PU-accesibilidad-07 | Se colgó 1 vez esperando el medidor en /microfono (navegador sin respuesta en una página con cámara o micrófono, igual que PA-HU03-05 y PU-accesibilidad-02); causa no investigada |

Causa identificada: los tres cuelgues coinciden con la espera moderna de Windows (Kernel-Power 506/507), que suspende el equipo a mitad de la prueba; `pnpm e2e` corre ahora con `tools/despierto.ts`, que mantiene despierto el equipo (PU-ci-07, 08). Los ejecutores de la CI no se suspenden.

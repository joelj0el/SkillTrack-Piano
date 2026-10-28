# n.4 Diseño — Iteración 3 (versión de avance)

## Núcleo (`packages/core`, TypeScript puro)

| Módulo                 | Contenido                                                                                                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `audio/fft.ts`         | FFT radix-2 in situ y STFT con ventana de Hann                                                                                                                         |
| `audio/ataques.ts`     | Flujo espectral (rectificación de media onda), umbral adaptativo con mediana local, separación mínima y refinamiento temporal; F1 con tolerancia                       |
| `audio/tempo.ts`       | Tempo inicial y final (PRM-08), cambio de tempo (PRM-09), tropiezo o pausa (PRM-10), referencia temporal según el modo de metrónomo, tempo fuera del rango de la tarea |
| `audio/croma.ts`       | Croma del aumento espectral en el ataque; verificación con estado "dudoso"                                                                                             |
| `audio/metronomo.ts`   | Programa del conteo previo y del pulso visual; reglas del selector de tempo                                                                                            |
| `audio/sintesis.ts`    | Señales sintéticas deterministas para las pruebas                                                                                                                      |
| `calidad/acustica.ts`  | Ruido de fondo (tramo en silencio), nivel y saturación (tramo tocando)                                                                                                 |
| `alineacion/fusion.ts` | Dedo atribuido a cada ataque dentro de una ventana, con modalidad VA o A                                                                                               |

El núcleo sigue sin usar DOM, red, reloj ni azar: el metrónomo devuelve instantes relativos y quien reproduce pone el reloj.

## Cliente y servidor

Sin cambios en esta versión. La captura de audio (AudioWorklet), las pantallas de micrófono y metrónomo y el contrato `ResultadoIntento` v2 quedan pendientes.

## Estado de esta versión

Implementado: los módulos del núcleo de la tabla. Pendiente: integración en el navegador.

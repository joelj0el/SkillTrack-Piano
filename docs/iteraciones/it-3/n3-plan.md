# n.3 Plan — Iteración 3 (versión de avance)

| Tarea                  | Descripción                                                                               | Estado                                                                                                             |
| ---------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| TI-HU19-01             | Programa de clics y conteo previo                                                         | Implementado (sin reproducción de audio)                                                                           |
| TI-HU19-02, 03         | Pulso visual en pantalla; latencia del clic                                               | Pendiente                                                                                                          |
| TI-HU20-01             | AudioWorklet → búfer PCM                                                                  | Implementado (commit `86bc1c0`)                                                                                    |
| TI-HU20-02             | Puerta acústica                                                                           | Implementado (umbrales provisionales)                                                                              |
| TI-HU20-03             | Pantalla de prueba de micrófono                                                           | Implementado (commit `57931af`)                                                                                    |
| TI-HU10-01             | STFT y FFT                                                                                | Implementado                                                                                                       |
| TI-HU10-02             | Flujo espectral → ataques                                                                 | Implementado, con refinamiento temporal                                                                            |
| TI-HU10-03             | Tempo, tropiezo, referencia temporal y tempo medido; cuenta_para_tarea en el servidor     | Implementado (tempo medido y regla del servidor: commit `5545df7`)                                                 |
| TI-HU10-04, TI-HU21-03 | Golden de audio                                                                           | Pendiente: requiere grabaciones del autor                                                                          |
| TI-HU21-01, 02         | Croma por ataque y verificación con "dudoso"                                              | Implementado                                                                                                       |
| TI-HU11-01             | Alineamiento por mano con reanclaje del tempo solo para emparejar                         | Implementado (commit `eece2c6`)                                                                                    |
| TI-HU11-02             | Fusión: dedo atribuido por evento; desfase entre manos (IND-B3)                           | Implementado (commit `20b0d7c`)                                                                                    |
| TI-HU11-03             | Registro por evento con modalidad, `ResultadoIntento` v2 y migración de `intento.eventos` | Implementado (commit `9ad1a67`)                                                                                    |
| TI-HU11-04             | E2E con audio y video simulados (bloquea en la CI desde `ea3667d`)                        | Implementado (commit `d6a2692`)                                                                                    |
| TI-HU11-05             | Script de sincronización                                                                  | Implementado (commit `ed5c4cb`): `pnpm validacion sincronizacion` con palmadas; falta grabar el clip               |
| TI-HU37-01             | Vista `v_avance_tarea`, ruta del avance por día y estado "En práctica"                    | Implementado (commit `eee80ac`)                                                                                    |
| TI-HU37-02             | Pantallas: "N de M hoy" para el estudiante y días por repeticiones para el docente        | Implementado (commit `eb2a28d`)                                                                                    |
| TI-HU19-03             | Latencia del metrónomo desde una grabación del conteo                                     | Implementado (commit `29c79d8`): `pnpm validacion latencia`; falta la grabación                                    |
| TV-3-01                | Script V1 acústica                                                                        | Implementado (commit `05414a4`): `pnpm validacion v1-acustica` y plantilla de Sonic Visualiser; falta la anotación |

## Notas de ejecución

- El primer cálculo del instante de ataque tenía un adelanto sistemático de unos 39 ms (el pico del flujo marca el cuadro en que la nota entra, no su inicio). Se corrigió refinando dentro del cuadro con la mayor subida de energía en bloques de ~5,8 ms.
- El commit `80d9d59` entró con una prueba en rojo (PU-tempo-03); el siguiente commit lo corrigió. Desde ese momento cada commit se condiciona a que toda la verificación esté en verde.
- Los cuelgues del navegador en las E2E (PA-HU03-05, PU-accesibilidad-02 y 07) eran la espera moderna de Windows; `pnpm e2e` mantiene despierto el equipo desde `066dc52`. PU-web-11 falló 1 vez en una corrida completa (se quedó pidiendo la cámara, sin suspensión del equipo); no se reprodujo en 9 repeticiones.
- Corrección del 21-nov: TI-HU20-01 y TI-HU20-03 figuraban como pendientes aunque estaban hechas (commits `86bc1c0` y `57931af`).
- TV-3-01: ataques emparejados uno a uno a ± 50 ms (MIREX); una nota acierta si además coincide la clase de altura; separado por origen e instrumento (PU-research-84 a 86, datos sintéticos).
- TI-HU11-05: el instante visual es el mínimo de la distancia entre las manos en cada palmada; la precisión visual es de un fotograma (PU-research-87 y 88, datos sintéticos).
- TI-HU19-03: la latencia se mide desde el toque en «Empezar» (incluye la de la pantalla táctil); sin el toque grabado solo se informan los intervalos entre clics (PU-research-89 a 91, señal sintética).

## Estado de esta versión

Implementado: el núcleo de audio y la fusión simple. Pendiente: todo lo que corre en el navegador y el alineamiento con la partitura.

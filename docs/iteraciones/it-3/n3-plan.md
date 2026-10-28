# n.3 Plan — Iteración 3 (versión de avance)

| Tarea                  | Descripción                                            | Estado                                    |
| ---------------------- | ------------------------------------------------------ | ----------------------------------------- |
| TI-HU19-01             | Programa de clics y conteo previo                      | Implementado (sin reproducción de audio)  |
| TI-HU19-02, 03         | Pulso visual en pantalla; latencia del clic            | Pendiente                                 |
| TI-HU20-01             | AudioWorklet → búfer PCM                               | Pendiente                                 |
| TI-HU20-02             | Puerta acústica                                        | Implementado (umbrales provisionales)     |
| TI-HU20-03             | Pantalla de prueba de micrófono                        | Pendiente                                 |
| TI-HU10-01             | STFT y FFT                                             | Implementado                              |
| TI-HU10-02             | Flujo espectral → ataques                              | Implementado, con refinamiento temporal   |
| TI-HU10-03             | Tempo, tropiezo y referencia temporal                  | Implementado sobre los ataques crudos     |
| TI-HU10-04, TI-HU21-03 | Golden de audio                                        | Pendiente: requiere grabaciones del autor |
| TI-HU21-01, 02         | Croma por ataque y verificación con "dudoso"           | Implementado                              |
| TI-HU11-01             | Alineamiento con reanclaje del tempo                   | Pendiente                                 |
| TI-HU11-02             | Fusión: dedo atribuido por ataque                      | Implementado (versión simple)             |
| TI-HU11-03 a 05        | Desviaciones por evento, E2E, script de sincronización | Pendiente                                 |

## Notas de ejecución

- El primer cálculo del instante de ataque tenía un adelanto sistemático de unos 39 ms (el pico del flujo marca el cuadro en que la nota entra, no su inicio). Se corrigió refinando dentro del cuadro con la mayor subida de energía en bloques de ~5,8 ms.
- El commit `80d9d59` entró con una prueba en rojo (PU-tempo-03); el siguiente commit lo corrigió. Desde ese momento cada commit se condiciona a que toda la verificación esté en verde.

## Estado de esta versión

Implementado: el núcleo de audio y la fusión simple. Pendiente: todo lo que corre en el navegador y el alineamiento con la partitura.

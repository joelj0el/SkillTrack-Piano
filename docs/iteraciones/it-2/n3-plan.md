# n.3 Plan — Iteración 2 (versión de avance)

| Tarea                              | Descripción                                                | Estado                                             |
| ---------------------------------- | ---------------------------------------------------------- | -------------------------------------------------- |
| TI-HU03-01                         | `getUserMedia` + máquina de estados del intento            | Implementado                                       |
| TI-HU03-02                         | Reglas de calidad visual como funciones puras              | Implementado (umbrales provisionales)              |
| TI-HU03-03                         | Pantalla de captura con guía y semáforo                    | Prototipo: sin detector de la mano                 |
| TI-HU03-04                         | Matriz de dispositivos                                     | Pendiente (manual)                                 |
| TI-HU09-01                         | Homografía por DLT de 4 puntos                             | Implementado (con normalización de Hartley)        |
| TI-HU09-02                         | Modelo del teclado                                         | Implementado                                       |
| TI-HU09-03                         | Punto → tecla con fronteras                                | Implementado                                       |
| TI-HU09-04                         | Asistente de calibración en pantalla                       | Pendiente                                          |
| TI-HU09-05                         | Desplazamiento del teclado → puerta de calidad             | Implementado                                       |
| TI-HU05-01                         | Adaptador de MediaPipe autoalojado                         | Pendiente: requiere el ADR de `'wasm-unsafe-eval'` |
| TI-HU05-02                         | Filtro One Euro                                            | Implementado                                       |
| TI-HU05-03                         | Rasgos de flexión y apertura con invariancia               | Implementado                                       |
| TI-HU05-04                         | Búfer incremental                                          | Pendiente                                          |
| TI-HU05-05, TI-HU12-03, TI-HU36-04 | Golden con clips del autor                                 | Pendiente: requiere los clips                      |
| TI-HU12-01, TI-HU12-02             | Asignación de manos y seguimiento                          | Implementado                                       |
| TI-HU36-01 a 03                    | Descenso, eventos visuales y comparación con la digitación | Implementado (versión simple)                      |
| TI-HU04-01                         | Fin automático (PRM-15)                                    | Implementado                                       |
| TI-HU04-02                         | _Worker_ que ejecuta el núcleo                             | Pendiente                                          |
| TI-HU04-03                         | E2E de la ejecución                                        | Pendiente                                          |
| TI-HU08-01                         | `intento`, `diagnostico` y `ResultadoIntento` v1           | Implementado                                       |
| TI-HU08-02                         | `POST /api/intentos` idempotente, 256 KB, sin binarios     | Implementado                                       |
| TI-HU08-03                         | Bandeja de salida en IndexedDB                             | Implementado                                       |
| TI-HU08-04                         | Prueba de privacidad de un intento completo                | Pendiente (la de encuadre está hecha)              |
| TI-HU18-01 a 04                    | Modo investigación                                         | No incluido en esta versión                        |
| TV-2-01                            | Script de validación V1                                    | Pendiente                                          |

## Notas de ejecución

- Varias tareas del núcleo comparten módulo y entraron en un mismo commit (por ejemplo, TI-HU36-01 a 03); cada commit lo indica.
- La prueba de propiedades PP-geometry-01 encontró un caso real: la DLT con `h33 = 1` fallaba cuando la línea de fuga pasaba por el origen de la imagen. Se corrigió con normalización de Hartley y el caso quedó como PU-geometry-13.

## Estado de esta versión

Implementado: el núcleo y la API. Prototipo: la pantalla de encuadre. Pendiente: detector, calibración en pantalla, _worker_, golden y modo investigación.

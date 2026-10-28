# n.7 Modelos — Iteración 2 (versión de avance)

| Modelo                                         | Tipo                                   | Estado                                                                                             |
| ---------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Detector de la mano (MediaPipe HandLandmarker) | Modelo preentrenado, autoalojado       | Pendiente: su integración requiere `'wasm-unsafe-eval'` en la CSP, que se decide en su propio ADR  |
| Homografía del teclado                         | Geométrico (DLT con normalización)     | Implementado                                                                                       |
| Filtro One Euro                                | Señal                                  | Implementado (parámetros por defecto de la literatura; se ajustan en S1)                           |
| Rasgos de flexión y apertura                   | Geométrico invariante                  | Implementado; la lista de rasgos retenidos la decide S1                                            |
| Identidad de las manos                         | Heurística geométrica + seguimiento    | Implementado                                                                                       |
| Dedo por descenso                              | Heurística sobre la altura de la punta | Implementado en versión simple; la estimación de la altura con la vista de referencia la decide S1 |

**Umbrales provisionales:** los de luz, nitidez, movimiento y caída mínima del dedo están declarados en el código como propuesta sin medición y se ratifican en S1. No hay exactitudes medidas en esta versión.

## Estado de esta versión

Sin modelos entrenados en esta iteración: el único modelo de aprendizaje automático previsto es el detector preentrenado, pendiente de integración.

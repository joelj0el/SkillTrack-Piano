# n.1 Objetivo específico y alcance — Iteración 2 (versión de avance)

## Objetivo específico

**OE2.** Analizar en el teléfono la ejecución del estudiante a partir de la imagen de sus manos sobre el teclado: encuadre y calidad, calibración del teclado, rasgos de la mano, identidad de cada mano, dedo y tecla de cada nota, y registro del intento sin que la imagen salga del teléfono.

## Ítem de la situación problemática

**SP2.** El estudiante practica solo sin saber si la mano, los dedos o la digitación son correctos, y los errores se consolidan.

## Historias incluidas

| Historia | Resumen                                                     |
| -------- | ----------------------------------------------------------- |
| HU-03    | Encuadre con guía en vivo y puerta de calidad visual        |
| HU-09    | Calibración del teclado y cobertura del rango del ejercicio |
| HU-05    | Puntos de la mano y rasgos invariantes                      |
| HU-12    | Identidad de cada mano a manos juntas                       |
| HU-36    | Dedo–tecla y digitación por evento (versión simple)         |
| HU-04    | Ejecución con fin automático                                |
| HU-08    | Intento sin video, bandeja de salida y privacidad           |

## Fuera de alcance de esta versión

- HU-18 (modo investigación): no se construyó.
- Integración del detector de la mano (MediaPipe): requiere permitir `'wasm-unsafe-eval'` en la CSP, una decisión que se registra en su propio ADR antes de aplicarse.
- Criterios de exactitud que necesitan clips anotados del autor.

## Estado de esta versión

| Elemento                                                           | Estado       | Motivo                                                                           |
| ------------------------------------------------------------------ | ------------ | -------------------------------------------------------------------------------- |
| Núcleo de análisis (geometría, calidad, rasgos, manos, dedos)      | Implementado | Funciones puras con pruebas unitarias y de propiedades sobre datos sintéticos    |
| API de intentos y bandeja de salida                                | Implementado | PA-HU08-01, 02 y 05 en verde                                                     |
| Pantalla de encuadre                                               | Prototipo    | Mide luz, nitidez y movimiento en vivo; sin detector de la mano no llega a verde |
| Detector de la mano, calibración en pantalla, _worker_ de análisis | Pendiente    | Ver n.3                                                                          |

# n.2 Requerimientos — Iteración 2 (versión de avance)

Criterios de aceptación de la It-2 y su estado en esta versión. "Prototipo" indica que la lógica existe y tiene pruebas unitarias, pero el criterio completo (de punta a punta) todavía no se puede ejecutar. El resultado de cada prueba está en `n6-pruebas.generado.md`.

## Actualización: versión de demostración

Con el ADR-002 (`'wasm-unsafe-eval'` solo en `script-src`) se integró el detector de la mano autoalojado y el recorrido completo en el teléfono: encuadre con los 21 puntos de cada mano, Izquierda/Derecha y fps → calibración de 4 toques con las teclas dibujadas y la tecla bajo cada dedo → conteo → "Tocando" → fin automático → análisis en un Web Worker → resultado provisional por nota → intento guardado por la bandeja de salida. La secuencia esperada es **provisional** (escala de 2 octavas generada desde la tónica, sin digitación) mientras no exista la partitura transcrita.

Cambios de estado respecto de las tablas siguientes:

| PA                     | Estado ahora                          | Motivo                                                                                                                                                                                                                                      |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU03-01             | Prototipo                             | Con las dos manos visibles y buena luz el semáforo llega a verde y, tras 3 s seguidos en verde, el paso avanza solo (sin botón, porque las manos están en el teclado); se verifica a mano con la cámara (la cámara simulada no tiene manos) |
| PA-HU09-01             | Prototipo                             | Asistente de 4 toques con teclas dibujadas, "Confirmar" y "Repetir", guardado en IndexedDB; sin prueba E2E (requiere un clip con teclado)                                                                                                   |
| PA-HU09-04             | Prototipo                             | La calibración verifica que el rango quede dentro de la imagen y dice qué falta                                                                                                                                                             |
| PA-HU04-01, 02, 04     | Prototipo                             | Conteo → Tocando → Analizando sin botón "Enviar"; límite y "Cancelar" en pantalla; sin prueba E2E con manos                                                                                                                                 |
| PA-HU04-03             | Prototipo                             | El análisis corre en un Web Worker y el resultado muestra su duración; sin medición con el clip más largo                                                                                                                                   |
| PA-HU04-05, PA-HU08-03 | Prototipo                             | El intento se guarda por la bandeja de salida (solo números)                                                                                                                                                                                |
| PA-HU05-01             | Pendiente: requiere fixtures anotados | El detector funciona en vivo (GPU con repliegue a CPU); la tasa de detección no se midió                                                                                                                                                    |

Pruebas nuevas: PU-web-11 (el detector autoalojado carga y procesa la cámara simulada, sin manos no arranca la cuenta atrás ni avanza, y no sale ningún medio por la red), PU-capture-08 a 13, PU-capture-16 a 18 (cuenta atrás de 3 s en verde), PU-exercise-01 a 04, PU-geometry-14 y PU-infra-04.

## HU-03 · Encuadrar con guía en vivo y puerta de calidad visual

| PA         | Tipo     | Estado       | Motivo                                                                                                                                              |
| ---------- | -------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU03-01 | auto-e2e | Pendiente    | El verde exige las manos visibles: falta el detector de la mano y el clip del autor bien encuadrado                                                 |
| PA-HU03-02 | auto-e2e | Prototipo    | Las reglas de luz, encuadre, manos y movimiento dan su motivo con texto y nivel (PU-quality-01 a 04); faltan los clips del autor para la prueba E2E |
| PA-HU03-03 | auto-e2e | Implementado | Pantalla con pasos y "Reintentar" cuando se niega el permiso                                                                                        |
| PA-HU03-04 | manual   | Pendiente    | Matriz de dispositivos                                                                                                                              |
| PA-HU03-05 | auto-e2e | Implementado | 30 s de encuadre con cámara simulada sin peticiones de imagen o video                                                                               |

## HU-09 · Calibrar el teclado

| PA         | Tipo     | Estado                                | Motivo                                                                                                                                  |
| ---------- | -------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU09-01 | auto-e2e | Pendiente                             | Falta el asistente de 4 toques en pantalla; la homografía y el modelo del teclado existen (PU-geometry, PP-geometry)                    |
| PA-HU09-02 | auto-e2e | Pendiente: requiere fixtures anotados | La tecla bajo la punta se verifica con fronteras sintéticas (PU-geometry-06 a 10)                                                       |
| PA-HU09-03 | manual   | Pendiente                             | S4 con estudiantes                                                                                                                      |
| PA-HU09-04 | auto-e2e | Prototipo                             | `coberturaDelRango` dice qué falta (PU-geometry-12); el rango de cada ejercicio depende de la transcripción de la partitura             |
| PA-HU09-05 | auto-e2e | Prototipo                             | Desplazamiento > PRM-17 invalida la calibración (PU-quality-05) y el intento termina "No evaluable: se movió la cámara" (PU-capture-07) |

## HU-05 · Puntos de la mano y rasgos invariantes

| PA         | Tipo     | Estado       | Motivo                                                                                                              |
| ---------- | -------- | ------------ | ------------------------------------------------------------------------------------------------------------------- |
| PA-HU05-01 | auto-e2e | Pendiente    | Requiere el detector de la mano y clips del autor                                                                   |
| PA-HU05-02 | auto-e2e | Prototipo    | Flexión MCP/PIP/DIP y apertura calculadas e invariantes (PP-features-01); la lista de rasgos retenidos la decide S1 |
| PA-HU05-03 | manual   | Pendiente    | S5 en dispositivos                                                                                                  |
| PA-HU05-04 | auto-e2e | Pendiente    | Requiere el detector y un clip con la mano fuera de cuadro                                                          |
| PA-HU05-05 | auto-api | Implementado | El intento exige y guarda `version_nucleo` y `version_modelo_mano`                                                  |

## HU-12 · Identificar cada mano a manos juntas

| PA         | Tipo     | Estado                                | Motivo                                                                              |
| ---------- | -------- | ------------------------------------- | ----------------------------------------------------------------------------------- |
| PA-HU12-01 | auto-e2e | Pendiente: requiere fixtures anotados | Asignación por geometría verificada con datos sintéticos (PU-features-07)           |
| PA-HU12-02 | auto-e2e | Pendiente: requiere fixtures anotados | Sin intercambios ante cualquier orden del detector (PU-features-08, PP-features-02) |
| PA-HU12-03 | auto-e2e | Prototipo                             | La otra mano se descarta en tareas de una mano (PU-features-10)                     |
| PA-HU12-04 | manual   | Pendiente                             | Matriz de dispositivos                                                              |

## HU-36 · Dedo–tecla y digitación por evento

| PA         | Tipo     | Estado                                | Motivo                                                                                                                |
| ---------- | -------- | ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| PA-HU36-01 | auto-e2e | Pendiente: requiere fixtures anotados | —                                                                                                                     |
| PA-HU36-02 | auto-e2e | Pendiente: requiere fixtures anotados | La clasificación correcta / dedo incorrecto / no evaluable existe (PU-features-14)                                    |
| PA-HU36-03 | auto-e2e | Prototipo                             | Pulgar oculto → no evaluable por evento y regla de PRM-16 (PU-features-15, 17)                                        |
| PA-HU36-04 | auto-e2e | Pendiente: requiere fixtures anotados | La posición a lo largo de la tecla se registra (PU-geometry-10); las bandas de fondo y borde llegan con la referencia |

## HU-04 · Ejecutar el ejercicio con fin automático

| PA         | Tipo     | Estado    | Motivo                                                                                                 |
| ---------- | -------- | --------- | ------------------------------------------------------------------------------------------------------ |
| PA-HU04-01 | auto-e2e | Prototipo | Conteo → Tocando → Analizando sin botón "Enviar" (PU-capture-03, 04); no se puede iniciar sin detector |
| PA-HU04-02 | auto-e2e | Prototipo | Límite de 1,5 × la duración esperada → "incompleta" (PU-capture-05)                                    |
| PA-HU04-03 | auto-e2e | Pendiente | Falta el _worker_ de análisis y el clip más largo del repertorio                                       |
| PA-HU04-04 | auto-e2e | Prototipo | Cancelar descarta el intento (PU-capture-06)                                                           |
| PA-HU04-05 | auto-e2e | Prototipo | La bandeja solo acepta un `ResultadoIntento` válido, sin campos de medios (PU-outbox-03)               |

## HU-08 · Persistir cada intento sin video

| PA         | Tipo     | Estado       | Motivo                                                                                        |
| ---------- | -------- | ------------ | --------------------------------------------------------------------------------------------- |
| PA-HU08-01 | auto-api | Implementado | Idempotencia por `client_uuid`: 201 y luego 200, una sola fila                                |
| PA-HU08-02 | auto-api | Implementado | > 256 KB → 413; multipart, audio, video o imagen → 415 (en toda escritura bajo `/api`)        |
| PA-HU08-03 | auto-e2e | Prototipo    | Pendiente sin red y guardado con red (PU-outbox-01); falta un intento real para la prueba E2E |
| PA-HU08-04 | auto-e2e | Pendiente    | Requiere un intento completo; la parte de encuadre está cubierta por PA-HU03-05               |
| PA-HU08-05 | auto-api | Implementado | Campos del intento de tarea y 403 para el docente no asignado                                 |

## Estado de esta versión

- **Implementado:** PA-HU03-03, PA-HU03-05, PA-HU05-05, PA-HU08-01, PA-HU08-02 y PA-HU08-05.
- **Prototipo:** la lógica de los demás criterios automáticos está en el núcleo con pruebas sobre datos sintéticos.
- **Pendiente:** todo criterio que necesita el detector de la mano, clips anotados del autor o pruebas en dispositivos.

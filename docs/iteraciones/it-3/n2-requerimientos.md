# n.2 Requerimientos — Iteración 3 (versión de avance)

En esta versión ningún criterio de aceptación de la It-3 se ejecuta de punta a punta: todos dependen de la captura de audio en el navegador o de fixtures del autor. La lógica que los sostiene está en el núcleo con pruebas unitarias sobre señales sintéticas ("Prototipo").

## Actualización: versión de demostración

La captura de audio quedó integrada en el teléfono: AudioWorklet sin procesamiento del navegador, prueba de micrófono (P-37, también como pantalla propia `/microfono`), preparación con tempo y dos modos de metrónomo (P-34), conteo de 4 clics audibles con pulso visual, grabación sincronizada con la imagen y resultado provisional con cada nota como ✓ / ✗ / dudosa / faltante / extra, tempo inicial frente a final, notas irregulares y la mano y el dedo atribuidos por la visión a cada ataque. Todo el audio se procesa en el teléfono.

Cambios de estado respecto de las tablas siguientes:

| PA                 | Estado ahora | Motivo                                                                                                                                  |
| ------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU20-03         | Implementado | E2E: sin permiso de micrófono se ofrece el modo solo visión                                                                             |
| PA-HU20-01         | Prototipo    | Semáforo con los textos del criterio en P-37; faltan los fixtures de micrófono                                                          |
| PA-HU20-02         | Prototipo    | Se pide el audio sin procesamiento y se avisa si el navegador no lo respetó; aún no se registra en el intento (requiere el contrato v2) |
| PA-HU19-01, 02, 03 | Prototipo    | Selector de tempo con práctica lenta, conteo audible con pulso visual y pulso visual mudo con metrónomo; el modo queda en el intento    |
| PA-HU10-02 a 05    | Prototipo    | Calculados en el teléfono sobre los ataques reales; sin fixtures del autor                                                              |
| PA-HU21-02, 03, 04 | Prototipo    | Incorrecta, dudosa, faltante y extra con alineamiento de secuencias (PU-align-04 a 07)                                                  |
| PA-HU11-02         | Prototipo    | Mano y dedo atribuidos a cada ataque con la modalidad (VA o A)                                                                          |

Pruebas nuevas: PU-web-12 (micrófono simulado: nivel, prueba completa y ningún audio por la red), PA-HU20-03 (E2E), PU-align-04 a 07 y PU-capture-13.

## HU-19 · Tempo, modo de metrónomo y conteo previo

| PA         | Estado    | Motivo / prueba del núcleo                                                                                              |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| PA-HU19-01 | Prototipo | Selector de 40 al máximo de la tarea y etiqueta de práctica lenta (PU-tempo-04, 05); falta la pantalla                  |
| PA-HU19-02 | Prototipo | Conteo de 4 pulsos y medición desde el pulso siguiente (PU-tempo-01, 03); falta el sonido y el pulso visual en pantalla |
| PA-HU19-03 | Prototipo | Pulso visual mudo solo con metrónomo (PU-tempo-02); el modo ya se registra en el intento (It-2)                         |
| PA-HU19-04 | Pendiente | Manual (S2)                                                                                                             |

## HU-20 · Prueba de micrófono y puerta acústica

| PA         | Estado    | Motivo / prueba del núcleo                                                                                      |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| PA-HU20-01 | Prototipo | Verde, ruido y saturación con sus mensajes (PU-quality-06 a 09); faltan los fixtures de micrófono y la pantalla |
| PA-HU20-02 | Pendiente | Requiere la captura de audio en el navegador                                                                    |
| PA-HU20-03 | Pendiente | Requiere la pantalla de micrófono                                                                               |
| PA-HU20-04 | Pendiente | Requiere fixture con ruido a mitad de la ejecución                                                              |

## HU-10 · Ataques, tempo estable y regularidad

| PA         | Estado                                | Motivo / prueba del núcleo                                                                                                       |
| ---------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU10-01 | Pendiente: requiere fixtures anotados | En señal sintética limpia el error de ataque es ≤ 10 ms (PU-audio-05, 09) y el F1 se calcula con tolerancia ±50 ms (PU-audio-08) |
| PA-HU10-02 | Prototipo                             | Estable, aceleraste y frenaste con tempo inicial, final y porcentaje (PU-audio-10, 11, 12)                                       |
| PA-HU10-03 | Prototipo                             | Solo la nota retrasada 40 % se marca y el tempo sigue estable (PU-audio-13, 14)                                                  |
| PA-HU10-04 | Prototipo                             | Referencia: tempo elegido con metrónomo, tempo inicial sin él (PU-audio-15)                                                      |
| PA-HU10-05 | Prototipo                             | Mensaje "Tocaste a ♩≈55; tu tarea pide 60–70" y no cuenta (PU-audio-16)                                                          |

## HU-21 · Clase de altura

| PA         | Estado                                | Motivo / prueba del núcleo                                                              |
| ---------- | ------------------------------------- | --------------------------------------------------------------------------------------- |
| PA-HU21-01 | Pendiente: requiere fixtures anotados | Las cuatro escalas del repertorio se verifican en señal sintética (PU-audio-17)         |
| PA-HU21-02 | Pendiente                             | Nota incorrecta (PU-audio-18); la atribución a la mano depende de HU-36 con el detector |
| PA-HU21-03 | Prototipo                             | Energía insuficiente → "dudosa", nunca incorrecta (PU-audio-20)                         |
| PA-HU21-04 | Pendiente                             | Requiere el alineamiento con la partitura                                               |

## HU-11 · Sincronizar visión, audio y partitura

| PA             | Estado    | Motivo / prueba del núcleo                                                                                      |
| -------------- | --------- | --------------------------------------------------------------------------------------------------------------- |
| PA-HU11-01     | Pendiente | Manual (S3)                                                                                                     |
| PA-HU11-02     | Prototipo | Dedo atribuido y modalidad VA o A por ataque (PU-align-01 a 03); falta el registro completo por evento esperado |
| PA-HU11-03, 04 | Pendiente | Requieren el alineamiento por mano                                                                              |
| PA-HU11-05     | Pendiente | Requiere el intento completo con cámara y micrófono                                                             |

HU-37 (avance de la tarea) no se incluyó en esta versión.

## Estado de esta versión

- **Implementado:** ningún PA de punta a punta.
- **Prototipo:** la lógica de los criterios marcados así, con pruebas unitarias en verde (`n6-pruebas.generado.md`).
- **Pendiente:** captura de audio, pantallas, alineamiento con la partitura y todo lo que requiere fixtures o dispositivos.

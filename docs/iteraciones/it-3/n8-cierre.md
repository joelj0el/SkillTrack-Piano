# n.8 Cierre — Iteración 3 (versión de avance)

## Checklist de cumplimiento

| Historia | Entregable de esta versión                 | Estado                                             |
| -------- | ------------------------------------------ | -------------------------------------------------- |
| HU-19    | Programa del metrónomo y selector de tempo | Núcleo implementado; pantalla y sonido pendientes  |
| HU-20    | Puerta acústica                            | Núcleo implementado; captura y pantalla pendientes |
| HU-10    | Ataques, tempo y tropiezo                  | Núcleo implementado                                |
| HU-21    | Croma y verificación con "dudoso"          | Núcleo implementado                                |
| HU-11    | Dedo atribuido por ataque                  | Fusión simple implementada; alineamiento pendiente |
| HU-37    | Avance de la tarea                         | No incluido                                        |

## Revisión de riesgos

| Riesgo                                    | Situación                                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Señales sintéticas frente a pianos reales | Las pruebas no cubren la resonancia, el ruido de sala ni el teclado electrónico: se validan con las grabaciones del autor |
| Umbrales provisionales                    | Declarados en el código; se ratifican en S2, S3 y la Campaña A                                                            |
| Privacidad del audio                      | El audio se procesará en el teléfono como el video; la prueba de privacidad del audio llega con la captura                |

## Trazabilidad

| SP  | OE  | Historia | Componentes              | Pruebas            |
| --- | --- | -------- | ------------------------ | ------------------ |
| SP3 | OE3 | HU-19    | `core/audio` (metrónomo) | PU-tempo           |
| SP3 | OE3 | HU-20    | `core/quality`           | PU-quality-06 a 09 |
| SP3 | OE3 | HU-10    | `core/audio`             | PU-audio-01 a 16   |
| SP3 | OE3 | HU-21    | `core/audio`             | PU-audio-17 a 20   |
| SP3 | OE3 | HU-11    | `core/align`             | PU-align           |

## Estado de esta versión

La It-3 de esta versión entrega el núcleo de audio con pruebas sobre señales sintéticas. Falta integrarlo en el navegador y validarlo con grabaciones reales.

# n.8 Cierre — Iteración 2 (versión de avance)

## Checklist de cumplimiento

| Historia | Entregable                                                | Estado                                                                 |
| -------- | --------------------------------------------------------- | ---------------------------------------------------------------------- |
| HU-03    | Encuadre con semáforo y error de permiso                  | Prototipo (sin detector)                                               |
| HU-09    | Homografía, modelo del teclado, cobertura, desplazamiento | Núcleo implementado; asistente en pantalla pendiente                   |
| HU-05    | Rasgos invariantes y filtro                               | Núcleo implementado; detector pendiente                                |
| HU-12    | Identidad de las manos                                    | Núcleo implementado                                                    |
| HU-36    | Dedo, tecla y digitación por evento                       | Núcleo implementado (simple)                                           |
| HU-04    | Fin automático                                            | Máquina de estados implementada; _worker_ pendiente                    |
| HU-08    | Intento sin video, bandeja de salida                      | API y bandeja implementadas; privacidad del intento completo pendiente |
| HU-18    | Modo investigación                                        | No incluido                                                            |

Resultados de las pruebas: `n6-pruebas.generado.md`.

## Revisión de riesgos

| Riesgo                  | Situación                                                                                                                                    |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Privacidad de la imagen | Ningún endpoint acepta binarios (415/413); el contrato del intento no admite campos extra; 30 s de encuadre sin peticiones de imagen o video |
| CSP y WASM del detector | Bloquea el detector hasta registrar la decisión de `'wasm-unsafe-eval'`                                                                      |
| Sin clips anotados      | Bloquea las PA de exactitud; el núcleo se probó con datos sintéticos y propiedades                                                           |
| Umbrales sin medir      | Declarados como propuesta; se ratifican en S1                                                                                                |

## Trazabilidad

| SP  | OE           | Historia | Componentes                      | Pruebas                                         |
| --- | ------------ | -------- | -------------------------------- | ----------------------------------------------- |
| SP2 | OE2          | HU-03    | `capture`, `quality`             | PA-HU03-03, PA-HU03-05, PU-quality              |
| SP2 | OE2          | HU-09    | `core/geometry`, `core/quality`  | PU-geometry, PP-geometry, PU-quality-05         |
| SP2 | OE2          | HU-05    | `core/features`                  | PU-features-01 a 06, PP-features-01, PA-HU05-05 |
| SP2 | OE2          | HU-12    | `core/features`                  | PU-features-07 a 10, PP-features-02             |
| SP2 | OE2          | HU-36    | `core/features`, `core/geometry` | PU-features-11 a 18                             |
| SP2 | OE2          | HU-04    | `capture`                        | PU-capture                                      |
| —   | Habilitadora | HU-08    | `attempts`, `outbox`             | PA-HU08-01, 02, 05, PU-attempts, PU-outbox      |

## Estado de esta versión

La It-2 de esta versión entrega el núcleo de análisis visual y la persistencia sin video, con pruebas en verde. Para el recorrido completo en el teléfono falta el detector de la mano (con su ADR), la calibración en pantalla y el _worker_.

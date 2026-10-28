# ADR-002 — `'wasm-unsafe-eval'` en la CSP para el detector de la mano

**Estado:** aceptado (autor) · **Fecha:** 2026-10-28 · **Códigos:** T-04, T-23 · **Visto bueno de la tutora:** sí (pendiente)

## Contexto

El análisis de la mano corre en el teléfono con MediaPipe HandLandmarker (T-04), con el modelo y el WASM autoalojados en el mismo origen. La política de seguridad del contenido (T-23) permite solo scripts propios (`script-src 'self'`). Los navegadores tratan la compilación de WebAssembly como evaluación de código: sin una fuente que la autorice, `WebAssembly.instantiate` falla y el detector no arranca. La decisión de seguridad ya preveía `'wasm-unsafe-eval'` "solo si MediaPipe lo exige".

## Alternativas consideradas (criterios y evaluación)

| Alternativa                                   | Seguridad                                                                 | Privacidad                                                         | Viabilidad                                            | Evaluación                                                     |
| --------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------- | -------------------------------------------------------------- |
| **`'wasm-unsafe-eval'` solo en `script-src`** | Permite compilar WASM; no habilita `eval` ni `new Function` de JavaScript | Sin cambio: el WASM es propio y `connect-src` sigue en `'self'`    | Soportado por Chrome, Edge, Firefox y Safari actuales | **Elegida**                                                    |
| `'unsafe-eval'`                               | Habilita la evaluación de JavaScript arbitrario                           | Sin cambio                                                         | Funciona                                              | Descartada: amplía la superficie de ataque más de lo necesario |
| Procesar la imagen en el servidor             | No requiere cambiar la CSP                                                | Viola el invariante de privacidad (la imagen saldría del teléfono) | —                                                     | Descartada                                                     |
| Prescindir de MediaPipe                       | No requiere cambiar la CSP                                                | Sin cambio                                                         | Sin detector no hay OE2                               | Descartada                                                     |

## Decisión

La CSP agrega exactamente `'wasm-unsafe-eval'` a `script-src` y nada más: `script-src 'self' 'wasm-unsafe-eval'`. Siguen prohibidos `'unsafe-eval'` y `'unsafe-inline'`, `default-src` y `connect-src` siguen en `'self'`, y el modelo y el WASM se sirven desde el mismo origen (sin CDN). La prueba de cabeceras PU-infra-01 verifica que `script-src` es exactamente `'self' 'wasm-unsafe-eval'`.

## Consecuencias (positivas / negativas / qué cambia en el perfil o en la Sección II)

- **Positivas:** el detector de la mano funciona en el teléfono sin enviar imágenes a ningún servidor.
- **Negativas:** cualquier script propio podría compilar WebAssembly; el riesgo queda acotado porque solo se ejecutan scripts del mismo origen.
- **Sección II:** la descripción de la CSP en el apartado de seguridad incluye `'wasm-unsafe-eval'` con esta justificación.

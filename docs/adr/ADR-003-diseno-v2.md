# ADR-003 — Diseño v2: tamaño de portada, radio extra, fuentes autoalojadas y vidrio

**Estado:** aceptado (autor) · **Fecha:** 2026-11-23 · **Códigos:** DS-01, DS-04, DS-06, RNF-16 · **Visto bueno de la tutora:** pendiente

## Contexto

El sistema de diseño v0 fija la escala tipográfica 13 / 15 / 17 / 20 / 28 / 34 px (DS-01) y los radios 8 / 12 / 20 px (DS-04), con la fuente del sistema. El diseño v2 de la interfaz (paleta "Azul marino y crema" en claro e "Índigo y violeta" en oscuro) usa portadas con un saludo grande, tarjetas muy redondeadas, dos tipografías (una con serifa para títulos y otra para el texto) y paneles translúcidos ("vidrio"). La política de seguridad del contenido solo permite recursos del mismo origen (`default-src 'self'`, `style-src 'self'`).

## Alternativas consideradas (criterios y evaluación)

| Alternativa                                                           | Fidelidad al diseño v2         | Reglas v0                    | Seguridad y privacidad         | Evaluación              |
| --------------------------------------------------------------------- | ------------------------------ | ---------------------------- | ------------------------------ | ----------------------- |
| **Ampliar con un tamaño de portada (44 px) y un radio extra (28 px)** | Alta                           | Se amplían, documentado aquí | Sin cambio                     | **Elegida**             |
| Mantener la escala y los radios v0                                    | Media: portadas menos marcadas | Sin cambio                   | Sin cambio                     | Descartada por el autor |
| Fuentes desde un servicio externo (Google Fonts)                      | Alta                           | —                            | Rompe la CSP y expone la IP    | Descartada              |
| **Fuentes autoalojadas (Inter y DM Serif Display, licencia OFL)**     | Alta                           | —                            | Mismo origen; la CSP no cambia | **Elegida**             |

## Decisión

- **DS-01:** se agrega `--texto-portada` (2,75 rem = 44 px) **solo** para el título de las portadas y la frase del panel de la entrada; el resto de la interfaz sigue en la escala v0 y el mínimo de 15 px para el estudiante.
- **DS-04:** se agrega `--radio-xl` (1,75 rem = 28 px) para portadas, tarjetas de vidrio y la tarjeta de la entrada.
- **Tipografía:** Inter (texto) y DM Serif Display (títulos y saludos), instaladas como dependencias `@fontsource/*` (OFL-1.1) y servidas por la propia aplicación; quedan en la caché de la PWA.
- **Vidrio:** solo en inicio, entrada, paneles y resultados. Siempre sobre un fondo sólido; sin `backdrop-filter` la superficie cae al color sólido de la tarjeta, que cumple el contraste AA. La calibración y la práctica no usan vidrio, desenfoques ni animaciones pesadas.
- **Contraste (DS-06):** los colores nuevos (botones, menú lateral, portada) se agregan a `pnpm design:contraste`, que los verifica en claro y oscuro.

## Consecuencias (positivas / negativas / qué cambia en el perfil o en la Sección II)

- **Positivas:** la interfaz gana jerarquía visual sin enviar nada a otro origen.
- **Negativas:** dos dependencias nuevas de fuentes (~100 KB en la caché); el vidrio exige más al navegador, por eso se limita a pantallas sin cámara.
- **Sección II:** el apartado del sistema de diseño describe la v2 y remite a este ADR para las dos ampliaciones.

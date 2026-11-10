# ADR-001 — Backend con FastAPI

**Estado:** aceptado (autor) · **Fecha:** 2026-11-10 · **Códigos:** T-16, T-32, R-20, RD-01 · **Visto bueno de la tutora:** pendiente

## Contexto

El servidor atiende el CRUD de usuarios, tareas y observaciones con roles y pertenencia, distribuye artefactos versionados (ejercicio, referencia, reglas) y calcula agregados para los tableros. No ejecuta aprendizaje automático: el análisis corre en el teléfono y el clasificador se entrena fuera de línea.

Una primera evaluación de alternativas recomendó NestJS por un margen pequeño. Esa evaluación no pesaba dos hechos del proyecto:

- el perfil aprobado ya nombra FastAPI en su Tabla Nº 1, y cambiarlo exige justificarlo ante la tutora;
- el autor ya trabajó con FastAPI, SQLAlchemy y Alembic.

## Alternativas consideradas (criterios y evaluación)

Escala de 1 a 5 (5 = mejor). El total es la suma ponderada dividida por 100.

| Criterio                                                                          | Peso | NestJS | FastAPI  | Django + DRF | Fastify / Express |
| --------------------------------------------------------------------------------- | ---- | ------ | -------- | ------------ | ----------------- |
| Compartir contratos con el cliente y el núcleo (con generación para Python, T-32) | 20   | 5      | 4        | 2            | 5                 |
| Estructura modular y autorización por rol y pertenencia                           | 15   | 5      | 4        | 4            | 2                 |
| Productividad del autor                                                           | 15   | 5      | 5        | 4            | 4                 |
| Código previo del autor con ese stack                                             | 10   | 3      | 5        | 2            | 2                 |
| Coherencia con el perfil aprobado (Tabla Nº 1)                                    | 15   | 2      | 5        | 2            | 2                 |
| Ecosistema de aprendizaje automático en el servidor                               | 5    | 2      | 5        | 5            | 2                 |
| Memoria en una máquina virtual de 1 GB (R-20)                                     | 5    | 3      | 4        | 3            | 5                 |
| Pruebas (unitarias e integración con base real)                                   | 5    | 5      | 4        | 4            | 3                 |
| Defendibilidad y documentación (OpenAPI, arquitectura explicable)                 | 10   | 5      | 5        | 4            | 3                 |
| **Total**                                                                         | 100  | 4,10   | **4,55** | 3,10         | 3,20              |

**Sensibilidad:** sin los criterios "código previo" y "coherencia con el perfil", NestJS quedaría primero. La diferencia técnica entre ambos es pequeña. Lo que inclina la decisión son la coherencia con el perfil aprobado y la experiencia del autor, criterios legítimos en un proyecto con un solo desarrollador (RD-01). Ninguna de las dos opciones pone en riesgo el proyecto.

## Decisión

El backend se construye con FastAPI, SQLAlchemy 2 y Alembic, con esta condición (T-32):

1. `packages/contracts` (Zod) es la única fuente de los esquemas compartidos.
2. `pnpm contracts:gen` exporta JSON Schema y genera los modelos Pydantic en `apps/api/app/contracts_gen/`.
3. La integración continua repite la generación y falla si aparecen diferencias.
4. Nadie edita `contracts_gen/` a mano.
5. Los modelos que solo usa el servidor pueden escribirse en Pydantic, en el `schemas.py` de su módulo.

## Consecuencias (positivas / negativas / qué cambia en el perfil o en la Sección II)

- **Positivas:** coherencia con el perfil aprobado; OpenAPI automática; el autor trabaja con un stack que domina.
- **Negativas:** dos lenguajes en producción (TypeScript y Python) y un paso de generación de contratos que la integración continua debe vigilar.
- **Perfil:** no cambia.
- **Sección II:** el capítulo de arquitectura presenta esta matriz y la condición T-32.
- **Visto bueno de la tutora:** pendiente.

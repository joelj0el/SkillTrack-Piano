# SkillTrack-Piano

Aplicación Web Progresiva (PWA) para el análisis y seguimiento de estudiantes principiantes de piano en instituciones musicales de Cochabamba. Proyecto de Grado — Ingeniería de Sistemas, Universidad Adventista de Bolivia. Autor: Jhoel Titirico Charca.

El análisis de la mano (visión) y del sonido (audio) se ejecuta **en el dispositivo del estudiante**: el video y el audio nunca salen del teléfono. Al servidor solo llegan resultados.

## Requisitos

| Herramienta | Versión                                               | Instalación en Windows                |
| ----------- | ----------------------------------------------------- | ------------------------------------- |
| Node.js     | ≥ 24                                                  | <https://nodejs.org>                  |
| pnpm        | 12.15.0 (fijada en `package.json`)                    | `corepack enable`                     |
| uv          | ≥ 0.13                                                | `winget install --id=astral-sh.uv -e` |
| Python      | 3.12 (fijada en `.python-version`, gestionada por uv) | `uv python install 3.12`              |
| Docker      | Docker Desktop con Compose                            | <https://www.docker.com>              |

Python se usa **siempre** a través de `uv run`, nunca con el intérprete del sistema.

## Levantar el sistema completo

```bash
docker compose -f infra/docker-compose.yml up
```

Abre **<https://localhost>**. Caddy usa un certificado interno: el navegador pedirá aceptarlo la primera vez. La API responde en <https://localhost/api/health>.

## Desarrollo

```bash
pnpm install                               # dependencias de TypeScript
uv sync --project apps/api                 # dependencias de la API
```

## Pruebas

```bash
pnpm test                                  # Vitest (núcleo, contratos, web, herramientas)
uv run --project apps/api pytest           # API (pytest + testcontainers; requiere Docker)
pnpm lint                                  # ESLint
pnpm contracts:gen                         # Zod → JSON Schema → Pydantic (apps/api/app/contracts_gen/)
```

## Estructura

| Carpeta              | Contenido                                                           |
| -------------------- | ------------------------------------------------------------------- |
| `apps/web`           | PWA (React + Vite + TypeScript)                                     |
| `apps/api`           | API (FastAPI + SQLAlchemy + Alembic)                                |
| `packages/core`      | Núcleo de análisis en TypeScript puro                               |
| `packages/contracts` | Esquemas Zod: única fuente de los contratos                         |
| `research/`          | Scripts de investigación (los datos **no** están en el repositorio) |
| `infra/`             | Docker Compose y Caddy                                              |
| `docs/`              | Decisiones, requerimientos, arquitectura e iteraciones              |

Las decisiones técnicas se registran en `docs/adr/`.

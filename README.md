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

Usa `--build` la primera vez o después de cambiar el código. Abre **<https://localhost>**. La API responde en <https://localhost/api/health> y aplica sus migraciones al arrancar.

Caddy firma el certificado de `localhost` con una autoridad interna, así que el navegador lo marca como no confiable. Para confiar en ella en Windows, exporta su certificado raíz a una carpeta fuera del repositorio e impórtalo en el almacén del usuario:

```bash
docker compose -f infra/docker-compose.yml cp web:/data/caddy/pki/authorities/local/root.crt "$HOME/caddy-local-root.crt"
certutil -user -addstore Root "$HOME/caddy-local-root.crt"
```

La contraseña de la base local es de desarrollo (`skilltrack`). Se puede cambiar con la variable `POSTGRES_PASSWORD` antes de levantar el sistema.

## Desarrollo

```bash
pnpm install                               # dependencias de TypeScript
pnpm dev                                   # PWA en modo desarrollo (Vite)
uv sync --project apps/api                 # dependencias de la API
```

La API lee su configuración de variables de entorno. Para desarrollo local, copia `apps/api/.env.example` como `apps/api/.env` y ajusta `DATABASE_URL`. El archivo `.env` nunca se versiona.

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

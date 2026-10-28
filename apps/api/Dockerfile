# Contexto de construcción: raíz del repositorio (ver infra/docker-compose.yml).
FROM python:3.12.16-slim-trixie

COPY --from=ghcr.io/astral-sh/uv:0.13.5 /uv /bin/uv

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH=/opt/venv/bin:$PATH

WORKDIR /app
COPY apps/api/pyproject.toml apps/api/uv.lock apps/api/.python-version ./
RUN uv sync --frozen --no-dev

COPY apps/api/alembic.ini ./
COPY apps/api/app ./app
COPY apps/api/migrations ./migrations

RUN useradd --system --uid 10001 api
USER api

EXPOSE 8000
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8000"]

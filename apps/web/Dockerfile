# Contexto de construcción: raíz del repositorio (ver infra/docker-compose.yml).
FROM node:24.22.1-alpine AS construccion

RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/contracts/package.json packages/contracts/
RUN pnpm install --frozen-lockfile

COPY packages packages
COPY apps/web apps/web
RUN pnpm --filter @skilltrack/web build

FROM caddy:2.11.7-alpine
COPY infra/Caddyfile /etc/caddy/Caddyfile
COPY --from=construccion /repo/apps/web/dist /srv

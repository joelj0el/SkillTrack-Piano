# 🎹 SkillTrack Piano

**Seguimiento pedagógico de práctica de piano asistido por visión artificial on-device.**
Una PWA que analiza en el propio dispositivo del estudiante la postura de manos y la ejecución rítmica frente a una partitura esperada, y comparte los resultados con sus docentes.

![Python](https://img.shields.io/badge/Python-3.12-blue)
![Node](https://img.shields.io/badge/Node-20-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791)
![Docker](https://img.shields.io/badge/Docker-required-2496ED)

## Descripción del proyecto

SkillTrack Piano ayuda a estudiantes de piano a practicar ejercicios y escalas con retroalimentación objetiva, y a sus docentes a hacer seguimiento del progreso sin estar presentes en cada sesión. El estudiante graba su práctica desde el navegador; el análisis de postura de manos corre **on-device** con MediaPipe HandLandmarker (sin enviar video a un servidor), comparando lo detectado contra una partitura esperada y umbrales de referencia validados por docentes. El resultado estructurado (`SessionResult`) es lo único que viaja al backend. Pensado para funcionar como PWA instalable en Android y como página web en iOS Safari (iOS no permite PWAs con acceso completo a cámara fuera de Safari).

## Arquitectura

Cliente enriquecido (PWA React + pipeline de IA on-device) → API monolito modular (FastAPI, async) → PostgreSQL como única fuente de verdad. Ver el modelo de datos completo en [`db/modelo_er.md`](db/modelo_er.md).

## Requisitos previos

- Docker Desktop ≥ 4.x
- Git
- (Opcional, para desarrollo fuera de Docker) Node 20 y Python 3.12

## Levantar el entorno

```bash
git clone https://github.com/joelj0el/SkillTrack-Piano.git
cd SkillTrack-Piano
cp .env.example .env
docker compose up --build
```

Servicios disponibles una vez levantado:

| Servicio    | URL                          |
|-------------|-------------------------------|
| Frontend    | http://localhost:5173         |
| API         | http://localhost:8000         |
| Docs API    | http://localhost:8000/docs    |
| Adminer     | http://localhost:8080         |

Aplicar migraciones (primera vez y tras cualquier cambio de modelos):

```bash
docker compose exec backend alembic upgrade head
```

`db/init.sql` se monta como script de inicialización de Postgres, pero como corre antes que las migraciones (ver comentario al inicio del archivo), la semilla de datos demo no se aplica automáticamente la primera vez. Después de aplicar las migraciones, sembrarla con:

```bash
docker compose exec -T db psql -U skilltrack -d skilltrack_piano -f /docker-entrypoint-initdb.d/init.sql
```

## Credenciales demo (del seed)

| Rol       | Email                 | Contraseña |
|-----------|------------------------|------------|
| Docente   | demo@docente.com       | demo1234   |
| Estudiante| demo@estudiante.com    | demo1234   |

## Estructura del proyecto

```
SkillTrack-Piano/
├── backend/          API FastAPI (auth, catálogo, sesiones, pedagogía) + migraciones Alembic
├── frontend/         PWA React + Vite, pipeline de IA on-device
└── db/               Seed SQL y diagrama entidad-relación
```

## Stack tecnológico

| Área       | Tecnología                          | Propósito                                   |
|------------|--------------------------------------|----------------------------------------------|
| Backend    | FastAPI + SQLAlchemy async           | API REST del monolito modular                |
| Backend    | PostgreSQL 16 + Alembic              | Persistencia y migraciones                   |
| Backend    | python-jose + passlib[bcrypt]        | Autenticación JWT y hashing de contraseñas   |
| Frontend   | React + Vite + TypeScript            | PWA cliente                                  |
| Frontend   | @mediapipe/tasks-vision              | Detección de landmarks de mano on-device     |
| Frontend   | Zustand                              | Estado global (auth, ejercicio activo)       |
| Frontend   | vite-plugin-pwa                      | Manifest, service worker, instalabilidad     |
| Infra      | Docker Compose                       | Orquestación local de los 4 servicios        |

## Pipeline de IA (on-device)

El pipeline vive en `frontend/src/pipeline/` y procesa todo en el dispositivo del estudiante:

- **`capture.ts`** (implementado) — captura de cámara/micrófono y grabación con `MediaRecorder`.
- **`vision.ts`** (implementado) — inicializa `HandLandmarker` y dibuja el overlay de landmarks en vivo sobre un `<canvas>`.
- **`features.ts`** (stub) — extracción de características invariantes (ángulos de dedo, espaciado) a partir de los landmarks.
- **`keyboardCalibration.ts`** (stub) — calibración de la posición del teclado en el encuadre de cámara.
- **`audio.ts`** (stub) — detección de onset y frecuencia fundamental vía Web Audio API.
- **`fusion.ts`** (stub) — fusión temporal de eventos de visión y audio.
- **`scoring.ts`** (stub) — comparación contra `expected_score`/`reference_thresholds` y generación de retroalimentación.
- **`sync.ts`** (implementado) — envío del `SessionResult` final al backend (`POST /sessions/{id}/result`).

Los módulos stub exportan su interfaz TypeScript completa y una función que retorna un valor por defecto tipado (con `console.warn`), de modo que el contrato de tipos entre pipeline, UI y backend ya es real desde esta Primera Iteración, aunque el análisis en sí todavía no calcula resultados reales.

## Variables de entorno

| Variable                       | Descripción                                                  |
|---------------------------------|----------------------------------------------------------------|
| `POSTGRES_USER`                | Usuario de la base de datos                                    |
| `POSTGRES_PASSWORD`            | Contraseña de la base de datos                                 |
| `POSTGRES_DB`                  | Nombre de la base de datos                                     |
| `DATABASE_URL`                 | Cadena de conexión async (`postgresql+asyncpg://...`) para el backend |
| `SECRET_KEY`                   | Clave para firmar los JWT (generar con `openssl rand -hex 32`) |
| `ALGORITHM`                    | Algoritmo de firma JWT (por defecto `HS256`)                   |
| `ACCESS_TOKEN_EXPIRE_MINUTES`  | Minutos de validez del token de acceso                         |
| `ENVIRONMENT`                  | `development` / `production`                                   |
| `ALLOWED_ORIGINS`               | Orígenes permitidos por CORS, separados por comas               |
| `S3_ENDPOINT_URL`              | Endpoint de object storage (régimen de validación, vacío en dev)|
| `S3_BUCKET_VALIDATION`         | Bucket para clips de validación docente                        |
| `S3_ACCESS_KEY` / `S3_SECRET_KEY` | Credenciales de object storage                             |

## Comandos útiles

```bash
# Reiniciar solo la base de datos (borra el volumen)
docker compose stop db && docker compose rm -f db && docker volume rm skilltrack-piano_pgdata && docker compose up -d db

# Ver logs del backend
docker compose logs -f backend

# Entrar al contenedor del backend
docker compose exec backend bash

# Crear una nueva migración a partir de cambios en los modelos
docker compose exec backend alembic revision --autogenerate -m "descripción del cambio"
```

## Estado de la Primera Iteración

- [x] Modelo de datos completo (11 tablas) con migración Alembic inicial
- [x] Autenticación JWT (registro, login)
- [x] CRUD de catálogo de ejercicios con partitura esperada y umbrales de referencia
- [x] Endpoint de sesiones con el contrato `SessionResult` cliente↔servidor
- [x] Endpoints de tareas asignadas y observaciones docentes
- [x] PWA instalable con manifest e íconos
- [x] Captura de cámara/audio y overlay de landmarks de mano en vivo (MediaPipe)
- [x] Flujo de grabación → envío de `SessionResult` (vacío) → persistencia en backend
- [ ] Extracción real de características de visión (`features.ts`) — stub
- [ ] Calibración de teclado (`keyboardCalibration.ts`) — stub
- [ ] Análisis de audio (`audio.ts`) — stub
- [ ] Fusión de eventos visión/audio (`fusion.ts`) — stub
- [ ] Scoring y retroalimentación pedagógica automática (`scoring.ts`) — stub
- [ ] Historial de sesiones con visualización de resultados (`HistoryPage.tsx`) — stub
- [ ] Módulo de analítica agregada (`/analytics`) — stub

## Contribuir / Desarrollo

Para desarrollo local más rápido sin reconstruir contenedores en cada cambio:

**Backend:**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # En Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd frontend
npm install
npm run dev
```

Necesitarás una base de datos Postgres accesible (por ejemplo, levantada solo con `docker compose up -d db`) y un `.env` local apuntando a ella.

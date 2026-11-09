# n.4 Diseño — Iteración 1 (versión de avance)

## Componentes

### Servidor (`apps/api`, monolito modular FastAPI)

| Módulo         | Responsabilidad en la It-1                                                                                | Tablas propias                                   |
| -------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `identity`     | Inicio y cierre de sesión, sesión opaca en cookie, cambio y restablecimiento de clave, límite de intentos | `usuario`, `sesion_auth`                         |
| `institutions` | Instituciones, membresías, asignación docente–estudiante con vigencia; dependencias de autorización       | `institucion`, `membresia`, `asignacion_docente` |
| `audit`        | Registro de accesos y rechazos                                                                            | `auditoria_acceso`                               |
| `catalog`      | Repertorio y taxonomía de solo lectura                                                                    | `ejercicio`, `version_ejercicio`, `clase_error`  |
| `pedagogy`     | Tareas y observaciones                                                                                    | `tarea`, `observacion`                           |

- **Regla de dependencias:** ningún módulo lee tablas de otro. `pedagogy` consulta la asignación vigente a través del servicio de `institutions`, y los datos del usuario a través de `identity`. import-linter verifica que `app.core` no importe módulos.
- **Autorización:** `exigir_sesion` (router privado) + dependencias `AdminDeInstitucion` y `EstudianteAccesible`. Toda ruta fuera de `RUTAS_PUBLICAS` exige sesión; una prueba lo verifica sobre todas las rutas.
- **Anti-CSRF:** toda escritura bajo `/api` exige la cabecera `x-skilltrack-csrf: 1`.
- **Contratos:** los DTO se definen en Zod (`packages/contracts`) y los modelos Pydantic se generan con `pnpm contracts:gen`.
- **Reloj inyectable:** `app/core/reloj.py`; las fechas "de hoy" se calculan en America/La_Paz (UTC−4).

### Cliente (`apps/web`)

| Módulo        | Contenido                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------ |
| `app-shell`   | `App.tsx` (rutas por rol, protección, clave temporal), `sesion.tsx`, `api.ts` (cabecera anti-CSRF, "Sin conexión") |
| `pedagogy-ui` | `paginas/docente.tsx`, `paginas/estudiante.tsx`, `paginas/catalogo.tsx`                                            |
| `admin-ui`    | `paginas/admin.tsx`                                                                                                |
| PWA           | `pwa.ts` (manifiesto, íconos, Workbox sin capturar `/api`)                                                         |

## Pantallas

| Código | Pantalla                                                 | Ruta                     | Rol                                    |
| ------ | -------------------------------------------------------- | ------------------------ | -------------------------------------- |
| —      | Iniciar sesión                                           | `/entrar`                | Todos                                  |
| —      | Cambiar contraseña                                       | `/cambiar-clave`         | Todos (obligatoria con clave temporal) |
| P-05   | Sin conexión                                             | (dentro de cada sección) | Todos                                  |
| P-11   | Usuarios                                                 | `/usuarios`              | Administrador                          |
| P-20   | Mis estudiantes                                          | `/estudiantes`           | Docente                                |
| —      | Estudiante: tareas, asignar, cambiar, cancelar, observar | `/estudiantes/:id`       | Docente                                |
| P-30   | Mis tareas                                               | `/tareas`                | Estudiante                             |
| —      | Detalle de la tarea con observaciones                    | `/tareas/:id`            | Estudiante                             |
| —      | Catálogo                                                 | `/catalogo`              | Todos                                  |
| P-33   | Detalle del ejercicio                                    | `/catalogo/:codigo`      | Todos                                  |
| P-50   | Modo investigación                                       | `/investigacion`         | Investigador                           |

## Despliegue local

`docker compose -f infra/docker-compose.yml up --build`: `db` (PostgreSQL 17.11), `api` (migraciones + semilla de demostración + Uvicorn) y `web` (Caddy con la PWA y `/api` → `api`) en `https://localhost`.

## Estado de esta versión

| Elemento                               | Estado                                | Motivo                                                               |
| -------------------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| Módulos del servidor de la It-1        | Implementado                          | Con pruebas de autorización por ruta                                 |
| Pantallas                              | Implementado, con aspecto provisional | Tokens de diseño provisionales hasta el sistema de diseño definitivo |
| Guía de posición (P-33)                | Prototipo                             | Los apartados existen; su texto lo redacta y valida el panel         |
| `docker-compose.prod.yml` y despliegue | Pendiente                             | Sin servidor en la nube en esta versión                              |

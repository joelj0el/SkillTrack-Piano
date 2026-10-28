# n.6 Pruebas — Iteración 1 (versión de avance)

## Pruebas de aceptación (PA)

La tabla con el resultado de cada PA se genera desde los reportes JUnit reales en [`n6-pruebas.generado.md`](n6-pruebas.generado.md). Para regenerarla con el sistema levantado (`docker compose`):

```bash
pnpm vitest run packages apps src/ research infra tools/ci tools/docs tools/normalizar \
  --reporter=default --reporter=junit --outputFile.junit=reports/vitest.xml
uv run --project apps/api pytest apps/api --junitxml=reports/pytest-api.xml
uv run --project research/python pytest research/python --junitxml=reports/pytest-research.xml
pnpm e2e
pnpm docs:tests it-1 --historias HU-17,HU-01,HU-31,HU-02,HU-14,HU-29
```

- `auto-api`: pytest + httpx contra PostgreSQL 17 real (testcontainers).
- `auto-e2e`: Playwright (Chromium con perfil de teléfono) contra el sistema completo en `https://localhost`.
- Cada prueba de autorización usa el escenario de dos instituciones (`apps/api/tests/escenario.py`): docentes y administradores ajenos reciben 403, y estudiantes ajenos 404 cuando corresponde.

## Pruebas unitarias (PU) con casos de frontera

| Módulo       | Fronteras verificadas                                                                                                                               |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| identity     | Bloqueo exactamente a los 15 min del quinto fallo; sesión válida el día 29 y vencida tras 30 días sin actividad; clave nueva de 7 y de 8 caracteres |
| institutions | Asignación vigente hasta el día anterior a `hasta` y sin acceso el mismo día de cierre                                                              |
| pedagogy     | Tempo 59/60 y 75/76, repeticiones 0/1 y 20/21, plazo de ayer y de hoy; restricciones CHECK en la base                                               |
| contracts    | Correo opcional y con formato; observación de 1000 y 1001 caracteres                                                                                |
| web          | Estado vacío, tarea vencida, clave temporal, mensaje genérico y "Sin conexión"                                                                      |

## Validación del OE

La validación del OE1 con tareas reales del panel (recuperabilidad, PA-HU29-05) queda pendiente: requiere el piloto con el panel.

## Estado de esta versión

- **Implementado:** pruebas automáticas de todos los criterios `auto-api` y `auto-e2e`, salvo PA-HU02-02 y PA-HU02-04 (ver n.2).
- **Pendiente:** pruebas manuales PA-HU17-04, PA-HU17-05, PA-HU02-03 y PA-HU29-05.

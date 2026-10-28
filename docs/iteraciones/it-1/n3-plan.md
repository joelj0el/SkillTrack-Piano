# n.3 Plan — Iteración 1 (versión de avance)

Tareas de la iteración y su estado en esta versión. Cada tarea implementada tiene su commit en la rama `entrega/it-1` con el formato `[HU-xx][TI-HUxx-kk]`.

| Tarea      | Descripción                                                            | Prueba                    | Estado                                                 |
| ---------- | ---------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------ |
| TI-HU17-01 | Manifiesto, íconos y _service worker_; caché de la app                 | PA E2E                    | Implementado                                           |
| TI-HU17-02 | Navegación base por rol con tokens                                     | PA E2E                    | Implementado (tokens provisionales)                    |
| TI-HU17-03 | Caddy con HTTPS y cabeceras (CSP, HSTS, Permissions-Policy)            | Prueba de cabeceras       | Implementado en local; sin `docker-compose.prod.yml`   |
| TI-HU17-04 | Flujo de despliegue con botón                                          | Despliegue de prueba      | Pendiente: no hay servidor en la nube en esta versión  |
| TI-HU17-05 | Instalación en Android e iOS                                           | PM                        | Pendiente: prueba manual del autor                     |
| TI-HU01-01 | Modelos `usuario`, `membresia`, `sesion_auth` + migración + contratos  | PU; migración sube y baja | Implementado                                           |
| TI-HU01-02 | argon2id, sesiones (crear, revocar, expirar), límite de intentos       | PU                        | Implementado                                           |
| TI-HU01-03 | `login`, `logout`, `me`, `cambiar-clave`; cookie `HttpOnly`; anti-CSRF | PA API                    | Implementado                                           |
| TI-HU01-04 | Inicio de sesión, cambio de clave inicial y protección de rutas        | PA E2E                    | Implementado                                           |
| TI-HU31-01 | `institucion`, `asignacion_docente`, `auditoria_acceso` + migración    | PU                        | Implementado                                           |
| TI-HU31-02 | Dependencias de autorización + plantilla "docente ajeno → 403"         | PU + 403                  | Implementado                                           |
| TI-HU31-03 | Endpoints de usuarios, asignaciones y "Mis estudiantes"                | PA API + 403              | Implementado                                           |
| TI-HU31-04 | Restablecer contraseña con auditoría                                   | PA API                    | Implementado                                           |
| TI-HU31-05 | Pantallas de administración                                            | PA E2E                    | Implementado                                           |
| TI-HU02-01 | `ejercicio`, `version_ejercicio` + contrato con `eventos_esperados`    | PU                        | Implementado                                           |
| TI-HU02-02 | Script MusicXML → `eventos_esperados` + SVG                            | PU del script             | Pendiente: requiere la partitura transcrita a MusicXML |
| TI-HU02-03 | Endpoints de lectura del catálogo                                      | PA API                    | Implementado                                           |
| TI-HU02-04 | Pantallas de catálogo y detalle                                        | PA E2E                    | Prototipo: sin partitura                               |
| TI-HU14-01 | `tarea`, `observacion` + migración + contratos                         | PU                        | Implementado                                           |
| TI-HU14-02 | Endpoints del docente + auditoría                                      | PA API + 403              | Implementado                                           |
| TI-HU14-03 | Pantallas del docente                                                  | PA E2E                    | Implementado                                           |
| TI-HU29-01 | Endpoints del estudiante (solo lo propio)                              | PA API + 403              | Implementado                                           |
| TI-HU29-02 | Pantallas del estudiante                                               | PA E2E                    | Implementado                                           |
| TI-HU29-03 | Recuperabilidad con el panel                                           | PM                        | Pendiente: validación con el panel                     |

## Notas de ejecución

- Las pantallas de TI-HU01-04, TI-HU31-05, TI-HU02-04, TI-HU14-03 y TI-HU29-02 comparten el mismo _shell_ de navegación y entraron en un mismo commit, rotulado con TI-HU17-02.
- La migración de TI-HU01-01 crea también `institucion`, `membresia` y `auditoria_acceso`, porque el límite de intentos (PRM-18) y los roles del usuario las necesitan desde el primer inicio de sesión.

## Estado de esta versión

- **Implementado:** las tareas marcadas así, con sus pruebas en verde.
- **Prototipo:** TI-HU02-04 y la parte visual de TI-HU17-02.
- **Pendiente:** TI-HU17-04, TI-HU17-05, TI-HU02-02 y TI-HU29-03, por los motivos de la tabla.

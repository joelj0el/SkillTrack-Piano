# n.8 Cierre — Iteración 1 (versión de avance)

## Checklist de cumplimiento (historia · entregable · prueba · estado)

| Historia | Entregable                                                       | Prueba                   | Estado                                                            |
| -------- | ---------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------- |
| HU-17    | PWA instalable, sin conexión, cabeceras                          | PA-HU17-01, 02, 03 (E2E) | Implementado; instalación en dispositivos y despliegue pendientes |
| HU-01    | Inicio de sesión por rol, clave temporal, bloqueo, cookie segura | PA-HU01-01 a 05          | Implementado                                                      |
| HU-31    | Usuarios sin correo, asignaciones, restablecimiento              | PA-HU31-01 a 05          | Implementado                                                      |
| HU-02    | Catálogo EJ-01 a EJ-04 y detalle                                 | PA-HU02-01               | Prototipo: partitura y digitación pendientes de transcripción     |
| HU-14    | Tareas y observaciones del docente                               | PA-HU14-01 a 05          | Implementado                                                      |
| HU-29    | Mis tareas y observaciones del estudiante                        | PA-HU29-01 a 04          | Implementado; recuperabilidad con el panel pendiente              |

El resultado de cada prueba está en `n6-pruebas.generado.md` (generado desde los reportes JUnit).

## Revisión de riesgos

| Riesgo                             | Situación en esta versión                                                                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Datos de menores                   | Cuentas sin correo, clave temporal mostrada una sola vez, auditoría de accesos y rechazos                                                    |
| Acceso indebido docente–estudiante | Autorización por pertenencia en cada ruta, con prueba "ajeno → 403/404"                                                                      |
| Partitura sin transcribir          | Bloquea PA-HU02-02, PA-HU02-03 y la partitura de PA-HU02-04; no bloquea las tareas                                                           |
| Certificado local                  | La CA interna de Caddy no es de confianza por defecto; para instalar la PWA en el Android hay que confiar en ella (ver el README de la rama) |

## Trazabilidad (SP → OE → historia → componente → prueba)

| SP  | OE           | Historia | Componentes                                     | Pruebas                           |
| --- | ------------ | -------- | ----------------------------------------------- | --------------------------------- |
| SP1 | OE1          | HU-14    | `pedagogy`, `pedagogy-ui`                       | PA-HU14-01 a 05, PU-pedagogy      |
| SP1 | OE1          | HU-29    | `pedagogy`, `pedagogy-ui`                       | PA-HU29-01 a 04, PU-web           |
| SP1 | OE1          | HU-31    | `identity`, `institutions`, `audit`, `admin-ui` | PA-HU31-01 a 05, PU-institutions  |
| —   | Habilitadora | HU-01    | `identity`, `app-shell`                         | PA-HU01-01 a 05, PU-identity      |
| —   | Habilitadora | HU-02    | `catalog`, `pedagogy-ui`                        | PA-HU02-01, PU-catalog, PU-web-10 |
| —   | Habilitadora | HU-17    | `app-shell`, `infra`                            | PA-HU17-01 a 03, PU-infra         |

## Estado de esta versión

- **Implementado:** HU-01, HU-14, HU-29 y HU-31 completas en lo automatizable; HU-17 sin el despliegue.
- **Prototipo:** HU-02 (sin partitura) y el sistema de diseño.
- **Pendiente:** despliegue en la nube, transcripción de la partitura, pruebas manuales en dispositivos y validación con el panel.

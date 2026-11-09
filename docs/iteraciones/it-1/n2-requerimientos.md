# n.2 Requerimientos — Iteración 1 (versión de avance)

Historias y criterios de aceptación de la It-1. Tipo: `auto-api` (pytest), `auto-e2e` (Playwright) o `manual`. Los parámetros PRM-xx tienen el valor vigente indicado entre paréntesis.

## HU-17 · Abrir e instalar la PWA con HTTPS y navegación base

**Como** usuario de cualquier rol **quiero** instalar la app en mi teléfono y abrirla de forma segura **para** usarla como una aplicación más, aun con mala conexión.

| PA         | Tipo     | Criterio                                                                                                                                                                                 | Estado en esta versión                                                |
| ---------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| PA-HU17-01 | auto-e2e | El manifiesto incluye `name`, íconos de 192 y 512 px, `display: standalone` y `start_url`, y el _service worker_ queda `activated` en ≤ 10 s                                             | Implementado                                                          |
| PA-HU17-02 | auto-e2e | Sin red, al recargar se muestra la app y las secciones que requieren el servidor muestran "Sin conexión" (P-05)                                                                          | Implementado                                                          |
| PA-HU17-03 | auto-api | Toda respuesta lleva HSTS, CSP con `connect-src 'self'`, `Permissions-Policy: camera=(self), microphone=(self)` y `Referrer-Policy: no-referrer`; HTTP se redirige a HTTPS con 301 o 308 | Implementado (se verifica con Playwright contra el sistema levantado) |
| PA-HU17-04 | manual   | Instalación en Android con Chrome y en iPhone con Safari                                                                                                                                 | Pendiente: prueba manual en dispositivo real                          |
| PA-HU17-05 | manual   | Despliegue con botón en ≤ 10 min                                                                                                                                                         | Pendiente: no hay despliegue en la nube en esta versión               |

## HU-01 · Autenticarme e ingresar según mi rol

| PA         | Tipo     | Criterio                                                                                                                                                          | Estado       |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| PA-HU01-01 | auto-e2e | Cada rol llega a su pantalla inicial: estudiante → "Mis tareas", docente → "Mis estudiantes", administrador → "Usuarios", investigador → "Modo investigación"     | Implementado |
| PA-HU01-02 | auto-e2e | Con clave temporal no se accede a otra pantalla hasta definir una contraseña nueva de ≥ PRM-25 (8) caracteres, distinta de la temporal                            | Implementado |
| PA-HU01-03 | auto-e2e | Usuario o contraseña incorrectos muestran el mismo mensaje genérico                                                                                               | Implementado |
| PA-HU01-04 | auto-api | PRM-18 (5) fallos en 15 min → 429 durante 15 min y registro en `auditoria_acceso`                                                                                 | Implementado |
| PA-HU01-05 | auto-api | Cookie `HttpOnly`, `Secure`, `SameSite=Lax`; sin token en el cuerpo; escritura sin cabecera anti-CSRF → 403; tras `logout` o PRM-19 (30) días sin actividad → 401 | Implementado |

## HU-31 · Administrar instituciones, docentes y estudiantes

| PA         | Tipo     | Criterio                                                                                                                                        | Estado       |
| ---------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| PA-HU31-01 | auto-e2e | El administrador crea un estudiante menor sin correo; la clave temporal se muestra una sola vez y sirve para entrar (con el cambio obligatorio) | Implementado |
| PA-HU31-02 | auto-api | Usuario duplicado → 409; correo opcional, con formato válido (422 si no)                                                                        | Implementado |
| PA-HU31-03 | auto-api | Al cerrar la asignación, el docente deja de ver al estudiante y recibe 403                                                                      | Implementado |
| PA-HU31-04 | auto-api | Usuarios de otra institución → 403 en la administración de la institución A                                                                     | Implementado |
| PA-HU31-05 | auto-api | Restablecer la contraseña: clave temporal, sesiones revocadas y registro en auditoría; docente no asignado → 403                                | Implementado |

## HU-02 · Ver el catálogo y abrir un ejercicio

| PA         | Tipo     | Criterio                                                                                                                                      | Estado                                                                                                                           |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU02-01 | auto-api | EJ-01 a EJ-04 en el orden del panel, con versión, tonalidad, 2/4, semicorchea, rango de tempo (PRM-02) y variantes de manos; sin sesión → 401 | Implementado                                                                                                                     |
| PA-HU02-02 | auto-api | `eventos_esperados` con un evento por nota de la sección analizada, igual al MusicXML fuente                                                  | Pendiente: requiere la transcripción a MusicXML de la partitura del panel                                                        |
| PA-HU02-03 | manual   | Revisión nota por nota por un docente del panel (acta)                                                                                        | Pendiente: requiere la transcripción                                                                                             |
| PA-HU02-04 | auto-e2e | El detalle (P-33) muestra partitura (SVG), digitación, rango de tempo y guía de posición; se alcanza en ≤ 2 toques desde "Mis tareas"         | Prototipo: navegación, tempo y apartados de la guía verificados (PU-web-10); partitura, digitación y texto de la guía pendientes |

## HU-14 · Asignar tareas y registrar observaciones

| PA         | Tipo     | Criterio                                                                                                                                         | Estado       |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ |
| PA-HU14-01 | auto-e2e | La tarea (EJ-01, juntas, 60–70, plazo a 7 días, 3 repeticiones) aparece en "Mis tareas" con sus 5 datos y estado "Asignada"                      | Implementado |
| PA-HU14-02 | auto-api | `tempo_min > tempo_max`, tempo fuera de PRM-02, plazo anterior a hoy o repeticiones fuera de PRM-20 (1–20) → 422 indicando el campo              | Implementado |
| PA-HU14-03 | auto-api | Docente sin asignación vigente → 403 y registro en `auditoria_acceso`                                                                            | Implementado |
| PA-HU14-04 | auto-e2e | Observación con aspecto opcional; el estudiante la ve con fecha, aspecto y texto; guía "Mejora…, tratando de…, para que…"; hasta 1000 caracteres | Implementado |
| PA-HU14-05 | auto-e2e | Los cambios de plazo, tempo o repeticiones y la cancelación llegan al estudiante; la cancelada sale de las pendientes con estado "Cancelada"     | Implementado |

## HU-29 · Ver mis tareas y las observaciones de mi docente

| PA         | Tipo     | Criterio                                                                                                                       | Estado                                                                                                                                                                                                         |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU29-01 | auto-e2e | Tres tareas ordenadas por plazo, con ejercicio, manos, tempo, plazo, repeticiones y estado; las vencidas con icono y "Vencida" | Implementado, con una salvedad: el caso "Vencida" se verifica en la prueba unitaria PU-web-06, porque la API no permite crear tareas con plazo pasado y la prueba E2E no puede adelantar el reloj del servidor |
| PA-HU29-02 | auto-e2e | Observaciones de la más reciente a la más antigua, a ≤ PRM-21 (3) toques                                                       | Implementado (1 toque)                                                                                                                                                                                         |
| PA-HU29-03 | auto-api | Tarea u observación de otro estudiante → 404                                                                                   | Implementado                                                                                                                                                                                                   |
| PA-HU29-04 | auto-e2e | Sin tareas: estado vacío con explicación y acceso al catálogo                                                                  | Implementado                                                                                                                                                                                                   |
| PA-HU29-05 | manual   | Recuperabilidad con el panel (piloto de la semana 3)                                                                           | Pendiente: validación con el panel                                                                                                                                                                             |

## Estado de esta versión

- **Implementado:** cada criterio marcado como "Implementado" tiene su prueba automática con el ID exacto; su resultado sale de los reportes JUnit en `n6-pruebas.generado.md`.
- **Prototipo:** PA-HU02-04 (falta la partitura) y el sistema de diseño provisional.
- **Pendiente:** PA-HU02-02 y PA-HU02-03 (transcripción), PA-HU17-04, PA-HU17-05 y PA-HU29-05 (manuales, en dispositivo real, en la nube o con el panel).

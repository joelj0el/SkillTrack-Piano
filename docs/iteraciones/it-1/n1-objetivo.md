# n.1 Objetivo específico y alcance — Iteración 1 (versión de avance)

## Objetivo específico

**OE1.** Registrar y hacer recuperables las indicaciones del docente: tareas con sus condiciones (ejercicio, manos, rango de tempo, plazo y repeticiones por día) y observaciones, para que no se pierdan entre una clase y la siguiente.

## Ítem de la situación problemática

**SP1.** La corrección y la asignación del docente son orales y no quedan registradas; el estudiante las olvida al practicar solo.

## Historias incluidas (del OE y habilitadoras)

| Historia | Tipo         | Resumen                                                                             |
| -------- | ------------ | ----------------------------------------------------------------------------------- |
| HU-17    | Habilitadora | PWA instalable con HTTPS, navegación base y cabeceras de seguridad                  |
| HU-01    | Habilitadora | Autenticación por usuario y contraseña; pantalla inicial según el rol               |
| HU-31    | OE1          | Administración de instituciones, cuentas sin correo y asignación docente–estudiante |
| HU-02    | Habilitadora | Catálogo de ejercicios (repertorio v0: EJ-01 a EJ-04) y detalle                     |
| HU-14    | OE1          | Asignar tareas y registrar observaciones                                            |
| HU-29    | OE1          | El estudiante ve sus tareas y las observaciones de su docente                       |

## Fuera de alcance

- Despliegue en la nube y flujo de despliegue con botón (PA-HU17-05, TI-HU17-04): esta versión se ejecuta en local con `docker compose`.
- Transcripción de la partitura y de la digitación (TI-HU02-02, PA-HU02-02 y PA-HU02-03).
- Observaciones ligadas a un intento: requieren los intentos de la It-2.
- Chat, adjuntos y video.

## Estado de esta versión

| Elemento                   | Estado                            | Motivo                                                                                       |
| -------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------- |
| HU-01, HU-31, HU-14, HU-29 | Implementado                      | API, pantallas y pruebas de aceptación automáticas (ver n.6)                                 |
| HU-17                      | Implementado, salvo el despliegue | PWA instalable, sin conexión y cabeceras verificadas; el despliegue en la nube es posterior  |
| HU-02                      | Prototipo                         | Catálogo y detalle funcionan; la partitura y la digitación están pendientes de transcripción |
| Sistema de diseño          | Prototipo                         | Tokens provisionales en `apps/web/src/design/`; el sistema definitivo los reemplaza          |

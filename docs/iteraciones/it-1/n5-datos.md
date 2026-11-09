# n.5 Datos — Iteración 1 (versión de avance)

Todas las tablas viven en el esquema `app` de PostgreSQL. Migraciones: `apps/api/migrations/versions/0001` a `0004`. La prueba PU-api-08 verifica que los modelos coinciden con las migraciones y PU-api-02 que suben y bajan.

## Tablas nuevas

| Tabla                | Migración | Columnas clave                                                                                                                      | Notas                                                                                               |
| -------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `usuario`            | 0001      | `username` UNIQUE, `nombre_visible`, `email` NULL, `hash_clave` (argon2id), `es_menor`, `activo`, `superadmin`, `clave_temporal`    | Sin correo obligatorio. `clave_temporal` obliga a cambiar la clave en el primer ingreso             |
| `sesion_auth`        | 0001      | `id` = SHA-256 del token, `usuario_id`, `expira_en`, `ultima_actividad`                                                             | El token en claro solo vive en la cookie                                                            |
| `institucion`        | 0001      | `nombre`, `activo`                                                                                                                  | Se crea en 0001 porque `membresia` la necesita                                                      |
| `membresia`          | 0001      | PK (`usuario_id`, `institucion_id`, `rol`)                                                                                          | `rol` ∈ {admin_inst, docente, estudiante, investigador}                                             |
| `auditoria_acceso`   | 0001      | `actor_id`, `accion`, `recurso`, `recurso_id`, `fecha`                                                                              | Fallos y bloqueos de inicio de sesión, accesos y rechazos a datos de estudiantes, restablecimientos |
| `asignacion_docente` | 0002      | `institucion_id`, `docente_id`, `estudiante_id`, `desde`, `hasta` NULL                                                              | N:M con vigencia; vigente si `hasta` es nulo o posterior a hoy                                      |
| `ejercicio`          | 0003      | `codigo`, `nombre`, `fuente`, `variantes_manos`, `tonalidad`, `compas`, `figura`, `orden`, `activo`                                 | Datos de referencia: EJ-01 a EJ-04                                                                  |
| `version_ejercicio`  | 0003      | `tempo_min/max_permitido_bpm` (60–75), `rango_octavas` (2), `nota_min/max_midi`, `eventos_esperados` JSONB, `partitura_svg`         | `eventos_esperados = []` y `partitura_svg` nula hasta la transcripción                              |
| `clase_error`        | 0003      | `codigo` (ER-A…ER-F), `nombre_pedagogico`, `variable_estudiante`, `modalidad`, `version_taxonomia` (v0.1)                           | Aspectos que el docente puede elegir en la observación                                              |
| `tarea`              | 0004      | `docente_id`, `estudiante_id`, `ejercicio_id`, `manos`, `tempo_min/max_bpm`, `repeticiones_por_dia`, `fecha_limite`, `cancelada_en` | CHECK de PRM-02 y PRM-20. **Sin columna de estado**: se calcula (Asignada, Vencida, Cancelada)      |
| `observacion`        | 0004      | `docente_id`, `estudiante_id`, `tarea_id`, `clase_error_id` NULL, `texto` (1–1000)                                                  | En esta versión se ancla siempre a una tarea; el vínculo con el intento llega con la It-2           |

## Datos de demostración

Solo en local (`SEMILLA_DEMO=1`): una institución con un usuario de cada rol (`admin.demo`, `docente.demo`, `estudiante.demo`, `investigador.demo`) y el estudiante asignado al docente. La contraseña común se define con `SEMILLA_CLAVE`.

## Estado de esta versión

| Elemento                                                  | Estado       | Motivo                                                                         |
| --------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------ |
| Tablas de identidad, instituciones, auditoría y pedagogía | Implementado | Con migraciones reversibles y pruebas                                          |
| `eventos_esperados`, `partitura_svg`, `nota_min/max_midi` | Pendiente    | Requieren la transcripción de la partitura del panel                           |
| Vistas `v_estado_tarea` y `v_avance_tarea`                | Pendiente    | El estado se calcula en el servicio; las vistas llegan con los intentos (It-2) |

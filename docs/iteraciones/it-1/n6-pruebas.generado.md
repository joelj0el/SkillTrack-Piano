# n.6 Pruebas — it-1 (generado)

Generado por `pnpm docs:tests it-1` el 2026-10-28 17:14 UTC a partir de los reportes JUnit de `reports/`. No se edita a mano.

## Totales por herramienta

| Herramienta | Casos | Aprobados | Fallidos | Omitidos |
| ----------- | ----- | --------- | -------- | -------- |
| Playwright  | 14    | 14        | 0        | 0        |
| Vitest      | 33    | 33        | 0        | 0        |
| pytest      | 58    | 58        | 0        | 0        |

## Pruebas de aceptación (PA)

| PA         | Herramienta         | Casos | Resultado | Prueba                                                                                                  |
| ---------- | ------------------- | ----- | --------- | ------------------------------------------------------------------------------------------------------- |
| PA-HU01-01 | Playwright          | 1     | aprobada  | PA-HU01-01: cada rol llega a su pantalla inicial                                                        |
| PA-HU01-02 | Playwright          | 1     | aprobada  | PA-HU01-02: con clave temporal no se accede a nada hasta definir una contraseña nueva                   |
| PA-HU01-03 | Playwright          | 1     | aprobada  | PA-HU01-03: usuario o contraseña incorrectos dan el mismo mensaje genérico                              |
| PA-HU01-04 | pytest              | 1     | aprobada  | test_pa_hu01_04_cinco_fallos_bloquean_con_429_y_quedan_auditados                                        |
| PA-HU01-05 | pytest              | 2     | aprobada  | test_pa_hu01_05_cookie_segura_sin_token_en_el_cuerpo_y_csrf                                             |
| PA-HU02-01 | pytest              | 1     | aprobada  | test_pa_hu02_01_catalogo_con_el_repertorio_v0_en_orden_y_401_sin_sesion                                 |
| PA-HU14-01 | Playwright          | 1     | aprobada  | PA-HU14-01: la tarea asignada aparece en Mis tareas del estudiante con sus 5 datos                      |
| PA-HU14-02 | pytest              | 6     | aprobada  | test_pa_hu14_02_condiciones_invalidas_dan_422_indicando_el_campo[cambio0-tempo_min_bpm]                 |
| PA-HU14-03 | pytest              | 1     | aprobada  | test_pa_hu14_03_docente_sin_asignacion_recibe_403_y_queda_auditado                                      |
| PA-HU14-04 | Playwright          | 1     | aprobada  | PA-HU14-04: la observación con aspecto llega al estudiante con fecha, aspecto y texto                   |
| PA-HU14-05 | Playwright          | 1     | aprobada  | PA-HU14-05: los cambios y la cancelación de la tarea llegan al estudiante                               |
| PA-HU17-01 | Playwright          | 1     | aprobada  | PA-HU17-01: manifiesto instalable y service worker activo en 10 s o menos                               |
| PA-HU17-02 | Playwright          | 1     | aprobada  | PA-HU17-02: sin red se muestra la app y las secciones del servidor dicen Sin conexión                   |
| PA-HU17-03 | Playwright          | 1     | aprobada  | PA-HU17-03: cabeceras de seguridad en toda ruta y redirección de HTTP a HTTPS                           |
| PA-HU29-01 | Playwright          | 1     | aprobada  | PA-HU29-01: tres tareas ordenadas por plazo, cada una con sus datos y estado                            |
| PA-HU29-02 | Playwright          | 1     | aprobada  | PA-HU29-02: observaciones de la más reciente a la más antigua, a un toque de Mis tareas                 |
| PA-HU29-03 | pytest              | 1     | aprobada  | test_pa_hu29_03_tarea_u_observacion_de_otro_estudiante_da_404                                           |
| PA-HU29-04 | Playwright          | 1     | aprobada  | PA-HU29-04: sin tareas, Mis tareas explica el estado vacío y ofrece el catálogo                         |
| PA-HU31-01 | Playwright + pytest | 2     | aprobada  | PA-HU31-01: el administrador crea un estudiante menor sin correo y la clave temporal se muestra una vez |
| PA-HU31-02 | pytest              | 1     | aprobada  | test_pa_hu31_02_usuario_duplicado_409_y_correo_invalido_422                                             |
| PA-HU31-03 | pytest              | 1     | aprobada  | test_pa_hu31_03_al_cerrar_la_asignacion_el_docente_deja_de_ver_al_estudiante                            |
| PA-HU31-04 | pytest              | 1     | aprobada  | test_pa_hu31_04_usuarios_de_otra_institucion_reciben_403                                                |
| PA-HU31-05 | pytest              | 1     | aprobada  | test_pa_hu31_05_restablecer_clave_revoca_sesiones_y_queda_auditado                                      |

## Pruebas unitarias y de propiedades por módulo

| Módulo       | IDs | Aprobados | Fallidos |
| ------------ | --- | --------- | -------- |
| api          | 9   | 9         | 0        |
| catalog      | 4   | 4         | 0        |
| ci           | 4   | 4         | 0        |
| contracts    | 13  | 13        | 0        |
| core         | 1   | 1         | 0        |
| docs         | 3   | 3         | 0        |
| identity     | 12  | 12        | 0        |
| infra        | 3   | 3         | 0        |
| institutions | 4   | 4         | 0        |
| pedagogy     | 8   | 8         | 0        |
| research     | 3   | 3         | 0        |
| web          | 8   | 8         | 0        |

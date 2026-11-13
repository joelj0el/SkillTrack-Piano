# n.6 Pruebas — it-5 (generado)

Generado por `pnpm docs:tests it-5` el 2026-11-13 14:36 UTC a partir de los reportes JUnit de `reports/`. No se edita a mano.

## Totales por herramienta

| Herramienta | Casos | Aprobados | Fallidos | Omitidos |
| ----------- | ----- | --------- | -------- | -------- |
| Playwright  | 59    | 58        | 0        | 1        |
| Vitest      | 363   | 363       | 0        | 0        |
| pytest      | 127   | 127       | 0        | 0        |

## Pruebas de aceptación (PA)

| PA         | Herramienta         | Casos | Resultado | Prueba                                                                                                                                                       |
| ---------- | ------------------- | ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PA-HU01-01 | Playwright          | 1     | aprobada  | PA-HU01-01: cada rol llega a su pantalla inicial                                                                                                             |
| PA-HU01-02 | Playwright          | 1     | aprobada  | PA-HU01-02: con clave temporal no se accede a nada hasta definir una contraseña nueva                                                                        |
| PA-HU01-03 | Playwright          | 1     | aprobada  | PA-HU01-03: usuario o contraseña incorrectos dan el mismo mensaje genérico                                                                                   |
| PA-HU01-04 | pytest              | 1     | aprobada  | test_pa_hu01_04_cinco_fallos_bloquean_con_429_y_quedan_auditados                                                                                             |
| PA-HU01-05 | pytest              | 2     | aprobada  | test_pa_hu01_05_cookie_segura_sin_token_en_el_cuerpo_y_csrf                                                                                                  |
| PA-HU02-01 | pytest              | 1     | aprobada  | test_pa_hu02_01_catalogo_con_el_repertorio_v0_en_orden_y_401_sin_sesion                                                                                      |
| PA-HU02-02 | pytest              | 1     | aprobada  | test_pa_hu02_02_la_version_vigente_tiene_un_evento_por_nota_del_musicxml                                                                                     |
| PA-HU02-04 | Playwright          | 1     | aprobada  | PA-HU02-04: el detalle muestra partitura, digitación, tempo y guía, a 2 toques de Mis tareas                                                                 |
| PA-HU03-03 | Playwright          | 1     | aprobada  | PA-HU03-03: sin permiso de cámara se explica cómo habilitarlo y se ofrece Reintentar                                                                         |
| PA-HU03-05 | Playwright          | 1     | aprobada  | PA-HU03-05: durante 30 s de encuadre no sale ninguna imagen ni video por la red                                                                              |
| PA-HU05-05 | pytest              | 1     | aprobada  | test_pa_hu05_05_el_intento_registra_versiones_de_nucleo_y_modelo_de_mano                                                                                     |
| PA-HU06-01 | Vitest              | 1     | aprobada  | golden del diagnóstico (plantilla de reglas v1) > PA-HU06-01: cada fixture golden es sintética y el diagnóstico da exactamente sus clases e indicadores      |
| PA-HU06-02 | Playwright          | 1     | aprobada  | PA-HU06-02: diagnosticar no descarga ni carga ningún modelo de aprendizaje automático                                                                        |
| PA-HU07-01 | Playwright          | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU07-01: el resultado aparece en ≤ 5 s después de terminar (PRM-03)                                       |
| PA-HU07-02 | Playwright          | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU07-02: bloques en el orden del panel, una corrección principal y sin estrellas                          |
| PA-HU07-03 | Playwright          | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU07-03: la pantalla de resultados no tiene errores graves de accesibilidad                               |
| PA-HU08-01 | pytest              | 1     | aprobada  | test_pa_hu08_01_mismo_client_uuid_una_sola_fila_201_y_luego_200                                                                                              |
| PA-HU08-02 | pytest              | 5     | aprobada  | test_pa_hu08_02_binarios_reciben_415_y_no_se_guarda_nada[multipart/form-data; boundary=x]                                                                    |
| PA-HU08-04 | Playwright          | 1     | aprobada  | PA-HU08-04: un intento completo con cámara y micrófono no envía medios, ni cuerpos grandes, ni a otro origen                                                 |
| PA-HU08-05 | pytest              | 1     | aprobada  | test_pa_hu08_05_intento_de_tarea_con_sus_campos_y_403_para_docente_ajeno                                                                                     |
| PA-HU10-05 | Playwright + pytest | 2     | aprobada  | PA-HU10-05: tocar fuera del rango de la tarea se informa en el resultado y no cuenta                                                                         |
| PA-HU11-02 | Playwright          | 1     | aprobada  | PA-HU11-02: cada evento esperado tiene un registro fusionado con la modalidad de cada dato                                                                   |
| PA-HU11-05 | Playwright          | 1     | aprobada  | PA-HU11-05: un intento completo con audio no envía medios ni a otro origen, y sus eventos ocupan ≤ 256 KB                                                    |
| PA-HU14-01 | Playwright          | 1     | aprobada  | PA-HU14-01: la tarea asignada aparece en Mis tareas del estudiante con sus 5 datos                                                                           |
| PA-HU14-02 | pytest              | 6     | aprobada  | test_pa_hu14_02_condiciones_invalidas_dan_422_indicando_el_campo[cambio0-tempo_min_bpm]                                                                      |
| PA-HU14-03 | pytest              | 1     | aprobada  | test_pa_hu14_03_docente_sin_asignacion_recibe_403_y_queda_auditado                                                                                           |
| PA-HU14-04 | Playwright          | 1     | aprobada  | PA-HU14-04: la observación con aspecto llega al estudiante con fecha, aspecto y texto                                                                        |
| PA-HU14-05 | Playwright          | 1     | aprobada  | PA-HU14-05: los cambios y la cancelación de la tarea llegan al estudiante                                                                                    |
| PA-HU15-01 | Playwright + pytest | 2     | aprobada  | tableros descriptivos (HU-15) › PA-HU15-01: Mi progreso muestra la calificación por variable por semana del estudiante                                       |
| PA-HU15-02 | Playwright + pytest | 2     | aprobada  | tableros descriptivos (HU-15) › PA-HU15-02: Mi grupo muestra los errores recurrentes por clase y estudiante en los últimos N intentos, sin rankings          |
| PA-HU17-01 | Playwright          | 1     | aprobada  | PA-HU17-01: manifiesto instalable y service worker activo en 10 s o menos                                                                                    |
| PA-HU17-02 | Playwright          | 1     | aprobada  | PA-HU17-02: sin red se muestra la app y las secciones del servidor dicen Sin conexión                                                                        |
| PA-HU17-03 | Playwright          | 1     | aprobada  | PA-HU17-03: cabeceras de seguridad en toda ruta y redirección de HTTP a HTTPS                                                                                |
| PA-HU18-02 | Playwright          | 1     | omitida   | PA-HU18-02: el clip del autor se procesa completo y se detectan manos                                                                                        |
| PA-HU18-04 | Vitest              | 1     | aprobada  | ingesta de la sesión > PA-HU18-04: si se altera un byte del paquete, se rechaza con un mensaje explícito                                                     |
| PA-HU20-03 | Playwright          | 1     | aprobada  | PA-HU20-03: sin permiso de micrófono se ofrece el modo solo visión                                                                                           |
| PA-HU22-01 | pytest              | 2     | aprobada  | test_pa_hu22_01_publicar_una_version_existente_da_409_y_la_publicada_no_se_edita                                                                             |
| PA-HU23-01 | pytest              | 2     | aprobada  | test_pa_hu23_01_publicar_reglas_exige_la_version_de_la_taxonomia_y_es_inmutable                                                                              |
| PA-HU23-02 | Playwright          | 1     | aprobada  | PA-HU23-02: la herramienta del investigador muestra qué regla disparó cada diagnóstico y con qué eventos                                                     |
| PA-HU24-01 | Playwright          | 1     | aprobada  | PA-HU24-01: el mismo intento en V, A y VA solo difiere en los indicadores de la modalidad excluida y registra el modo                                        |
| PA-HU25-01 | Playwright          | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU25-01: cada nota muestra su familia con icono y texto; al tocarla, mano, dedo y ms                      |
| PA-HU25-02 | Playwright          | 1     | aprobada  | intento no evaluable › PA-HU25-02: las notas no evaluables muestran su motivo                                                                                |
| PA-HU26-01 | Playwright          | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU26-01: la corrección principal es la más crítica, con su nombre, dónde y su mensaje                     |
| PA-HU26-02 | Playwright          | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU26-02: se muestra la última observación del docente con su aspecto                                      |
| PA-HU27-01 | Playwright          | 1     | aprobada  | intento no evaluable › PA-HU27-01: el intento incompleto es No evaluable, con su motivo y una acción sugerida                                                |
| PA-HU27-02 | Playwright          | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU27-02: ninguna variable se califica sin datos: los no evaluables por diseño dicen No evaluado y por qué |
| PA-HU28-01 | Playwright          | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU28-01: la calificación por variable de los intentos anteriores del mismo ejercicio y manos              |
| PA-HU28-02 | Playwright          | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU28-02: Reintentar vuelve al conteo con la misma calibración y el mismo tempo                            |
| PA-HU29-01 | Playwright          | 1     | aprobada  | PA-HU29-01: tres tareas ordenadas por plazo, cada una con sus datos y estado                                                                                 |
| PA-HU29-02 | Playwright          | 1     | aprobada  | PA-HU29-02: observaciones de la más reciente a la más antigua, a un toque de Mis tareas                                                                      |
| PA-HU29-03 | pytest              | 1     | aprobada  | test_pa_hu29_03_tarea_u_observacion_de_otro_estudiante_da_404                                                                                                |
| PA-HU29-04 | Playwright          | 1     | aprobada  | PA-HU29-04: sin tareas, Mis tareas explica el estado vacío y ofrece el catálogo                                                                              |
| PA-HU30-01 | pytest              | 1     | aprobada  | test_pa_hu30_01_solo_el_docente_asignado_ve_los_intentos_y_cada_lectura_se_audita                                                                            |
| PA-HU30-02 | Playwright          | 1     | aprobada  | PA-HU30-02: por tarea, el docente ve fecha, tempo, metrónomo, calificación por variable e indicadores deficientes de cada intento                            |
| PA-HU31-01 | Playwright + pytest | 2     | aprobada  | PA-HU31-01: el administrador crea un estudiante menor sin correo y la clave temporal se muestra una vez                                                      |
| PA-HU31-02 | pytest              | 1     | aprobada  | test_pa_hu31_02_usuario_duplicado_409_y_correo_invalido_422                                                                                                  |
| PA-HU31-03 | pytest              | 1     | aprobada  | test_pa_hu31_03_al_cerrar_la_asignacion_el_docente_deja_de_ver_al_estudiante                                                                                 |
| PA-HU31-04 | pytest              | 1     | aprobada  | test_pa_hu31_04_usuarios_de_otra_institucion_reciben_403                                                                                                     |
| PA-HU31-05 | pytest              | 1     | aprobada  | test_pa_hu31_05_restablecer_clave_revoca_sesiones_y_queda_auditado                                                                                           |
| PA-HU35-01 | Playwright          | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU35-01: con la bandera del clasificador apagada (por defecto), el resultado es idéntico al de las reglas |
| PA-HU37-01 | Playwright          | 1     | aprobada  | PA-HU37-01: con 2 intentos válidos hoy la tarea muestra 2 de 3 y la lista con fecha y hora                                                                   |
| PA-HU37-02 | pytest              | 1     | aprobada  | test_pa_hu37_02_solo_cuentan_los_validos_y_cada_intento_dice_por_que                                                                                         |
| PA-HU37-03 | Playwright          | 1     | aprobada  | PA-HU37-03: el docente ve por día las repeticiones válidas frente a la meta y cada intento                                                                   |
| PA-HU37-04 | pytest              | 1     | aprobada  | test_pa_hu37_04_estado_asignada_en_practica_vencida_y_403_al_docente_ajeno                                                                                   |
| PA-HU38-01 | Playwright          | 1     | aprobada  | PA-HU38-01: el docente marca Por repetir con observación y plazo nuevo, luego Lograda; el estudiante ve la valoración                                        |
| PA-HU38-02 | pytest              | 1     | aprobada  | test_pa_hu38_02_solo_el_asignado_valora_con_fecha_y_docente_por_repetir_exige_observacion                                                                    |

## Pruebas unitarias y de propiedades por módulo

| Módulo        | IDs | Aprobados | Fallidos |
| ------------- | --- | --------- | -------- |
| accesibilidad | 8   | 8         | 0        |
| align         | 7   | 7         | 0        |
| alineacion    | 6   | 6         | 0        |
| analytics     | 3   | 3         | 0        |
| api           | 10  | 10        | 0        |
| attempts      | 10  | 10        | 0        |
| audio         | 25  | 25        | 0        |
| aumento       | 4   | 4         | 0        |
| bandas        | 20  | 20        | 0        |
| cadena        | 4   | 4         | 0        |
| capture       | 18  | 18        | 0        |
| catalog       | 13  | 13        | 0        |
| catalogo      | 2   | 2         | 0        |
| ci            | 8   | 8         | 0        |
| clasificador  | 12  | 12        | 0        |
| classifier    | 2   | 2         | 0        |
| contracts     | 31  | 31        | 0        |
| core          | 1   | 1         | 0        |
| dataset       | 5   | 5         | 0        |
| desfase       | 5   | 5         | 0        |
| design        | 5   | 5         | 0        |
| diagnostico   | 18  | 18        | 0        |
| diseno        | 3   | 3         | 0        |
| docs          | 6   | 6         | 0        |
| esperadas     | 3   | 3         | 0        |
| eventos       | 4   | 4         | 0        |
| exercise      | 4   | 4         | 0        |
| features      | 20  | 20        | 0        |
| fusion        | 2   | 2         | 0        |
| geometry      | 16  | 16        | 0        |
| hooks         | 2   | 2         | 0        |
| identity      | 12  | 12        | 0        |
| infra         | 12  | 12        | 0        |
| institutions  | 4   | 4         | 0        |
| outbox        | 3   | 3         | 0        |
| pedagogy      | 12  | 12        | 0        |
| quality       | 9   | 9         | 0        |
| registro      | 3   | 3         | 0        |
| research      | 79  | 79        | 0        |
| tempo         | 5   | 5         | 0        |
| ui            | 6   | 6         | 0        |
| web           | 28  | 28        | 0        |

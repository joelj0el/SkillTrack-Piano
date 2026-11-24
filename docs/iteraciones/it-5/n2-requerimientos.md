# n.2 Requerimientos — Iteración 5 (en curso)

## HU-33 · Dataset versionado

| PA         | Estado    | Motivo / prueba                                                                                                                                                                   |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU33-01 | Pendiente | Manual. El protocolo está escrito y congelado (2026-11-12, sha256 en `protocolo.congelado.json`) y el pipeline lo verifica (PU-clasificador-09); falta la aprobación de la tutora |
| PA-HU33-02 | Pendiente | Manual. El dataset lleva su sha256 y solo seudónimos (PU-dataset-01 a 05, PU-research-79, datos sintéticos); falta construirlo con los datos reales                               |

## HU-34 · Entrenar y evaluar el clasificador

| PA         | Estado    | Motivo / prueba                                                                                                                                           |
| ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU34-01 | Pendiente | Manual. La partición por sujeto da 0 sujetos compartidos en todos los pliegues con datos sintéticos (PU-clasificador-04 y 05); falta con los datos reales |
| PA-HU34-02 | Pendiente | Manual. El informe V3c existe (PU-clasificador-06, 10 y 11); falta correrlo con los datos reales                                                          |
| PA-HU34-03 | Pendiente | Manual. Las clases con < 8 sujetos reales se excluyen con constancia (PU-clasificador-08); falta con los datos reales                                     |

## HU-15 · Tableros descriptivos

| PA         | Estado   | Motivo / prueba                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PA-HU15-01 | Cumplido | "Mi progreso": % promedio por variable y semana (lunes a domingo, hora de La Paz) del propio estudiante, con el cambio frente a su semana anterior; un docente recibe 403 (E2E PA-HU15-01, PA-HU15-01 API, PU-analytics-01, PU-web-26 y 27); además, una línea por variable a lo largo de las semanas y los errores más frecuentes en barras (PU-graficos-02, PU-web-41 y 42)                                                  |
| PA-HU15-02 | Cumplido | "Mi grupo": en cuántos de los últimos N intentos evaluados apareció cada clase, por estudiante con asignación vigente, en orden alfabético y sin rankings ni puntajes; un estudiante recibe 403 (E2E PA-HU15-02, PA-HU15-02 API, PU-analytics-02 y 03, PU-contracts-30 y 31, PU-web-28); además, mapa de calor con el texto en cada celda y la tendencia de cada variable por estudiante, en orden alfabético (PU-graficos-03) |

## HU-35 · Etiqueta del clasificador en resultados

| PA         | Estado    | Motivo / prueba                                                                                                                                                                                                                                                                                                                  |
| ---------- | --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU35-01 | Prototipo | Con la bandera apagada (por defecto), la pantalla y lo guardado son idénticos a lo de las reglas (E2E PA-HU35-01, PU-classifier-01, PU-web-29 y 30). Con la bandera encendida, la etiqueta marcada como tal solo se prueba con un modelo de prueba (PU-web-30): no hay modelo publicado porque V3c no se corrió con datos reales |

## HU-39 · Planes, suscripciones y solicitudes de acceso (ADR-004)

Como superadministrador, quiero definir planes y suscribir a cada institución (o a un docente independiente) con sus límites, para demostrar la factibilidad económica del sistema.

| PA         | Estado    | Motivo / prueba                                                                                                                                                                                                                                                                     |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU39-01 | Cumplido  | La ruta pública de solo lectura lista solo los planes activos; precio y límites sin definir vienen vacíos ("—"). `GET /api/planes` sin sesión, solo activos, precio y límites vacíos; no acepta escrituras (PA-HU39-01 API, PU-contracts-32)                                        |
| PA-HU39-02 | Cumplido  | La solicitud de acceso se envía sin sesión desde la página de inicio y la ve y atiende el superadministrador. Formulario público y lista del superadministrador con "Marcar como atendida" (PA-HU39-02 API, PU-contracts-33)                                                        |
| PA-HU39-03 | Cumplido  | El superadministrador crea, edita y desactiva planes. Crear, editar (precio redondeado a centavos) y desactivar; nombre repetido → 409 (PA-HU39-03 API)                                                                                                                             |
| PA-HU39-04 | Cumplido  | Un docente independiente es una institución de un solo docente; la suscripción admite un convenio con condiciones propias. El usuario del docente independiente tiene los roles de administrador y docente; el convenio guarda condiciones y límites propios (PA-HU39-04 API)       |
| PA-HU39-05 | Cumplido  | Con suscripción activa, crear un docente o estudiante por encima del límite se rechaza con un mensaje claro. 409 con el plan, el límite y cuántos hay; otros roles sin límite (PA-HU39-05 API)                                                                                      |
| PA-HU39-06 | Cumplido  | Sin suscripción activa, o con el límite sin definir, no se aplica límite. Suscripción vencida o límite vacío del convenio: se crea el usuario (PA-HU39-06 API)                                                                                                                      |
| PA-HU39-07 | Cumplido  | "Mi plan" muestra al administrador el plan actual, los límites usados y el vencimiento. Plan, estado, vencimiento y "n de m" docentes y estudiantes (PA-HU39-07 API, PU-contracts-34)                                                                                               |
| PA-HU39-08 | Cumplido  | Las rutas de gestión responden 403 a administradores, docentes, estudiantes e investigadores. 10 rutas de gestión × administrador, docente, estudiante, investigador y docente de otra institución → 403 (PA-HU39-08 API)                                                           |
| PA-HU39-09 | Cumplido  | "Mi plan" responde 403 a quien no administra esa institución. Administrador de otra institución, docente y estudiante → 403 (PA-HU39-09 API)                                                                                                                                        |
| PA-HU39-10 | Prototipo | Un pago por QR confirmado dos veces activa la suscripción una sola vez (adaptador simulado). Con el adaptador simulado: la segunda confirmación no vuelve a extender la suscripción (PA-HU39-10 API). Falta el adaptador real del banco: no hay documentación técnica de su API     |
| PA-HU39-11 | Cumplido  | Sin adaptador del banco o sin precio definido no se genera el QR. Sin adaptador → "pasarela no disponible"; sin precio → no se cobra (PA-HU39-11 API)                                                                                                                               |
| PA-HU39-12 | Cumplido  | E2E: el superadministrador gestiona planes y la ventana de planes de la página de inicio los lee de la ruta pública. E2E PA-HU39-12 con axe sin errores graves; PU-diseno-04 cuenta los planes de la ruta pública                                                                   |
| PA-HU39-13 | Prototipo | E2E: el formulario de solicitud reemplaza al correo y "Mi plan" muestra el pago por QR en integración con el banco. E2E PA-HU39-13 con axe sin errores graves. "Mi plan" muestra "Pago por QR en integración con el banco" con el botón deshabilitado hasta tener el adaptador real |

## HU-40 · Registro de compradores y compra de planes (ADR-005)

Como docente independiente o responsable de una institución, quiero elegir un plan en la página de inicio, registrarme y pagarlo, para empezar a usar SkillTrack-Piano sin esperar a que me creen la cuenta.

| PA         | Estado    | Motivo / prueba                                                                                                                                                                                                                       |
| ---------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PA-HU40-01 | Pendiente | El registro crea la institución, su suscripción pendiente de pago y el administrador (en un docente independiente, también docente); usuario y correo únicos, contraseña con las reglas vigentes y aceptación de términos obligatoria |
| PA-HU40-02 | Pendiente | Un código de convenio válido asigna el convenio y, con precio 0, deja la cuenta activa sin pago; un código vencido, agotado o inexistente se rechaza con un mensaje claro                                                             |
| PA-HU40-03 | Pendiente | Una cuenta pendiente de pago inicia sesión, pero solo accede a su pago y a cerrar sesión                                                                                                                                              |
| PA-HU40-04 | Pendiente | La pantalla de pago muestra el plan, el monto, el QR del adaptador vigente y "Pago en verificación"; confirmado el pago (adaptador o superadministrador), el plan se activa una sola vez                                              |
| PA-HU40-05 | Pendiente | El registro y las solicitudes de acceso tienen un límite de solicitudes por minuto e IP                                                                                                                                               |
| PA-HU40-06 | Pendiente | El superadministrador crea convenios con código único, plan, precio especial, cupos y vencimiento, y ve cuántos se usaron                                                                                                             |
| PA-HU40-07 | Pendiente | Las rutas de convenios y de cuentas pendientes responden 403 a quien no es superadministrador                                                                                                                                         |
| PA-HU40-08 | Pendiente | No se guardan datos de tarjeta; el correo y el teléfono solo los ven el propio usuario y el superadministrador                                                                                                                        |
| PA-HU40-09 | Pendiente | E2E: elegir plan → registrarse → pagar (simulado) → activar → entrar                                                                                                                                                                  |
| PA-HU40-10 | Pendiente | E2E: la página de inicio tiene "Iniciar sesión" y "Empezar ahora"; términos y privacidad marcados "pendiente de revisión legal"; el asistente del primer ingreso se puede saltar                                                      |

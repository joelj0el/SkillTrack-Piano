# ADR-004 — Planes, suscripciones por institución y solicitudes de acceso

**Estado:** aceptado (autor, por recomendación de la docente de Proyecto de Grado) · **Fecha:** 2026-11-24 · **Historia:** HU-39 · **Visto bueno de la tutora:** pendiente

## Contexto

El alcance del proyecto dejaba fuera la facturación, los planes y el autorregistro: la arquitectura ya es multiinstitución (`institucion` + `membresia`), que es la base de un modelo por suscripción, pero construirlo se dejaba para después de la defensa para no restar tiempo a los objetivos específicos. El diseño v2 (ADR-003) agregó una ventana de planes solo informativa, con precios y límites "—".

La docente de Proyecto de Grado recomendó demostrar la **factibilidad económica** con un modelo de suscripción que funcione en el sistema. Este ADR cambia el alcance en ese punto y **contradice la decisión anterior**, que queda reemplazada por lo que sigue.

## Alternativas consideradas (criterios y evaluación)

| Alternativa                                                                              | Demuestra la factibilidad económica | Costo en tiempo | Riesgo para los objetivos del proyecto | Evaluación  |
| ---------------------------------------------------------------------------------------- | ----------------------------------- | --------------- | -------------------------------------- | ----------- |
| Mantener los planes solo informativos                                                    | Baja: no hay modelo en el sistema   | Nulo            | Nulo                                   | Descartada  |
| **Planes y suscripción por institución, con límites, solicitudes y pago QR desacoplado** | Alta: el modelo existe y se aplica  | Medio           | Bajo: módulo aparte, sin tocar núcleo  | **Elegida** |
| Además, autorregistro con pago en línea por tarjeta                                      | Alta                                | Alto            | Alto (seguridad, PCI, soporte)         | Descartada  |

## Decisión

**Se construye:**

- **Planes** (`plan`): nombre, descripción, beneficios, precio en Bs, periodo mensual o anual, límite de docentes y de estudiantes, destacado y activo. Un precio o un límite sin definir se guarda vacío y se muestra como "—": no se inventan cifras.
- **Suscripción por institución** (`suscripcion`): plan, estado (pendiente, activa, vencida, cancelada), fechas de inicio y fin, y **convenio especial** con condiciones propias (texto y límites que reemplazan a los del plan).
- **Docente independiente:** es una institución de un solo docente; su usuario tiene a la vez el rol de administrador de la institución y el de docente.
- **Ruta pública de solo lectura** con los planes activos (`GET /api/planes`); la ventana de planes de la página de inicio lee de ella.
- **Límites al crear usuarios:** con una suscripción activa, crear un docente o un estudiante por encima del límite se rechaza con un mensaje que dice el plan, el límite y cuántos hay. Sin suscripción activa (instituciones anteriores a este cambio y entorno de desarrollo) no se aplican límites.
- **Solicitudes de acceso:** un formulario de la página de inicio reemplaza al correo; las solicitudes las ve y atiende el superadministrador. Es la segunda ruta pública que escribe (`POST /api/solicitudes-acceso`); solo guarda los datos de contacto que la persona escribe.
- **Pantallas** con el diseño v2: gestión de planes, instituciones y convenios (superadministrador), "Mi plan" (administrador de la institución) y solicitudes de acceso.
- **Pago por QR (Banco Económico), desacoplado:** el servicio de pagos depende de una interfaz de pasarela. Al confirmarse un pago, la suscripción se activa una sola vez (idempotente: un pago confirmado dos veces activa una vez). Las pruebas usan un adaptador simulado y nunca llaman al banco. Las credenciales, cuando existan, se leen solo de variables de entorno. Mientras no se cuente con la documentación técnica de la API del banco, la pantalla "Mi plan" muestra "Pago por QR en integración con el banco" y la activación la hace el superadministrador.

**Queda fuera:**

- Pago con tarjeta: **trabajo futuro**.
- Autorregistro: las cuentas las sigue creando el administrador de cada institución.
- Facturación electrónica, prorrateos, renovación automática y cobros recurrentes.

## Actualización (2026-11-24): proveedor real implementado

- **Proveedor real implementado:** con `PAGOS_PROVEEDOR=baneco`, un adaptador de la API del Banco Económico (autenticación con token en memoria, generación del QR, consulta del estado con respaldo entre las dos formas de la ruta, anulación y conciliación) queda detrás de la misma interfaz. El simulado sigue siendo el predeterminado. El cifrado AES-256-CBC que pide el banco se hace en local; nunca se usan los servicios de cifrado del banco, que enviarían la llave en la URL.
- **Una sola fuente de verdad para activar:** la consulta del estado, el aviso del banco y la activación del superadministrador terminan en la misma transición idempotente (pendiente → pagado). El plan se activa solo si el banco informa el QR pagado y un pago con el mismo qrId, el monto esperado y BOB.
- **Aviso de pago del banco** (`POST /api/qrsimple/notifyPaymentQR`, ruta pública): preparado pero apagado (`BANECO_AVISO_ACTIVO=false`), con lista de IPs permitidas (vacía = rechaza todo) y límite por IP. Nunca activa el plan por sí solo: reconfirma consultando el estado. Es la cuarta ruta pública; no lleva la cabecera anti-CSRF porque la envía el servidor del banco.
- **Datos mínimos:** del pago se guardan nuestro id, el qrId, monto, moneda, fecha, hora y estado; no se guardan la imagen del QR ni los datos de quien paga. La llave, la contraseña, la cuenta, el token, la imagen y los cuerpos de respuesta del banco nunca van al registro ni a los mensajes de error.
- **Pendiente con el banco:** ambiente de las credenciales (certificación o producción), variante vigente de la consulta de estado, autenticación e IPs del aviso de pago. La configuración está en `docs/05-despliegue/pago-qr.md`.

## Consecuencias (positivas / negativas / qué cambia en el perfil o en la Sección II)

- **Positivas:** el sistema muestra un modelo de negocio aplicable (planes, límites y suscripciones) sin tocar el núcleo ni la privacidad: ningún dato de práctica sale del dispositivo por este cambio.
- **Negativas:** dos rutas públicas más (lectura de planes y envío de solicitudes) que hay que vigilar contra el abuso; más superficie para el superadministrador.
- **Privacidad:** las solicitudes guardan nombre, institución, correo y teléfono de contacto que la persona escribe; no se piden datos de estudiantes.
- **Sección II:** el modelo de negocio y la factibilidad económica remiten a este ADR; los precios y límites reales quedan "pendientes" hasta que el autor los defina.

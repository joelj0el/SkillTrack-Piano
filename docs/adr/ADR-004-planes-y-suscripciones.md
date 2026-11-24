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
- El adaptador real del banco, hasta tener su documentación técnica (autenticación, generación del QR, consulta del estado y ambiente de pruebas).

## Consecuencias (positivas / negativas / qué cambia en el perfil o en la Sección II)

- **Positivas:** el sistema muestra un modelo de negocio aplicable (planes, límites y suscripciones) sin tocar el núcleo ni la privacidad: ningún dato de práctica sale del dispositivo por este cambio.
- **Negativas:** dos rutas públicas más (lectura de planes y envío de solicitudes) que hay que vigilar contra el abuso; más superficie para el superadministrador.
- **Privacidad:** las solicitudes guardan nombre, institución, correo y teléfono de contacto que la persona escribe; no se piden datos de estudiantes.
- **Sección II:** el modelo de negocio y la factibilidad económica remiten a este ADR; los precios y límites reales quedan "pendientes" hasta que el autor los defina.

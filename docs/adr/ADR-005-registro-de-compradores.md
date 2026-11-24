# ADR-005 — Autorregistro de compradores y compra de planes desde la página de inicio

**Estado:** aceptado (autor, por recomendación de la docente de Proyecto de Grado) · **Fecha:** 2026-11-24 · **Historia:** HU-40 · **Visto bueno de la tutora:** pendiente

## Contexto

Las cuentas las crea el administrador de cada institución y no hay autorregistro, en parte para proteger a los estudiantes menores, que no necesitan correo (RD-08, T-22). El ADR-004 agregó planes, suscripciones por institución y un pago por QR desacoplado del banco, pero mantuvo esa regla: para adquirir un plan había que enviar una solicitud y esperar a que el superadministrador creara la institución.

La docente de Proyecto de Grado recomendó que los planes se puedan **adquirir desde la página de inicio**, por la **sostenibilidad económica** del sistema. Este ADR cambia el alcance en ese punto y **contradice RD-08 y T-22** solo para los compradores; para los estudiantes, la regla sigue igual.

## Alternativas consideradas (criterios y evaluación)

| Alternativa                                                                 | Permite comprar desde el inicio  | Protege a los menores               | Costo en tiempo | Evaluación  |
| --------------------------------------------------------------------------- | -------------------------------- | ----------------------------------- | --------------- | ----------- |
| Mantener solo las solicitudes de acceso (ADR-004)                           | No: espera al superadministrador | Sí                                  | Nulo            | Descartada  |
| **Autorregistro solo de compradores adultos, con cuenta pendiente de pago** | Sí                               | Sí: los estudiantes no se registran | Medio           | **Elegida** |
| Autorregistro abierto a cualquier persona, incluidos estudiantes            | Sí                               | No: menores sin control adulto      | Medio           | Descartada  |

## Decisión

**Se construye:**

- **Registro de compradores** (`POST /api/registro`, ruta pública): solo para un **docente independiente** o una **institución**, ambos adultos. Pide tipo, nombre, correo, teléfono, usuario, contraseña (mismas reglas que el cambio de contraseña), nombre de la institución y la aceptación de los términos y la política de privacidad. Crea la institución, su suscripción en estado **pendiente de pago** y el usuario administrador; en un docente independiente, ese usuario también es docente. Usuario y correo son únicos. El registro abre la sesión.
- **Los estudiantes siguen sin registrarse solos:** los crea el administrador o el docente, como hasta ahora (RD-08 sigue vigente para ellos).
- **Cuenta pendiente de pago:** puede iniciar sesión, pero solo ve su pantalla de pago y "Cerrar sesión"; el servidor rechaza con 403 cualquier otra ruta. La pantalla muestra el plan, el monto, el QR del adaptador vigente (simulado mientras no esté el del banco) y el estado "Pago en verificación". Cuando el pago se confirma (por el adaptador o porque el superadministrador lo activa desde Solicitudes), la suscripción se activa una sola vez y la aplicación se habilita. Una suscripción en estado pendiente creada por el superadministrador también bloquea a su institución hasta activarla.
- **Convenios con código:** el superadministrador crea códigos únicos con plan asociado, precio especial (puede ser 0), cupos y vencimiento, y ve cuántos se usaron. Un código válido en el registro asigna el convenio; con precio 0, la cuenta queda activa sin pago. Un código vencido, agotado o inexistente se rechaza con un mensaje claro.
- **Límite de solicitudes por minuto e IP** en las dos rutas públicas que escriben (registro y solicitudes de acceso). La IP es la que agrega el proxy de origen único (última entrada de `X-Forwarded-For`).
- **Primer ingreso del administrador:** un asistente corto (bienvenida → crear el primer docente → crear el primer estudiante) que se puede saltar.
- **Páginas de términos y de privacidad** con un texto base marcado "pendiente de revisión legal".

**Datos mínimos:**

- No se guardan datos de tarjeta: no hay pago con tarjeta (sigue como trabajo futuro del ADR-004).
- El correo y el teléfono del comprador solo los ven el propio usuario y el superadministrador; las listas de usuarios de la institución no los incluyen.
- Se guarda el instante en que se aceptaron los términos y la política de privacidad.

**Queda fuera:**

- Verificación del correo o del teléfono, recuperación de contraseña por correo y autorregistro de estudiantes.
- El texto legal definitivo de los términos y de la política de privacidad.
- El adaptador real del banco (sigue lo dicho en el ADR-004).

## Consecuencias (positivas / negativas / qué cambia en el perfil o en la Sección II)

- **Positivas:** el modelo de negocio del ADR-004 se puede recorrer completo desde la página de inicio (elegir plan → registrarse → pagar → usar la aplicación), sin intervención del superadministrador cuando hay pago o un convenio gratuito.
- **Negativas:** una tercera ruta pública que escribe, con riesgo de abuso (mitigado con el límite por IP); cuentas creadas sin verificar el correo; más datos de contacto que proteger.
- **Privacidad:** el registro guarda nombre, correo, teléfono y usuario de un adulto; no se piden datos de estudiantes ni de práctica. Ningún video, audio ni punto de la mano sale del dispositivo por este cambio.
- **Sección II:** el análisis de requisitos y de seguridad remite a este ADR para las cuentas de compradores; RD-08 y T-22 quedan vigentes para estudiantes, docentes e investigadores creados por el administrador.

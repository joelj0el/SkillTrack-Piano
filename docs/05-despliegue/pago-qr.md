# Pago por QR con el Banco Económico

Cómo pasar del pago simulado al QR real del banco. Ningún valor real se escribe en el repositorio: las variables van en un `.env` que git ignora. El diseño está en el [ADR-004](../adr/ADR-004-planes-y-suscripciones.md).

## Proveedores

| `PAGOS_PROVEEDOR`        | Qué hace                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| `simulado` (por defecto) | Muestra un "QR simulado" que no sirve para pagar. La activación la hace el superadministrador.          |
| `baneco`                 | Genera el QR real con la API del banco, consulta su estado y activa el plan cuando se confirma el pago. |

Con cualquiera de los dos, el superadministrador puede activar un plan desde **Solicitudes → Cuentas pendientes de pago**.

## Variables

| Variable              | Qué es                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------- |
| `PAGOS_PROVEEDOR`     | `simulado` o `baneco`                                                                        |
| `BANECO_API_URL`      | Dirección base de la API del banco, terminada en `/ApiGateway/` (certificación o producción) |
| `BANECO_USUARIO`      | Usuario de la API que entrega el banco                                                       |
| `BANECO_CONTRASENA`   | Contraseña de ese usuario (se cifra en memoria antes de enviarla)                            |
| `BANECO_CUENTA`       | Cuenta donde se acredita el pago (se cifra en memoria antes de enviarla)                     |
| `BANECO_LLAVE_AES`    | Llave de cifrado que entrega el banco: exactamente 32 caracteres                             |
| `BANECO_AVISO_ACTIVO` | `true` para recibir el aviso de pago del banco; por defecto `false`                          |
| `BANECO_AVISO_IPS`    | IPs del banco permitidas para el aviso, separadas por comas; vacío = rechaza todo aviso      |

Hosts del banco:

- Certificación: `https://apimktdesa.baneco.com.bo/ApiGateway/`
- Producción: `https://apimkt.baneco.com.bo/ApiGateway/`

Con `PAGOS_PROVEEDOR=baneco`, si falta alguna variable `BANECO_` o la llave no tiene 32 caracteres, **la API no arranca** y el error nombra la variable, nunca su valor.

## Dónde se ponen

- **Local con Docker:** en `infra/.env` (junto a `docker-compose.yml`). El compose las pasa a la API; las que no estén quedan vacías y el proveedor queda en `simulado`.
- **Prueba manual desde la PC:** en `apps/api/.env` (ver `apps/api/.env.example`).
- **Producción:** en `/opt/skilltrack/.env` de la máquina virtual (ver `infra/produccion.env.example`). Después, vuelve a desplegar o reinicia con `docker compose -f docker-compose.prod.yml up -d`.

## Prueba manual con Bs 1

Antes de activar `baneco` para todos, prueba las credenciales desde la PC:

```powershell
pnpm baneco:probar --monto 1
```

El comando autentica, genera un QR de Bs 1, lo guarda como PNG en `apps/api/.baneco/` (ignorada por git) y muestra la ruta. Escanéalo y págalo con la aplicación del banco: el comando consulta el estado cada 5 s durante 3 minutos (`pendiente`, `PAGADO` o `anulado`) y al final dice qué variante de la consulta de estado funcionó. Para anular un QR de prueba:

```powershell
pnpm baneco:probar --anular <qrId>
```

## Cómo funciona

- La pantalla de pago (cuenta pendiente) y "Mi plan" muestran el QR, el monto, la fecha de vencimiento (mañana, hora de La Paz) y "Esperando el pago…". La pantalla consulta al servidor cada 5 s; el servidor consulta al banco como mucho una vez cada 5 s por pago.
- El plan se activa solo si el banco informa el QR pagado y un pago con el mismo qrId, el monto esperado y la moneda BOB. Un pago con otro monto no activa nada.
- Si el QR se anula o vence, la pantalla dice "El QR venció" y ofrece "Generar nuevo QR". "Cancelar" anula el QR en el banco.
- Si el banco no responde: "No pudimos generar el QR. Intenta de nuevo en unos minutos". La activación manual del superadministrador sigue disponible.
- Del pago solo se guardan nuestro id, el qrId, el monto, la moneda, la fecha, la hora y el estado. No se guardan la imagen del QR ni los datos de quien paga.
- En el registro de la API nunca aparecen la llave, la contraseña, la cuenta, el token, la imagen ni los cuerpos de respuesta del banco: solo el código HTTP y el `responseCode`.

## Aviso de pago del banco (apagado)

La ruta `POST /api/qrsimple/notifyPaymentQR` está preparada para que el banco avise un pago, pero viene apagada. Para usarla hace falta acordar con el banco la autenticación del aviso y sus IPs de origen; luego:

1. `BANECO_AVISO_ACTIVO=true`.
2. `BANECO_AVISO_IPS=<IPs del banco, separadas por comas>`.
3. Darle al banco la dirección `https://<DOMINIO>/api/qrsimple/notifyPaymentQR`.

El aviso nunca activa el plan por sí solo: siempre se reconfirma consultando el estado del QR. Responde `{"responseCode": 0, "message": ""}`, es idempotente por qrId y tiene un límite de solicitudes por minuto e IP.

## Pruebas

Las pruebas automáticas y la CI nunca llaman al banco: usan un servidor falso (`apps/api/tests/banco_falso.py`). La E2E del flujo con el banco falso se corre aparte:

```powershell
docker compose -p skilltrack-e2e -f infra/docker-compose.yml -f infra/docker-compose.banco-falso.yml up -d --build
$env:E2E_BANECO = "1"; pnpm e2e e2e/baneco.spec.ts
```

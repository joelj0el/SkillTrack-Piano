from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

# Cabecera propia obligatoria en toda escritura bajo /api. Un sitio ajeno no puede enviarla sin
# una petición previa de CORS, que la API no autoriza. La web la envía en cada escritura.
CABECERA_CSRF = "x-skilltrack-csrf"
METODOS_DE_ESCRITURA = frozenset({"POST", "PUT", "PATCH", "DELETE"})
# El aviso de pago lo envía el servidor del banco, que no puede mandar la cabecera propia. La ruta
# se protege de otra forma: apagada por defecto, lista de IPs permitidas y límite por IP.
RUTAS_SIN_CSRF = frozenset({"/api/qrsimple/notifyPaymentQR"})


class ExigirCabeceraCsrf(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if (
            request.method in METODOS_DE_ESCRITURA
            and request.url.path.startswith("/api/")
            and request.url.path not in RUTAS_SIN_CSRF
            and request.headers.get(CABECERA_CSRF) != "1"
        ):
            return JSONResponse({"detail": "Falta la cabecera anti-CSRF."}, status_code=403)
        return await call_next(request)

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import Response

from app.core.csrf import METODOS_DE_ESCRITURA

# Ningún endpoint acepta binarios: toda escritura con cuerpo es JSON de hasta 256 KB.
LIMITE_CUERPO_BYTES = 256 * 1024


class LimitarCuerpo(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.method not in METODOS_DE_ESCRITURA or not request.url.path.startswith("/api/"):
            return await call_next(request)
        longitud = request.headers.get("content-length")
        if longitud is None and request.headers.get("transfer-encoding"):
            return JSONResponse({"detail": "Se requiere Content-Length."}, status_code=411)
        if longitud is not None and int(longitud) > LIMITE_CUERPO_BYTES:
            return JSONResponse({"detail": "El cuerpo supera 256 KB."}, status_code=413)
        tipo = request.headers.get("content-type", "").split(";")[0].strip().lower()
        if longitud not in (None, "0") and tipo != "application/json":
            return JSONResponse({"detail": "Solo se acepta application/json."}, status_code=415)
        return await call_next(request)

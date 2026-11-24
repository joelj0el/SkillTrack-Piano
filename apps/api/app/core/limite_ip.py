"""Límite de solicitudes por minuto e IP en las rutas públicas que escriben (ADR-005).

La API solo se alcanza a través del proxy de origen único, que reemplaza `X-Forwarded-For` con la
IP de quien se conecta: se usa su última entrada. La cuenta vive en memoria de cada proceso (la
API corre en uno solo); un reinicio la vacía, lo que solo afloja el límite por un minuto.
"""

from collections import deque
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status

from app.core.reloj import ahora

# Solicitudes permitidas por IP y ruta en la ventana.
SOLICITUDES_POR_MINUTO = 5
VENTANA = timedelta(minutes=1)


def ip_del_cliente(request: Request) -> str:
    reenviada = request.headers.get("x-forwarded-for")
    if reenviada:
        return reenviada.split(",")[-1].strip()
    return request.client.host if request.client else "desconocida"


class LimitePorIp:
    def __init__(self, maximo: int = SOLICITUDES_POR_MINUTO, ventana: timedelta = VENTANA):
        self.maximo = maximo
        self.ventana = ventana
        self._marcas: dict[tuple[str, str], deque[datetime]] = {}

    def permitir(self, ruta: str, ip: str, instante: datetime) -> bool:
        clave = (ruta, ip)
        marcas = self._marcas.setdefault(clave, deque())
        while marcas and instante - marcas[0] >= self.ventana:
            marcas.popleft()
        if len(marcas) >= self.maximo:
            return False
        marcas.append(instante)
        return True


def limitar_por_ip(request: Request, instante: Annotated[datetime, Depends(ahora)]) -> None:
    limite: LimitePorIp = request.app.state.limite_ip
    if not limite.permitir(request.url.path, ip_del_cliente(request), instante):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Demasiadas solicitudes desde tu conexión. Espera un minuto e inténtalo de nuevo.",
        )

from fastapi import HTTPException, status


def exigir_sesion() -> None:
    # Hasta que exista el módulo identity no hay sesiones válidas: toda ruta privada responde 401.
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Se requiere sesión")

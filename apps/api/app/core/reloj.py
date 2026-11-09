from datetime import UTC, date, datetime, timedelta, timezone

# Bolivia no tiene horario de verano: America/La_Paz es UTC−4 todo el año.
ZONA_LOCAL = timezone(timedelta(hours=-4), "America/La_Paz")


def ahora() -> datetime:
    """Dependencia de FastAPI; las pruebas la reemplazan por un reloj fijo."""
    return datetime.now(UTC)


def hoy_local(instante: datetime) -> date:
    return instante.astimezone(ZONA_LOCAL).date()

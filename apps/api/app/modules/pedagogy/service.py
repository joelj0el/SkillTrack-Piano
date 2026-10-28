from datetime import date

from app.modules.pedagogy.models import Tarea


def estado(tarea: Tarea, hoy: date) -> str:
    """Estado calculado: Cancelada > Vencida > Asignada (sin intentos todavía: It-1)."""
    if tarea.cancelada_en is not None:
        return "Cancelada"
    if tarea.fecha_limite < hoy:
        return "Vencida"
    return "Asignada"

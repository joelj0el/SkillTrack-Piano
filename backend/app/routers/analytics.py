from fastapi import APIRouter

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary")
async def analytics_summary():
    """Stub: analítica agregada de progreso. Se implementará en una iteración futura."""
    return {"status": "not_implemented", "detail": "Módulo de analítica pendiente"}

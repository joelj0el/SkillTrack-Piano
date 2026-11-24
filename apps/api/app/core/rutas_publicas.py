# Única lista de rutas que no exigen sesión. Toda ruta fuera de ella depende de exigir_sesion
# y lleva su prueba "docente ajeno → 403". Agregar una ruta aquí requiere justificarla.
RUTAS_PUBLICAS: frozenset[str] = frozenset(
    {
        "/api/health",
        # Sin sesión todavía: es la ruta que la crea.
        "/api/auth/login",
        # Planes activos para la página de inicio: solo lectura (ADR-004).
        "/api/planes",
        # Solicitud de acceso desde la página de inicio, sin cuenta todavía (ADR-004).
        "/api/solicitudes-acceso",
    }
)

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
        # Registro de compradores adultos: crea la cuenta pendiente de pago (ADR-005).
        "/api/registro",
        # Aviso de pago que envía el servidor del banco (ADR-004): apagado por defecto, solo desde
        # las IPs permitidas, con límite por IP; nunca activa el plan sin reconfirmar el estado.
        "/api/qrsimple/notifyPaymentQR",
    }
)

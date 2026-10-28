# n.7 Modelos — Iteración 1 (versión de avance)

La It-1 no incluye modelos de análisis: no hay detección de la mano, análisis de audio, reglas de diagnóstico ni clasificador. El núcleo de análisis (`packages/core`) solo expone su versión. Los modelos empiezan en la It-2 (detección de la mano con MediaPipe, autoalojada).

Los modelos de esta iteración son de datos y de dominio:

- **Modelo de datos:** ver n.5.
- **Estado de la tarea:** calculado, no guardado: Cancelada si `cancelada_en` no es nulo; si no, Vencida si el plazo es anterior a hoy (America/La_Paz); si no, Asignada. Los estados que dependen de intentos (En práctica, Revisada) llegan cuando existan los intentos.
- **Vigencia de la asignación:** vigente si `desde ≤ hoy` y (`hasta` es nulo o `hasta > hoy`).

## Estado de esta versión

| Elemento                           | Estado    | Motivo                                             |
| ---------------------------------- | --------- | -------------------------------------------------- |
| Modelos de análisis                | No aplica | Empiezan en la It-2                                |
| Estados "En práctica" y "Revisada" | Pendiente | Requieren intentos (It-2) y valoración de la tarea |

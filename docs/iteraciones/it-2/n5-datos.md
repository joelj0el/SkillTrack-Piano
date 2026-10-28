# n.5 Datos — Iteración 2 (versión de avance)

Migración `apps/api/migrations/versions/0005_intentos.py`.

| Tabla         | Columnas clave                                                                                                                                                                                                                                                                                                                                                           | Notas                                                                                                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `intento`     | `client_uuid` UNIQUE, `estudiante_id`, `version_ejercicio_id`, `tarea_id`, `version_nucleo`, `version_modelo_mano`, `instrumento`, `manos`, `clase_dispositivo`, `modo`, `modo_metronomo`, `tempo_elegido_bpm`, `tempo_medido_bpm`, `estado`, `motivo_no_evaluable`, `cuenta_para_tarea`, `motivo_no_cuenta`, `iniciado_en`, `duracion_ms`, porcentajes, `eventos` JSONB | **Sin video, audio, imagen ni series de puntos de la mano.** `eventos` guarda por nota el estado, la tecla, el dedo y los rasgos agregados. `referencia_id`, `conjunto_reglas_id` y `modelo_clasificador_id` quedan nulos hasta la It-4 |
| `diagnostico` | `intento_id`, `clase_error_id`, `indicador_id`, `origen`, `version_origen`, `eventos_evidencia`, `confianza`                                                                                                                                                                                                                                                             | Se llena desde la It-4                                                                                                                                                                                                                  |

**Índices:** `intento(estudiante_id, iniciado_en DESC)` e `intento(tarea_id, iniciado_en) WHERE cuenta_para_tarea`.

**En el teléfono:** IndexedDB `skilltrack` / `bandeja`, con un `ResultadoIntento` por entrada y su estado de envío. No se guardan fotogramas ni puntos de la mano.

## Estado de esta versión

Implementado: tablas, migración reversible y contrato `ResultadoIntento` v1. Pendiente: `indicador` y las vistas de avance de la tarea.

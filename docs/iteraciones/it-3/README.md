# Versión de avance — Iteración 3 (rama `entrega/it-3`)

Incluye la It-1 y la It-2 (ver sus README) más el audio en el teléfono: prueba de micrófono, metrónomo con conteo audible, detección de ataques, tempo y regularidad, clase de altura de cada nota y dedo atribuido por la visión a cada ataque. Es la rama recomendada para la demostración. No se fusiona a `main`.

## Levantar el sistema

```bash
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up --build
```

Abre <https://localhost>. Usuarios de demostración (contraseña `demo-piano-2026`, solo local): `admin.demo`, `docente.demo`, `docente2.demo`, `estudiante.demo`, `estudiante2.demo`, `estudiante3.demo`, `investigador.demo`.

## Qué mostrar

1. **Prueba de micrófono** (`estudiante.demo` → "Micrófono"): el medidor se mueve con el sonido; "Probar el micrófono" pide silencio y luego unas notas, y el semáforo dice si hay ruido o saturación.
2. **Práctica completa** (una tarea → "Practicar"): encuadre con las manos → micrófono → calibración → tempo y modo de metrónomo → 4 clics → tocar la escala → el análisis empieza solo.
3. **Resultado provisional**: ritmo (tempo inicial y final, estable o cambio, notas irregulares) y, nota por nota, ✓ / ✗ / dudosa / faltante, con la mano y el dedo vistos por la cámara; las notas extra al pie.
4. **Sin micrófono**: negando el permiso, la app ofrece continuar en modo solo visión.

## Pruebas

```bash
pnpm test
uv run --project apps/api pytest
pnpm e2e        # Chromium con cámara y micrófono simulados
```

## Estado de esta versión

| Elemento                                                      | Estado       | Motivo                                                                              |
| ------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| Núcleo de audio y alineamiento de notas                       | Implementado | Con señales sintéticas                                                              |
| Audio en el teléfono (micrófono, metrónomo, resultado)        | Prototipo    | Funciona de punta a punta; la exactitud no se midió (requiere grabaciones anotadas) |
| Registro de `audio_sin_procesar` y tempo medido en el intento | Pendiente    | Requiere el contrato `ResultadoIntento` v2                                          |
| Avance de la tarea (HU-37)                                    | No incluido  | —                                                                                   |

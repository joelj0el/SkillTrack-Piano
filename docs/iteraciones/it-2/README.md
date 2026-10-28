# Versión de avance — Iteración 2 (rama `entrega/it-2`)

Incluye todo lo de la It-1 (ver `docs/iteraciones/it-1/README.md`) más el núcleo de análisis visual, el registro de intentos sin video y la pantalla de encuadre. No se fusiona a `main`.

## Levantar el sistema

```bash
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up --build
```

Usuarios de demostración y prueba desde el Android: igual que en la It-1. Para la cámara, el Android necesita confiar en la CA local (la cámara exige HTTPS de confianza).

## Qué mostrar

1. **Encuadre** (`estudiante.demo` → abrir una tarea → "Practicar"): la app pide la cámara trasera y el semáforo reacciona en vivo a la luz, la nitidez y el movimiento, con el motivo en texto. Tapa la cámara o muévela para ver los cambios. Indica que, sin el detector de la mano, no llega a verde.
2. **Permiso negado**: bloquea la cámara en los ajustes del sitio → pantalla con los pasos y "Reintentar".
3. **Privacidad**: con las herramientas de desarrollo abiertas (pestaña Red) durante el encuadre no aparece ninguna petición con imagen o video.
4. **Núcleo**: `pnpm vitest run packages/core` ejecuta las pruebas de geometría, calidad, rasgos, manos y dedos, incluidas las de propiedades (miles de casos generados).
5. **API de intentos**: `uv run --project apps/api pytest apps/api/tests/test_pa_hu08.py -v` (idempotencia, 413/415, versiones, 403).

## Pruebas

```bash
pnpm test
uv run --project apps/api pytest
pnpm e2e        # con el sistema levantado; usa Chromium completo con cámara simulada
```

## Estado de esta versión

| Elemento                                                          | Estado       | Motivo                                                      |
| ----------------------------------------------------------------- | ------------ | ----------------------------------------------------------- |
| Núcleo de análisis visual                                         | Implementado | Con datos sintéticos y propiedades                          |
| Intentos sin video y bandeja de salida                            | Implementado | —                                                           |
| Pantalla de encuadre                                              | Prototipo    | Sin detector de la mano                                     |
| Detector, calibración en pantalla, ejecución completa y resultado | Pendiente    | El detector requiere decidir `'wasm-unsafe-eval'` en su ADR |
| Modo investigación (HU-18)                                        | No incluido  | Fuera del tiempo de esta entrega                            |

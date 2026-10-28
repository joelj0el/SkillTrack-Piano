# Versión de avance — Iteración 2 (rama `entrega/it-2`)

Incluye todo lo de la It-1 (ver `docs/iteraciones/it-1/README.md`) más el análisis visual en el teléfono: detector de la mano autoalojado (ADR-002), calibración del teclado, ejecución con fin automático, análisis en un Web Worker, resultado provisional por nota e intento guardado sin video. No se fusiona a `main`.

## Levantar el sistema

```bash
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up --build
```

La imagen web descarga el modelo de la mano al construirse y lo verifica con su SHA-256 (`apps/web/public/mediapipe/version.json`). Para `pnpm dev`, antes ejecuta `pnpm mediapipe`.

Usuarios de demostración: ver el README de la It-1. Para probar en el Android por USB: `docs/iteraciones/it-1/README.md` y el proxy de `pnpm dev`.

## Qué mostrar

1. **Encuadre** (`estudiante.demo` → una tarea → "Practicar"): los 21 puntos de cada mano sobre el video, la etiqueta Izquierda/Derecha, los fps y el semáforo. Con las dos manos visibles y buena luz llega a verde y habilita "Continuar". Con la webcam frontal de la PC, marca "Cámara frontal".
2. **Calibración**: 4 toques guiados en los extremos del rango del ejercicio; aparecen las teclas dibujadas y, sobre cada dedo, la tecla que está tocando. "Confirmar" la guarda en el teléfono.
3. **Ejecución**: conteo de 4 pulsos → "Tocando" sin tocar la pantalla → al quedarte quieto pasa sola a "Analizando".
4. **Resultado provisional**: nota por nota, la tecla y el dedo detectados por mano; la digitación figura como "no evaluable: pendiente de transcripción". El intento queda en "Mis intentos" de la tarea.
5. **Privacidad**: en la pestaña Red de las herramientas de desarrollo no aparece ninguna petición con imagen o video.

## Pruebas

```bash
pnpm test
uv run --project apps/api pytest
pnpm e2e        # con el sistema levantado; usa Chromium completo con cámara simulada
```

## Estado de esta versión

| Elemento                                                    | Estado       | Motivo                                                                               |
| ----------------------------------------------------------- | ------------ | ------------------------------------------------------------------------------------ |
| Núcleo de análisis visual                                   | Implementado | Con datos sintéticos y propiedades                                                   |
| Detector, calibración, ejecución y resultado en el teléfono | Prototipo    | Funciona de punta a punta; la exactitud no se midió (requiere clips anotados)        |
| Secuencia esperada                                          | Prototipo    | Escala generada desde la tónica, sin digitación, hasta tener la partitura transcrita |
| Intentos sin video y bandeja de salida                      | Implementado | —                                                                                    |
| Modo investigación (HU-18)                                  | No incluido  | Fuera del tiempo de esta entrega                                                     |

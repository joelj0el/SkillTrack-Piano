# n.6 Pruebas — Iteración 2 (versión de avance)

## Pruebas de aceptación (PA)

Resultados generados desde los reportes JUnit en [`n6-pruebas.generado.md`](n6-pruebas.generado.md). Para regenerarlos, con el sistema levantado:

```bash
pnpm vitest run packages apps src/ research infra tools/ci tools/docs tools/normalizar \
  --reporter=default --reporter=junit --outputFile.junit=reports/vitest.xml
uv run --project apps/api pytest apps/api --junitxml=reports/pytest-api.xml
uv run --project research/python pytest research/python --junitxml=reports/pytest-research.xml
pnpm e2e
pnpm docs:tests it-2 --historias HU-03,HU-09,HU-05,HU-12,HU-36,HU-04,HU-08
```

Las E2E usan Chromium completo con cámara simulada (`--use-fake-device-for-media-stream`); el modo _headless-shell_ no implementa la captura de cámara.

## Pruebas unitarias (PU) y de propiedades (PP)

| Módulo   | Fronteras y propiedades                                                                                                                                                                                                                                         |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| geometry | PP: la homografía lleva cada punto a su destino y la inversa lo devuelve, sobre cuadriláteros perturbados; PU: tecla negra justo dentro y fuera de su ancho, borde Mi–Fa sin negra, fuera del tramo, cobertura del rango                                        |
| quality  | Luz justo por debajo y en cada umbral; movimiento en el umbral; desplazamiento de 2 % (se reutiliza) y apenas más (invalida)                                                                                                                                    |
| features | One Euro (constante, temblor, retardo, tiempo repetido); PP de invariancia de los rasgos a escala, traslación y rotación; PP: el orden del detector no cambia la identidad de las manos; descenso justo en el umbral y apenas por debajo; PRM-16 en 70 % y 69 % |
| capture  | Fin por quietud a 1,49 s y 1,5 s; límite de 1,5 × la duración esperada justo antes y en el límite                                                                                                                                                               |
| outbox   | Pendiente sin red, guardado con red, rechazo 4xx, solo resultados válidos                                                                                                                                                                                       |

## Validación del OE

La validación V1 del OE2 (exactitud tecla–dedo con clips anotados) queda pendiente: requiere el detector de la mano y los clips del autor.

## Estado de esta versión

Implementado: las pruebas listadas en el reporte generado. Pendiente: las PA de exactitud ("requiere fixtures anotados"), las que necesitan el detector y las manuales.

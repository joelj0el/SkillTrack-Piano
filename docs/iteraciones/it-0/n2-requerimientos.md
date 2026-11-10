# n.2 Ingeniería de requerimientos

## Tarjetas de historia

<!-- Rol · Necesidad · Valor · OE · Componentes · Códigos · Prioridad · Puntos -->

## Criterios de aceptación (Dado / Cuando / Entonces)

## Estado de los criterios del sistema de diseño

TC-17 y TC-18 son tareas habilitadoras: no tienen criterios PA propios. Estas son las condiciones que se les pidieron.

| Condición                                          | Estado    | Motivo                                                                                                                                                 |
| -------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contraste WCAG AA en claro y oscuro                | Cumplido  | `pnpm design:contraste` se ejecuta en la integración continua                                                                                          |
| axe-core sin errores graves ni críticos            | Cumplido  | La E2E `accesibilidad.spec.ts` revisa todas las pantallas en claro y oscuro; forma parte de la suite E2E local, que la integración continua no ejecuta |
| Funcionamiento sin cambios y E2E en verde          | Cumplido  | Suite E2E completa en verde; ver n.6                                                                                                                   |
| Pasos de la práctica sin manos reales              | Prototipo | La cámara simulada no muestra manos: el encuadre es la pantalla real y los pasos siguientes se capturaron de `/design/vista` con datos de ejemplo      |
| Teclas iluminadas bajo cada dedo en la calibración | Pendiente | Implementado, pero sin comprobar con manos reales delante de la cámara                                                                                 |

## Estado de las condiciones de TC-03

| Condición                                                    | Estado    | Motivo                                                                                                 |
| ------------------------------------------------------------ | --------- | ------------------------------------------------------------------------------------------------------ |
| ADR-001 con la matriz de decisión del backend                | Cumplido  | `docs/adr/ADR-001-backend-fastapi.md`; visto bueno de la tutora: pendiente                             |
| ADR-002 existe                                               | Cumplido  | `docs/adr/ADR-002-csp-wasm-unsafe-eval.md`                                                             |
| Verificador de IDs: solo los PA deben existir en una tarjeta | Cumplido  | `pnpm docs:ids` corre en la integración continua (PU-docs-04 y 05)                                     |
| `docs:build` genera un .docx de prueba                       | Prototipo | Genera `build/SECCION_II.docx` con pandoc; falta el `reference.docx` con los estilos de la universidad |
| ruff para `tools/docs` en la integración continua            | Cumplido  | `check` y `format --check` con la misma versión y configuración que la API                             |

# n.2 Ingeniería de requerimientos

## Tarjetas de historia

<!-- Rol · Necesidad · Valor · OE · Componentes · Códigos · Prioridad · Puntos -->

## Criterios de aceptación (Dado / Cuando / Entonces)

## Estado de los criterios del sistema de diseño

TC-17 y TC-18 son tareas habilitadoras: no tienen criterios PA propios. Estas son las condiciones que se les pidieron.

| Condición                                          | Estado    | Motivo                                                                                                                                                                                      |
| -------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contraste WCAG AA en claro y oscuro                | Cumplido  | `pnpm design:contraste` se ejecuta en la integración continua                                                                                                                               |
| axe-core sin errores graves ni críticos            | Manual    | Sin hallazgos en la última revisión de todas las pantallas; se corrió fuera del repositorio porque axe-core no es una dependencia del proyecto, y no forma parte de la integración continua |
| Funcionamiento sin cambios y E2E en verde          | Cumplido  | Suite E2E completa en verde; ver n.6                                                                                                                                                        |
| Pasos de la práctica sin manos reales              | Prototipo | La cámara simulada no muestra manos: el encuadre es la pantalla real y los pasos siguientes se capturaron de `/design/vista` con datos de ejemplo                                           |
| Teclas iluminadas bajo cada dedo en la calibración | Pendiente | Implementado, pero sin comprobar con manos reales delante de la cámara                                                                                                                      |

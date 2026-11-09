# n.1 Objetivo específico y alcance — Iteración 3 (versión de avance)

## Objetivo específico

**OE3.** Reconocer en el teléfono el sonido de la ejecución, sincronizado con la imagen y con la partitura: ataques, tempo y regularidad, clase de altura de cada nota y dedo atribuido a cada ataque.

## Ítem de la situación problemática

**SP3.** El estudiante no puede verificar por sí mismo si toca las notas correctas ni si mantiene el tempo.

## Historias incluidas en esta versión

| Historia | Alcance de esta versión                                                                       |
| -------- | --------------------------------------------------------------------------------------------- |
| HU-19    | Programa del metrónomo: conteo de 4 pulsos, modos "con" y "sin", reglas del selector de tempo |
| HU-20    | Puerta de calidad acústica (ruido de fondo, nivel, saturación)                                |
| HU-10    | FFT, ataques por flujo espectral, cambio de tempo y tropiezo sobre los ataques crudos         |
| HU-21    | Croma por ataque y verificación de la clase de altura con estado "dudoso"                     |
| HU-11    | Fusión simple: dedo atribuido en cada ataque, con la modalidad marcada                        |

## Fuera de alcance de esta versión

Captura de audio en el navegador (AudioWorklet), pantallas de prueba de micrófono y de metrónomo, alineamiento con la partitura, desfase entre manos, golden de audio y HU-37 (avance de la tarea).

## Estado de esta versión

| Elemento                         | Estado       | Motivo                                               |
| -------------------------------- | ------------ | ---------------------------------------------------- |
| Núcleo de audio y fusión simple  | Implementado | Funciones puras con pruebas sobre señales sintéticas |
| Captura de audio y pantallas     | Pendiente    | Recortado por tiempo en esta entrega                 |
| Criterios con fixtures del autor | Pendiente    | Requieren grabaciones anotadas                       |

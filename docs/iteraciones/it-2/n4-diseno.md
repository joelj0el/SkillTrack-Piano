# n.4 Diseño — Iteración 2 (versión de avance)

## Núcleo de análisis (`packages/core`, TypeScript puro)

| Módulo                    | Contenido                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `geometria/homografia.ts` | Homografía por DLT de 4 puntos con normalización de Hartley; aplicar e invertir                                                                    |
| `geometria/teclado.ts`    | Modelo de teclas blancas y negras de un tramo; tecla bajo un punto; calibración por 4 toques; cobertura del rango                                  |
| `calidad/calidad.ts`      | Semáforo (verde, ámbar, rojo) con motivos en texto; luminancia, nitidez (varianza del laplaciano), movimiento; desplazamiento del teclado (PRM-17) |
| `rasgos/one-euro.ts`      | Filtro One Euro con tiempo inyectado                                                                                                               |
| `rasgos/rasgos.ts`        | Flexión MCP/PIP/DIP de cada dedo y apertura normalizada por el ancho de la palma                                                                   |
| `rasgos/manos.ts`         | Identidad MI/MD por geometría y seguimiento entre fotogramas                                                                                       |
| `rasgos/dedos.ts`         | Descenso de cada dedo, eventos visuales y comparación con la digitación esperada                                                                   |

El núcleo no usa DOM, red, reloj ni azar (verificado con ESLint y dependency-cruiser).

**Plano del teclado:** x en anchos de tecla blanca desde la primera blanca del tramo; y = 0 en el borde frontal y y = 1 en la línea donde empiezan las negras.

## Cliente (`apps/web`)

| Módulo                 | Contenido                                                                                                                   |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `captura/estado.ts`    | Máquina de estados del intento (encuadre → conteo → tocando → analizando; cancelado; no evaluable)                          |
| `captura/Encuadre.tsx` | P-36: cámara trasera, semáforo en vivo sobre fotogramas de 160 × 90 que no salen del teléfono; pantalla de error de permiso |
| `bandeja/bandeja.ts`   | Bandeja de salida en IndexedDB: pendiente → guardado o rechazado; reintento cada 10 s y al volver la red                    |

## Servidor (`apps/api`)

| Módulo                | Contenido                                                                             |
| --------------------- | ------------------------------------------------------------------------------------- |
| `attempts`            | `POST /api/intentos` (idempotente), `GET /api/intentos/{id}`, `GET /api/mis-intentos` |
| `app/core/limites.py` | Toda escritura bajo `/api`: solo `application/json`, como máximo 256 KB               |

`cuenta_para_tarea` lo calcula el servidor: en modo solo visión no hay tempo medido, así que el intento no cuenta.

## Pantallas nuevas

| Código | Pantalla | Ruta                                        |
| ------ | -------- | ------------------------------------------- |
| P-36   | Encuadre | `/practicar` (desde el detalle de la tarea) |

## Estado de esta versión

| Elemento                                                                              | Estado       | Motivo                  |
| ------------------------------------------------------------------------------------- | ------------ | ----------------------- |
| Núcleo y API                                                                          | Implementado | —                       |
| P-36                                                                                  | Prototipo    | Sin detector de la mano |
| Calibración en pantalla, P-41 (resultado provisional), P-52 (vista técnica), _worker_ | Pendiente    | Dependen del detector   |

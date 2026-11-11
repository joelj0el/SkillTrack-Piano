# n.6 Pruebas — it-3 (generado)

Generado por `pnpm docs:tests it-3` el 2026-11-11 20:03 UTC a partir de los reportes JUnit de `reports/`. No se edita a mano.

## Totales por herramienta

| Herramienta | Casos | Aprobados | Fallidos | Omitidos |
| ----------- | ----- | --------- | -------- | -------- |
| Playwright  | 39    | 38        | 0        | 1        |
| Vitest      | 280   | 280       | 0        | 0        |
| pytest      | 83    | 83        | 0        | 0        |

## Pruebas de aceptación (PA)

| PA         | Herramienta         | Casos | Resultado | Prueba                                                                                                    |
| ---------- | ------------------- | ----- | --------- | --------------------------------------------------------------------------------------------------------- |
| PA-HU10-05 | Playwright + pytest | 2     | aprobada  | PA-HU10-05: tocar fuera del rango de la tarea se informa en el resultado y no cuenta                      |
| PA-HU11-02 | Playwright          | 1     | aprobada  | PA-HU11-02: cada evento esperado tiene un registro fusionado con la modalidad de cada dato                |
| PA-HU11-05 | Playwright          | 1     | aprobada  | PA-HU11-05: un intento completo con audio no envía medios ni a otro origen, y sus eventos ocupan ≤ 256 KB |
| PA-HU20-03 | Playwright          | 1     | aprobada  | PA-HU20-03: sin permiso de micrófono se ofrece el modo solo visión                                        |
| PA-HU37-01 | Playwright          | 1     | aprobada  | PA-HU37-01: con 2 intentos válidos hoy la tarea muestra 2 de 3 y la lista con fecha y hora                |
| PA-HU37-02 | pytest              | 1     | aprobada  | test_pa_hu37_02_solo_cuentan_los_validos_y_cada_intento_dice_por_que                                      |
| PA-HU37-03 | Playwright          | 1     | aprobada  | PA-HU37-03: el docente ve por día las repeticiones válidas frente a la meta y cada intento                |
| PA-HU37-04 | pytest              | 1     | aprobada  | test_pa_hu37_04_estado_asignada_en_practica_vencida_y_403_al_docente_ajeno                                |

## Pruebas unitarias y de propiedades por módulo

| Módulo        | IDs | Aprobados | Fallidos |
| ------------- | --- | --------- | -------- |
| accesibilidad | 8   | 8         | 0        |
| align         | 7   | 7         | 0        |
| alineacion    | 6   | 6         | 0        |
| api           | 10  | 10        | 0        |
| attempts      | 6   | 6         | 0        |
| audio         | 23  | 23        | 0        |
| cadena        | 4   | 4         | 0        |
| capture       | 18  | 18        | 0        |
| catalog       | 9   | 9         | 0        |
| catalogo      | 2   | 2         | 0        |
| ci            | 6   | 6         | 0        |
| contracts     | 21  | 21        | 0        |
| core          | 1   | 1         | 0        |
| desfase       | 5   | 5         | 0        |
| design        | 5   | 5         | 0        |
| diseno        | 3   | 3         | 0        |
| docs          | 6   | 6         | 0        |
| esperadas     | 3   | 3         | 0        |
| eventos       | 4   | 4         | 0        |
| exercise      | 4   | 4         | 0        |
| features      | 20  | 20        | 0        |
| fusion        | 2   | 2         | 0        |
| geometry      | 16  | 16        | 0        |
| hooks         | 2   | 2         | 0        |
| identity      | 12  | 12        | 0        |
| infra         | 12  | 12        | 0        |
| institutions  | 4   | 4         | 0        |
| outbox        | 3   | 3         | 0        |
| pedagogy      | 9   | 9         | 0        |
| quality       | 9   | 9         | 0        |
| registro      | 3   | 3         | 0        |
| research      | 64  | 64        | 0        |
| tempo         | 5   | 5         | 0        |
| ui            | 6   | 6         | 0        |
| web           | 14  | 14        | 0        |

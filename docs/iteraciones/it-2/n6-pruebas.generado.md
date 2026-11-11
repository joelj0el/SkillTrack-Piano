# n.6 Pruebas — it-2 (generado)

Generado por `pnpm docs:tests it-2` el 2026-11-11 17:18 UTC a partir de los reportes JUnit de `reports/`. No se edita a mano.

## Totales por herramienta

| Herramienta | Casos | Aprobados | Fallidos | Omitidos |
| ----------- | ----- | --------- | -------- | -------- |
| Playwright  | 33    | 31        | 1        | 1        |
| Vitest      | 276   | 276       | 0        | 0        |
| pytest      | 78    | 78        | 0        | 0        |

## Pruebas de aceptación (PA)

| PA         | Herramienta | Casos | Resultado | Prueba                                                                                                   |
| ---------- | ----------- | ----- | --------- | -------------------------------------------------------------------------------------------------------- |
| PA-HU03-03 | Playwright  | 1     | aprobada  | PA-HU03-03: sin permiso de cámara se explica cómo habilitarlo y se ofrece Reintentar                     |
| PA-HU03-05 | Playwright  | 1     | aprobada  | PA-HU03-05: durante 30 s de encuadre no sale ninguna imagen ni video por la red                          |
| PA-HU05-05 | pytest      | 1     | aprobada  | test_pa_hu05_05_el_intento_registra_versiones_de_nucleo_y_modelo_de_mano                                 |
| PA-HU08-01 | pytest      | 1     | aprobada  | test_pa_hu08_01_mismo_client_uuid_una_sola_fila_201_y_luego_200                                          |
| PA-HU08-02 | pytest      | 5     | aprobada  | test_pa_hu08_02_binarios_reciben_415_y_no_se_guarda_nada[multipart/form-data; boundary=x]                |
| PA-HU08-05 | pytest      | 1     | aprobada  | test_pa_hu08_05_intento_de_tarea_con_sus_campos_y_403_para_docente_ajeno                                 |
| PA-HU18-02 | Playwright  | 1     | omitida   | PA-HU18-02: el clip del autor se procesa completo y se detectan manos                                    |
| PA-HU18-04 | Vitest      | 1     | aprobada  | ingesta de la sesión > PA-HU18-04: si se altera un byte del paquete, se rechaza con un mensaje explícito |

## Pruebas unitarias y de propiedades por módulo

| Módulo        | IDs | Aprobados | Fallidos |
| ------------- | --- | --------- | -------- |
| accesibilidad | 8   | 7         | 1        |
| align         | 7   | 7         | 0        |
| alineacion    | 6   | 6         | 0        |
| api           | 10  | 10        | 0        |
| attempts      | 5   | 5         | 0        |
| audio         | 22  | 22        | 0        |
| cadena        | 4   | 4         | 0        |
| capture       | 18  | 18        | 0        |
| catalog       | 9   | 9         | 0        |
| catalogo      | 2   | 2         | 0        |
| ci            | 4   | 4         | 0        |
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
| pedagogy      | 8   | 8         | 0        |
| quality       | 9   | 9         | 0        |
| registro      | 3   | 3         | 0        |
| research      | 64  | 64        | 0        |
| tempo         | 5   | 5         | 0        |
| ui            | 6   | 6         | 0        |
| web           | 13  | 13        | 0        |

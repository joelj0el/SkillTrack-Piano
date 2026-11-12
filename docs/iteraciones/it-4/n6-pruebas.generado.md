# n.6 Pruebas — it-4 (generado)

Generado por `pnpm docs:tests it-4` el 2026-11-12 14:41 UTC a partir de los reportes JUnit de `reports/`. No se edita a mano.

## Totales por herramienta

| Herramienta | Casos | Aprobados | Fallidos | Omitidos |
| ----------- | ----- | --------- | -------- | -------- |
| Playwright  | 54    | 53        | 0        | 1        |
| Vitest      | 340   | 340       | 0        | 0        |
| pytest      | 94    | 94        | 0        | 0        |

## Pruebas de aceptación (PA)

| PA         | Herramienta | Casos | Resultado | Prueba                                                                                                                                                       |
| ---------- | ----------- | ----- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PA-HU06-02 | Playwright  | 1     | aprobada  | PA-HU06-02: diagnosticar no descarga ni carga ningún modelo de aprendizaje automático                                                                        |
| PA-HU07-01 | Playwright  | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU07-01: el resultado aparece en ≤ 5 s después de terminar (PRM-03)                                       |
| PA-HU07-02 | Playwright  | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU07-02: bloques en el orden del panel, una corrección principal y sin estrellas                          |
| PA-HU07-03 | Playwright  | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU07-03: la pantalla de resultados no tiene errores graves de accesibilidad                               |
| PA-HU22-01 | pytest      | 2     | aprobada  | test_pa_hu22_01_publicar_una_version_existente_da_409_y_la_publicada_no_se_edita                                                                             |
| PA-HU23-01 | pytest      | 2     | aprobada  | test_pa_hu23_01_publicar_reglas_exige_la_version_de_la_taxonomia_y_es_inmutable                                                                              |
| PA-HU23-02 | Playwright  | 1     | aprobada  | PA-HU23-02: la herramienta del investigador muestra qué regla disparó cada diagnóstico y con qué eventos                                                     |
| PA-HU24-01 | Playwright  | 1     | aprobada  | PA-HU24-01: el mismo intento en V, A y VA solo difiere en los indicadores de la modalidad excluida y registra el modo                                        |
| PA-HU25-01 | Playwright  | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU25-01: cada nota muestra su familia con icono y texto; al tocarla, mano, dedo y ms                      |
| PA-HU25-02 | Playwright  | 1     | aprobada  | intento no evaluable › PA-HU25-02: las notas no evaluables muestran su motivo                                                                                |
| PA-HU26-01 | Playwright  | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU26-01: la corrección principal es la más crítica, con su nombre, dónde y su mensaje                     |
| PA-HU26-02 | Playwright  | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU26-02: se muestra la última observación del docente con su aspecto                                      |
| PA-HU27-01 | Playwright  | 1     | aprobada  | intento no evaluable › PA-HU27-01: el intento incompleto es No evaluable, con su motivo y una acción sugerida                                                |
| PA-HU27-02 | Playwright  | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU27-02: ninguna variable se califica sin datos: los no evaluables por diseño dicen No evaluado y por qué |
| PA-HU28-01 | Playwright  | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU28-01: la calificación por variable de los intentos anteriores del mismo ejercicio y manos              |
| PA-HU28-02 | Playwright  | 1     | aprobada  | pantalla de resultados de un intento completo › PA-HU28-02: Reintentar vuelve al conteo con la misma calibración y el mismo tempo                            |

## Pruebas unitarias y de propiedades por módulo

| Módulo        | IDs | Aprobados | Fallidos |
| ------------- | --- | --------- | -------- |
| accesibilidad | 8   | 8         | 0        |
| align         | 7   | 7         | 0        |
| alineacion    | 6   | 6         | 0        |
| api           | 10  | 10        | 0        |
| attempts      | 9   | 9         | 0        |
| audio         | 25  | 25        | 0        |
| bandas        | 20  | 20        | 0        |
| cadena        | 4   | 4         | 0        |
| capture       | 18  | 18        | 0        |
| catalog       | 13  | 13        | 0        |
| catalogo      | 2   | 2         | 0        |
| ci            | 6   | 6         | 0        |
| contracts     | 27  | 27        | 0        |
| core          | 1   | 1         | 0        |
| desfase       | 5   | 5         | 0        |
| design        | 5   | 5         | 0        |
| diagnostico   | 18  | 18        | 0        |
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
| research      | 71  | 71        | 0        |
| tempo         | 5   | 5         | 0        |
| ui            | 6   | 6         | 0        |
| web           | 22  | 22        | 0        |

# n.7 Modelos — Iteración 3 (versión de avance)

Sin modelos entrenados. Los métodos son de procesamiento de señal clásico:

| Método                      | Parámetros                                                                                                  | Estado                                                  |
| --------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Ataques por flujo espectral | Ventana 1024, salto 128, mediana local de ±8 cuadros, margen de 0,08 del máximo, separación mínima de 60 ms | Propuesta provisional; se ajusta con grabaciones (S2)   |
| Refinamiento del ataque     | Bloques de 128 muestras (~5,8 ms) con paso de 8                                                             | Implementado                                            |
| Croma                       | Ventana de 4096, 60–2000 Hz, aumento espectral antes y después del ataque                                   | Energía mínima provisional (S2)                         |
| Tempo y regularidad         | PRM-08, PRM-09, PRM-10                                                                                      | Umbrales del proyecto, provisionales hasta la Campaña A |
| Fusión                      | Media ventana de 80 ms                                                                                      | Provisional hasta medir el desfase en S3                |

No hay exactitudes medidas con grabaciones reales en esta versión.

## Estado de esta versión

Implementado con señales sintéticas; la validación con grabaciones queda pendiente.

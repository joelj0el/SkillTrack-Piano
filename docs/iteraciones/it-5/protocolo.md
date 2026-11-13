# Protocolo de evaluación del clasificador (V3c)

Este protocolo se escribe y se congela **antes** de entrenar. Su sha256 y la fecha quedan en `protocolo.congelado.json`; el pipeline de `research/python` no entrena si el archivo cambió. Cualquier cambio posterior exige un protocolo nuevo, con fecha y hash nuevos, y queda registrado en n.3.

Estado: propuesta del autor, pendiente de la aprobación de la tutora (PA-HU33-01).

## 1. Pregunta

¿Un clasificador simple, entrenado con los rasgos agregados de cada ejecución, detecta las clases de error mejor que las reglas congeladas?

## 2. Datos

- Dataset de HU-33: una fila por ejecución evaluable, con su origen (`real`, `actuado` o `sintetico`), su sujeto (seudónimo) y las etiquetas de consenso por clase. El hash del dataset se registra en el informe.
- Ningún campo identifica a una persona: solo seudónimos.
- Las filas sintéticas salen del script de aumento con su semilla y su fila de origen; nunca se presentan como reales.

## 3. Etiquetas

- Seis clases binarias (ER-A a ER-F), una contra el resto.
- Etiqueta de una ejecución en una clase: el desempate, si existe; si no, el acuerdo de todos los etiquetadores. Sin consenso, esa clase de esa fila queda fuera.

## 4. Suficiencia de datos (G-2)

Con las filas de origen `real`:

- al menos 20 estudiantes;
- al menos 8 sujetos por clase;
- κ entre etiquetadores ≥ 0,60;
- al menos 85 % de tomas válidas.

Si alguna condición no se cumple, el informe lo dice con cifras y presenta los resultados como exploratorios.

## 5. Clases con pocos sujetos (DP-06)

Una clase con menos de 8 sujetos reales que la presenten se **excluye** del experimento y el informe lo deja escrito. Fusionar clases requiere una decisión del panel y no la toma el pipeline.

## 6. Partición

- Por sujeto: validación cruzada agrupada con k = mín(5, número de sujetos). Con menos de 2 sujetos no se evalúa.
- Las filas actuadas y sintéticas llevan el sujeto de su fila de origen y quedan siempre en el mismo pliegue que ella.
- Prueba de no fuga: 0 sujetos compartidos entre entrenamiento y prueba en todos los pliegues.

## 7. Escenarios de entrenamiento

1. Solo reales.
2. Reales y actuados.
3. Reales, actuados y sintéticos.

En los tres, las métricas se informan sobre las filas de prueba **separadas por origen**. La cifra principal es la de las filas reales de prueba.

## 8. Modelos

- Regresión logística (clases balanceadas, C = 1).
- Árbol de decisión (profundidad máxima 3, clases balanceadas).
- Sin búsqueda de hiperparámetros: con pocos sujetos, ajustarlos sobreestimaría el resultado.

## 9. Líneas base

- Reglas congeladas: `conjunto_reglas` v1 en modo VA, con la referencia registrada en el informe.
- Clase mayoritaria de cada pliegue de entrenamiento.
- Techo: κ entre etiquetadores.

## 10. Métricas

F1 macro, exhaustividad por clase, matriz de confusión por clase y κ de Cohen del modelo frente al consenso. Se reportan tal como salen.

## 11. Ablación

Los mismos modelos con los rasgos de visión (V), de audio (A) y de ambos (VA), incluidos los rasgos entre modalidades.

## 12. Semilla

20261112, para la partición, los modelos y el aumento sintético.

## 13. Exportación

El modelo se exporta a ONNX solo si su F1 macro en las filas reales de prueba supera al de las reglas congeladas. Si no lo supera, se reporta el resultado negativo y no se exporta.

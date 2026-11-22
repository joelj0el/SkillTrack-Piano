# Plantillas de anotación manual (V1)

Se llenan a mano, mirando el video original de cada toma; no llevan nombres reales, solo el código de la toma. Los archivos llenos se guardan fuera del repositorio, junto a los datos de investigación.

## V1 visual (`v1-visual.csv`)

1. Copia la plantilla fuera del repositorio y borra las filas de ejemplo.
2. Abre el video de la toma y, nota por nota, escribe una fila: `codigo_toma`, el número de la nota tal como la muestra la app (1 = primera), la mano (`MI` o `MD`), el dedo que tocó (1 = pulgar … 5 = meñique) y la tecla que se hundió (`Do4`, `Fa#3`, `Sib2` o el número MIDI; Do central = Do4 = 60).
3. Si algo no se ve con certeza (dedo tapado, tecla fuera de cuadro), deja esa celda vacía: no se cuenta ni a favor ni en contra.
4. Anota unas 10 tomas, de distintos orígenes y condiciones; con menos de 10 la tabla avisa que el n es chico.
5. Corre `pnpm validacion v1-visual --ejercicio EJ-01@1 --anotacion <tu-archivo.csv> --reporte <reporte-reproceso.json> --salida <carpeta>`.

## V1 acústica (`v1-acustica.csv`, un archivo por toma)

1. Abre el video (o su audio) en Sonic Visualiser y agrega una capa de instantes (_Layer → Add New Time Instants Layer_).
2. Marca cada ataque donde empieza el sonido (tecla `;` o clic con la herramienta de dibujo); ampliar el espectrograma ayuda a ubicarlo con precisión.
3. Si quieres medir también las notas, escribe en la etiqueta de cada instante el nombre de la nota (`Do`, `Re`, `Fa#`, `Sib`; la octava no se usa). Sin etiqueta, ese ataque solo cuenta para el F1 de ataques.
4. Exporta la capa con _File → Export Annotation Layer_ como CSV y guárdala con el nombre `<codigo_toma>.csv` en una carpeta solo de anotaciones. El tiempo debe ser en segundos desde el inicio del video.
5. Corre `pnpm validacion v1-acustica --ejercicio EJ-01@1 --anotaciones <carpeta> --salida <carpeta>`; los resultados salen separados por origen e instrumento.

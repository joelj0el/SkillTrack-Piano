# Sistema de diseño "Marfil y ébano"

La interfaz de SkillTrack-Piano toma su identidad del teclado: un fondo marfil cálido, superficies de ébano en el modo oscuro y las teclas blanca y negra como motivo. El tono es elegante, musical y académico. No hay elementos de juego, estrellas ni puntajes.

La fuente de verdad son `apps/web/src/design/tokens.css` y `apps/web/src/design/base.css`. La ruta `/design` muestra todos los tokens y componentes en funcionamiento.

## Principios

1. **Una pantalla, un propósito.** Cada pantalla tiene un título claro, una acción principal y la información agrupada en tarjetas.
2. **Nada se comunica solo con color.** Todo estado lleva icono y texto.
3. **Frases cortas, en segunda persona y sin jerga.**
4. **El movimiento informa.** Confirma una acción, acompaña un cambio de pantalla o marca el pulso. Nunca decora.
5. **"No evaluable" antes que un diagnóstico dudoso.** Tiene su propia familia de color y su propia ilustración.
6. **Se practica de noche.** El modo oscuro es obligatorio y tiene los mismos controles de contraste que el claro.

## Tokens

### Tipografía

Fuente del sistema, con la escala y los pesos siguientes. El interlineado es 1,45 en los textos de 13 a 17 px y 1,25 en los de 20 a 34 px.

| Token         | Tamaño | Uso                                                      |
| ------------- | ------ | -------------------------------------------------------- |
| `--texto-xs`  | 13 px  | Solo metadatos del docente o del investigador            |
| `--texto-sm`  | 15 px  | Texto secundario; es el mínimo para el estudiante        |
| `--texto-md`  | 17 px  | Texto principal                                          |
| `--texto-lg`  | 20 px  | Subtítulos                                               |
| `--texto-xl`  | 28 px  | Títulos de pantalla                                      |
| `--texto-2xl` | 34 px  | Cifras destacadas; el conteo previo se amplía con escala |

Los pesos son 400, 600 y 700 (`--peso-normal`, `--peso-medio` y `--peso-fuerte`).

### Espaciado, radios y sombras

- **Espaciado:** retícula de 4 px, con los valores 4, 8, 12, 16, 24, 32 y 48 (`--espacio-1` a `--espacio-12`). El margen lateral en el móvil es de 16 px y la separación entre secciones, de 32 px.
- **Radios:** 8, 12 y 20 px (`--radio-sm`, `--radio-md` y `--radio-lg`).
- **Sombras:** tres niveles suaves (`--sombra-1` a `--sombra-3`), con valores propios en el modo oscuro.
- **Áreas táctiles:** al menos 48 px (`--alto-toque`). "Cancelar" durante la ejecución mide al menos 56 px (`--alto-toque-grande`) y queda lejos de los bordes.

### Color

Paleta completa en claro y en oscuro: neutros cálidos, un solo acento (azul cobalto) y cinco familias semánticas. Cada familia tiene un color de texto y uno de fondo.

| Familia      | Tokens                                               | Significado                                  | Icono habitual |
| ------------ | ---------------------------------------------------- | -------------------------------------------- | -------------- |
| Correcto     | `--color-correcto`, `--color-correcto-fondo`         | La nota o el aspecto está bien               | Check          |
| Nota         | `--color-nota`, `--color-nota-fondo`                 | Nota equivocada (ER-A)                       | Music          |
| Tiempo       | `--color-tiempo`, `--color-tiempo-fondo`             | A destiempo o cambio de tempo (ER-B)         | Timer          |
| Mano y dedo  | `--color-mano`, `--color-mano-fondo`                 | Mano o digitación (ER-C a ER-F)              | Hand           |
| No evaluable | `--color-no-evaluable`, `--color-no-evaluable-fondo` | No se pudo analizar con suficiente confianza | EyeOff         |

`pnpm design:contraste` comprueba cada par de texto y fondo según WCAG 2.2 AA: 4,5:1 para el texto y 3:1 para los componentes. Se ejecuta en la integración continua y falla si un par no cumple en alguno de los dos temas.

### Movimiento

- Duraciones de 150, 250 y 350 ms (`--duracion-corta`, `--duracion-media` y `--duracion-larga`) con la curva `--curva`.
- Solo se animan `transform` y `opacity`. Está prohibido `transition: all`.
- El conteo previo y el pulso del metrónomo van al tempo elegido, no a estas duraciones. Los bucles de espera (semáforo en ámbar y esqueletos) usan `--duracion-pulso-suave`.
- Con `prefers-reduced-motion` se eliminan los desplazamientos. El pulso del metrónomo se convierte en un parpadeo de opacidad.

### Iconos

Lucide (licencia ISC), en versión fijada. Son decorativos con `aria-hidden` cuando acompañan a un texto.

## Componentes

Cada componente define los estados normal, foco, pulsado, deshabilitado y cargando cuando le corresponden.

| Componente                | Implementación                                           |
| ------------------------- | -------------------------------------------------------- |
| Botón primario            | `<button>` o `Boton`                                     |
| Botón secundario          | `button.secundario` o `Boton variante="secundario"`      |
| Botón de peligro          | `button.peligro` o `Boton variante="peligro"`            |
| Enlace con forma de botón | `EnlaceBoton`                                            |
| Campo, selector y fecha   | `label` con `input`, `select` o `input[type="date"]`     |
| Tarjeta                   | `.tarjeta`                                               |
| Lista                     | `.lista`, con aparición escalonada                       |
| Chip de estado            | `Chip`                                                   |
| Barra superior            | `.barra`                                                 |
| Navegación                | Inferior en el móvil y lateral en el escritorio          |
| Diálogo                   | `Dialogo`, sobre `<dialog>` nativo                       |
| Aviso tipo toast          | `ProveedorAvisos` y `useAviso`                           |
| Esqueleto de carga        | `Esqueleto`                                              |
| Estados de pantalla       | `EstadoVista`: vacío, error, sin conexión y no evaluable |

Las ilustraciones son originales, en SVG lineal, y toman sus colores de los tokens.

## Vida y transiciones

- Las pantallas cambian con la View Transitions API. Si el navegador no la tiene, el cambio es inmediato y el contenido aparece con un fundido.
- Listas y tarjetas aparecen de forma escalonada. Los botones responden al tocar con una escala.
- Las cargas muestran esqueletos en lugar de un texto.
- El semáforo de cámara y micrófono pulsa suavemente en ámbar y confirma con un check en verde.
- El conteo previo es grande y marca el tempo. El metrónomo se ve como un latido.
- El medidor del micrófono se mueve de forma continua.
- Durante la calibración se iluminan las teclas bajo cada dedo.

## Reglas para pantallas nuevas

1. Usa solo tokens: ningún color, tamaño ni duración sueltos.
2. Un `h1` por pantalla y una sola acción principal.
3. Agrupa la información en tarjetas.
4. Define los estados vacío, error, sin conexión y no evaluable cuando apliquen, con `EstadoVista`.
5. Comprueba el contraste con `pnpm design:contraste` y la accesibilidad con axe-core en claro y en oscuro.
6. La política de seguridad solo permite estilos del propio origen: los valores dinámicos se asignan por CSSOM (la propiedad `style` de React), nunca con etiquetas `<style>`.

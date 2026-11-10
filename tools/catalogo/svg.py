# /// script
# requires-python = "==3.12.*"
# dependencies = ["verovio==6.2.1"]
# ///
"""Dibuja la partitura de cada MusicXML como un SVG de una sola página, con la digitación.

Verovio (LGPL-3.0) solo se usa en esta herramienta: no forma parte de la app ni de la API.
Por cada EJ-xx.musicxml de la carpeta escribe EJ-xx.svg al lado.

Uso: uv run tools/catalogo/svg.py [carpeta]   (por defecto tools/catalogo/fuentes)
"""

import sys
from pathlib import Path

import verovio

sys.stdout.reconfigure(encoding="utf-8")
CARPETA = Path(__file__).parent / "fuentes"
OPCIONES = {
    "pageWidth": 1200,
    "pageHeight": 60000,
    "adjustPageHeight": True,
    "breaks": "auto",
    "scale": 45,
    "header": "none",
    "footer": "none",
    "svgViewBox": True,
}


def dibujar(musicxml: Path) -> Path:
    vista = verovio.toolkit()
    vista.setOptions(OPCIONES)
    if not vista.loadData(musicxml.read_text(encoding="utf-8")):
        raise SystemExit(f"{musicxml.name}: Verovio no pudo leer el MusicXML")
    if vista.getPageCount() != 1:
        raise SystemExit(f"{musicxml.name}: la partitura ocupa {vista.getPageCount()} páginas")
    destino = musicxml.with_suffix(".svg")
    destino.write_text(vista.renderToSVG(1), encoding="utf-8")
    return destino


def main() -> int:
    carpeta = Path(sys.argv[1]) if len(sys.argv) > 1 else CARPETA
    archivos = sorted(carpeta.glob("*.musicxml"))
    if not archivos:
        print(f"No hay archivos .musicxml en {carpeta}", file=sys.stderr)
        return 1
    for archivo in archivos:
        print(f"{archivo.name} → {dibujar(archivo).name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

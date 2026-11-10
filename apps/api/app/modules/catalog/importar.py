"""Carga las partituras transcritas en el catálogo, cada una como una versión nueva del ejercicio.

Por cada EJ-xx.musicxml de la carpeta lee también EJ-xx.svg (lo genera tools/catalogo/svg.py).
Una versión publicada no se modifica: si la partitura cambia, se crea la siguiente; si es igual a
la vigente, no se hace nada.

Uso: python -m app.modules.catalog.importar <carpeta>
     python -m app.modules.catalog.importar --exportar <archivo.musicxml>   (JSON, sin base)
"""

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import crear_engine
from app.modules.catalog.models import Ejercicio, VersionEjercicio
from app.modules.catalog.musicxml import ErrorPartitura, importar_musicxml

SVG = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"
PROHIBIDOS = {"script", "style", "foreignObject", "iframe", "image"}
CODIGO = re.compile(r"^EJ-\d{2}$")

ET.register_namespace("", SVG)
ET.register_namespace("xlink", XLINK)


def _local(nombre: str) -> str:
    return nombre.rsplit("}", 1)[-1]


def sanear_svg(svg: str) -> str:
    """Solo dibujo: sin estilos (la CSP los bloquea), scripts, eventos ni enlaces externos."""
    try:
        raiz = ET.fromstring(svg)
    except ET.ParseError as error:
        raise ErrorPartitura(f"El SVG no se puede leer: {error}") from error
    for padre in list(raiz.iter()):
        for hijo in list(padre):
            if _local(hijo.tag) in PROHIBIDOS:
                padre.remove(hijo)
    for elemento in raiz.iter():
        for atributo in list(elemento.attrib):
            nombre = _local(atributo)
            valor = elemento.attrib[atributo]
            externo = nombre == "href" and not valor.startswith("#")
            if nombre.lower().startswith("on") or externo:
                del elemento.attrib[atributo]
    return ET.tostring(raiz, encoding="unicode")


def exportar(musicxml: str, svg: str) -> dict:
    partitura = importar_musicxml(musicxml)
    return {
        "eventos_esperados": partitura.eventos,
        "nota_min_midi": partitura.nota_min_midi,
        "nota_max_midi": partitura.nota_max_midi,
        "partitura_svg": sanear_svg(svg),
    }


def cargar_partitura(
    db: Session, codigo: str, musicxml: str, svg: str
) -> tuple[Literal["nueva", "sin-cambios"], int]:
    ejercicio = db.scalar(select(Ejercicio).where(Ejercicio.codigo == codigo))
    if ejercicio is None:
        raise ErrorPartitura(f"No existe el ejercicio {codigo}")
    datos = exportar(musicxml, svg)
    vigente = db.scalar(
        select(VersionEjercicio)
        .where(VersionEjercicio.ejercicio_id == ejercicio.id)
        .order_by(VersionEjercicio.version.desc())
        .limit(1)
    )
    if (
        vigente.eventos_esperados == datos["eventos_esperados"]
        and vigente.partitura_svg == datos["partitura_svg"]
    ):
        return "sin-cambios", vigente.version
    nueva = VersionEjercicio(
        ejercicio_id=ejercicio.id,
        version=vigente.version + 1,
        tempo_min_permitido_bpm=vigente.tempo_min_permitido_bpm,
        tempo_max_permitido_bpm=vigente.tempo_max_permitido_bpm,
        rango_octavas=vigente.rango_octavas,
        **datos,
    )
    db.add(nueva)
    db.commit()
    return "nueva", nueva.version


def main(argumentos: list[str]) -> int:
    sys.stdout.reconfigure(encoding="utf-8")
    if len(argumentos) == 2 and argumentos[0] == "--exportar":
        musicxml = Path(argumentos[1])
        svg = musicxml.with_suffix(".svg").read_text(encoding="utf-8")
        datos = exportar(musicxml.read_text(encoding="utf-8"), svg)
        print(json.dumps(datos, ensure_ascii=False, indent=2))
        return 0
    if len(argumentos) != 1:
        print(__doc__, file=sys.stderr)
        return 2
    carpeta = Path(argumentos[0])
    archivos = sorted(p for p in carpeta.glob("*.musicxml") if CODIGO.match(p.stem))
    if not archivos:
        print(f"No hay archivos EJ-xx.musicxml en {carpeta}", file=sys.stderr)
        return 1
    errores = 0
    with Session(crear_engine(), expire_on_commit=False) as db:
        for archivo in archivos:
            svg = archivo.with_suffix(".svg")
            try:
                if not svg.exists():
                    raise ErrorPartitura("falta el SVG: genéralo con tools/catalogo/svg.py")
                resultado, version = cargar_partitura(
                    db,
                    archivo.stem,
                    archivo.read_text(encoding="utf-8"),
                    svg.read_text(encoding="utf-8"),
                )
                texto = "versión nueva" if resultado == "nueva" else "sin cambios, versión"
                print(f"{archivo.stem}: {texto} {version}")
            except ErrorPartitura as error:
                db.rollback()
                errores += 1
                print(f"{archivo.stem}: NO SE CARGÓ: {error}", file=sys.stderr)
    return 1 if errores else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

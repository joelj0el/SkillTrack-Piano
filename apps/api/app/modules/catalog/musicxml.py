"""MusicXML → eventos esperados del ejercicio (T-28).

Un evento por nota con altura: mano, dedo, clase de altura, MIDI y tiempo en pulsos de negra.
La mano sale del pentagrama (1 = derecha, 2 = izquierda) y el dedo, de la digitación escrita.
Nada se adivina: una nota sin digitación o una parte sin dos pentagramas es un error. Las notas
de adorno y las continuaciones de una ligadura no son eventos. El archivo debe contener solo la
sección que se analiza.
"""

import xml.etree.ElementTree as ET
from collections.abc import Callable
from dataclasses import dataclass

from app.contracts_gen.ejercicio import EventoEsperado

SEMITONOS = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
MANO_POR_PENTAGRAMA = {"1": "MD", "2": "MI"}


class ErrorPartitura(ValueError):
    pass


@dataclass(frozen=True)
class Partitura:
    eventos: list[dict]
    nota_min_midi: int
    nota_max_midi: int


def _raiz(texto: str) -> ET.Element:
    try:
        raiz = ET.fromstring(texto)
    except ET.ParseError as error:
        raise ErrorPartitura(f"El MusicXML no se puede leer: {error}") from error
    if raiz.tag != "score-partwise":
        raise ErrorPartitura("Solo se admite MusicXML score-partwise (el que exporta MuseScore)")
    return raiz


def _es_evento(nota: ET.Element) -> bool:
    if nota.find("pitch") is None or nota.find("grace") is not None:
        return False
    ligaduras = {t.get("type") for t in nota.findall("tie")}
    return not (ligaduras == {"stop"})


def contar_notas(texto_o_raiz: str | ET.Element) -> int:
    """Notas que deben dar un evento, contadas directamente sobre el documento."""
    raiz = _raiz(texto_o_raiz) if isinstance(texto_o_raiz, str) else texto_o_raiz
    return sum(1 for nota in raiz.iter("note") if _es_evento(nota))


def _midi(altura: ET.Element) -> int:
    paso = altura.findtext("step", "")
    if paso not in SEMITONOS:
        raise ErrorPartitura(f"Nota con altura desconocida: {paso!r}")
    alteracion = round(float(altura.findtext("alter", "0")))
    octava = int(altura.findtext("octave", "0"))
    return (octava + 1) * 12 + SEMITONOS[paso] + alteracion


def _dedo(nota: ET.Element, compas: str) -> int:
    texto = (nota.findtext("notations/technical/fingering") or "").strip()
    if not texto.isdigit() or not 1 <= int(texto) <= 5:
        raise ErrorPartitura(f"Nota sin digitación válida en el compás {compas}")
    return int(texto)


def extraer_eventos(raiz: ET.Element) -> list[dict]:
    eventos = []
    for parte in raiz.findall("part"):
        divisiones = 1
        cursor = 0
        inicio_anterior = 0
        for compas in parte.findall("measure"):
            numero = compas.get("number", "?")
            for elemento in compas:
                if elemento.tag == "attributes" and elemento.findtext("divisions"):
                    divisiones = int(elemento.findtext("divisions", "1"))
                elif elemento.tag in ("backup", "forward"):
                    duracion = int(elemento.findtext("duration", "0"))
                    cursor += duracion if elemento.tag == "forward" else -duracion
                elif elemento.tag == "note" and elemento.find("grace") is None:
                    acorde = elemento.find("chord") is not None
                    inicio = inicio_anterior if acorde else cursor
                    if _es_evento(elemento):
                        mano = MANO_POR_PENTAGRAMA.get(elemento.findtext("staff", ""))
                        if mano is None:
                            raise ErrorPartitura(
                                f"No se sabe la mano de una nota del compás {numero}: "
                                "la parte debe tener dos pentagramas (1 = derecha, 2 = izquierda)"
                            )
                        midi = _midi(elemento.find("pitch"))
                        eventos.append(
                            {
                                "tiempo_beats": inicio / divisiones,
                                "mano": mano,
                                "dedo": _dedo(elemento, numero),
                                "clase_altura": midi % 12,
                                "midi": midi,
                            }
                        )
                    if not acorde:
                        inicio_anterior = cursor
                        cursor += int(elemento.findtext("duration", "0"))
    eventos.sort(key=lambda e: (e["tiempo_beats"], e["mano"] != "MI", e["midi"]))
    return [{"idx": i, **e} for i, e in enumerate(eventos)]


def importar_musicxml(
    texto: str, extraer: Callable[[ET.Element], list[dict]] = extraer_eventos
) -> Partitura:
    raiz = _raiz(texto)
    eventos = extraer(raiz)
    notas = contar_notas(raiz)
    if len(eventos) != notas:
        raise ErrorPartitura(f"La importación dio {len(eventos)} eventos para {notas} notas")
    if not eventos:
        raise ErrorPartitura("El MusicXML no tiene notas")
    validados = [EventoEsperado.model_validate(e).model_dump() for e in eventos]
    midis = [e["midi"] for e in validados]
    return Partitura(validados, min(midis), max(midis))

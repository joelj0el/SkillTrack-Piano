# /// script
# requires-python = "==3.12.*"
# dependencies = []
# ///
"""Genera la partitura de PRUEBA SINTÉTICA de las herramientas del catálogo.

Escala de Do mayor, 2 octavas de subida y de bajada por mano, en semicorcheas y a manos juntas en
octava paralela, con una digitación de ejemplo. NO es la partitura ni la digitación del panel:
solo sirve para probar la importación.

Uso: uv run tools/catalogo/generar_prueba.py
"""

from pathlib import Path

DESTINO = Path(__file__).parent / "fixtures" / "PRUEBA-escala-do.musicxml"
TITULO = "PRUEBA SINTÉTICA: escala de Do mayor (no es la partitura del panel)"
PASOS = ["C", "D", "E", "F", "G", "A", "B"]
DIVISIONES = 4  # semicorchea = 1
POR_COMPAS = 8  # 2/4

# Digitación de ejemplo para 2 octavas de Do mayor (subida y bajada).
DEDOS_MD = [
    1,
    2,
    3,
    1,
    2,
    3,
    4,
    1,
    2,
    3,
    1,
    2,
    3,
    4,
    5,
    4,
    3,
    2,
    1,
    4,
    3,
    2,
    1,
    3,
    2,
    1,
    3,
    2,
    1,
]
DEDOS_MI = [
    5,
    4,
    3,
    2,
    1,
    3,
    2,
    1,
    4,
    3,
    2,
    1,
    3,
    2,
    1,
    2,
    3,
    1,
    2,
    3,
    4,
    1,
    2,
    3,
    1,
    2,
    3,
    4,
    5,
]


def alturas(octava: int) -> list[tuple[str, int]]:
    subida = [(PASOS[i % 7], octava + i // 7) for i in range(15)]
    return subida + subida[-2::-1]


def nota(paso: str, octava: int, dedo: int, pentagrama: int) -> str:
    voz = 1 if pentagrama == 1 else 5
    return (
        f"<note><pitch><step>{paso}</step><octave>{octava}</octave></pitch>"
        f"<duration>1</duration><voice>{voz}</voice><type>16th</type>"
        f"<staff>{pentagrama}</staff><notations><technical><fingering>{dedo}</fingering>"
        "</technical></notations></note>"
    )


def silencio(duracion: int, pentagrama: int) -> str:
    voz = 1 if pentagrama == 1 else 5
    tipo = {1: "16th", 2: "eighth", 4: "quarter"}.get(duracion)
    figura = f"<type>{tipo}</type>" if tipo else "<type>eighth</type><dot/>"
    return (
        f"<note><rest/><duration>{duracion}</duration><voice>{voz}</voice>{figura}"
        f"<staff>{pentagrama}</staff></note>"
    )


def compases() -> list[str]:
    md = [nota(p, o, d, 1) for (p, o), d in zip(alturas(4), DEDOS_MD, strict=True)]
    mi = [nota(p, o, d, 2) for (p, o), d in zip(alturas(3), DEDOS_MI, strict=True)]
    salida = []
    for inicio in range(0, len(md), POR_COMPAS):
        tramo_md, tramo_mi = (
            md[inicio : inicio + POR_COMPAS],
            mi[inicio : inicio + POR_COMPAS],
        )
        resto = POR_COMPAS - len(tramo_md)
        relleno_md = [silencio(resto, 1)] if resto else []
        relleno_mi = [silencio(resto, 2)] if resto else []
        numero = inicio // POR_COMPAS + 1
        atributos = (
            f"<attributes><divisions>{DIVISIONES}</divisions><key><fifths>0</fifths></key>"
            "<time><beats>2</beats><beat-type>4</beat-type></time><staves>2</staves>"
            "<clef number='1'><sign>G</sign><line>2</line></clef>"
            "<clef number='2'><sign>F</sign><line>4</line></clef></attributes>"
            if numero == 1
            else ""
        )
        cuerpo = [
            *tramo_md,
            *relleno_md,
            f"<backup><duration>{POR_COMPAS}</duration></backup>",
        ]
        cuerpo += [*tramo_mi, *relleno_mi]
        salida.append(f"<measure number='{numero}'>{atributos}{''.join(cuerpo)}</measure>")
    return salida


def main() -> None:
    xml = (
        "<?xml version='1.0' encoding='UTF-8'?>\n"
        "<score-partwise version='4.0'>"
        f"<work><work-title>{TITULO}</work-title></work>"
        "<part-list><score-part id='P1'><part-name>Piano</part-name></score-part></part-list>"
        f"<part id='P1'>{''.join(compases())}</part></score-partwise>\n"
    )
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    DESTINO.write_text(xml, encoding="utf-8")
    print(f"Partitura de prueba: {DESTINO}")


if __name__ == "__main__":
    main()

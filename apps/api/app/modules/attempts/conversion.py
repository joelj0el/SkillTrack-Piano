"""Conversión de los eventos de ResultadoIntento v1 a v2.

La v1 no registraba el estado de la nota, la tecla ni el desfase entre manos: esos datos quedan
como "sin dato" (null), nunca se inventan. El dedo detectado y su comparación se conservan, y
como en la v1 solo los daba la visión, su modalidad es V.
"""

ESTADO_DEDO_V1 = {"digitacion-correcta": "correcto", "dedo-incorrecto": "incorrecto"}


def es_evento_v1(evento: dict) -> bool:
    return "nota" not in evento


def evento_v1_a_v2(evento: dict) -> dict:
    dedo = evento.get("dedo")
    estado_dedo = ESTADO_DEDO_V1.get(evento["estado"]) or (
        "sin-esperado" if dedo is not None else "no-detectado"
    )
    rasgos = evento.get("rasgos") or {}
    return {
        "idx": evento["idx"],
        "mano": evento.get("mano"),
        "midi_esperado": evento.get("midi"),
        "dedo_esperado": None,
        "estado": "no-evaluable" if evento["estado"] == "no-evaluable" else "evaluado",
        "motivo": evento.get("motivo"),
        "ataque_ms": None,
        "modalidad": None,
        "nota": {"estado": "sin-dato", "midi": None, "clase_oida": None, "modalidad": None},
        "dedo": {
            "valor": dedo,
            "estado": estado_dedo,
            "modalidad": "V" if dedo is not None else None,
        },
        "tecla": {"midi": None, "zona": None, "modalidad": None},
        "desfase_manos": None,
        "rasgos": rasgos,
        "rasgos_modalidad": "V" if rasgos else None,
    }

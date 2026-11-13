"""Rasgos agregados por ejecución, cada uno con su modalidad (V, A o VA) para la ablación.

La entrada es una ejecución exportada por `pnpm dataset:exportar` (o generada por el aumento).
"""

from collections.abc import Callable

Ejecucion = dict


def _fraccion(partes: int, total: int) -> float:
    return partes / total if total else 0.0


def _evaluados(e: Ejecucion) -> list[dict]:
    return [x for x in e["eventos"] if x["estado"] == "evaluado"]


def _desv(e: Ejecucion, rasgo: str) -> list[dict]:
    return [d for d in e["desviaciones"] if d["rasgo"] == rasgo and d["posicion"] != "sin-banda"]


def _fuera(e: Ejecucion, rasgo: str, lado: str | None = None) -> float:
    ds = _desv(e, rasgo)
    fuera = [d for d in ds if d["posicion"] != "dentro" and (lado is None or d["posicion"] == lado)]
    return _fraccion(len(fuera), len(ds))


def nota_error(e: Ejecucion) -> float:
    ev = _evaluados(e)
    return _fraccion(sum(x["nota"] in ("incorrecta", "faltante") for x in ev), len(ev))


def nota_dudosa(e: Ejecucion) -> float:
    ev = _evaluados(e)
    return _fraccion(sum(x["nota"] == "dudosa" for x in ev), len(ev))


def ataque_fuera(e: Ejecucion) -> float:
    return _fuera(e, "ataque.desvio_pct")


def ataque_max(e: Ejecucion) -> float:
    return max((abs(d["valor"]) for d in _desv(e, "ataque.desvio_pct")), default=0.0)


def cambio_tempo(e: Ejecucion) -> float:
    c = e.get("cambio_tempo_pct")
    return abs(c) if c is not None else 0.0


def sin_tempo(e: Ejecucion) -> float:
    return 1.0 if e.get("cambio_tempo_pct") is None else 0.0


def dedo_error(e: Ejecucion) -> float:
    comparados = [x for x in _evaluados(e) if x["dedo"] in ("correcto", "incorrecto")]
    return _fraccion(sum(x["dedo"] == "incorrecto" for x in comparados), len(comparados))


def zona_encima(e: Ejecucion) -> float:
    return _fuera(e, "tecla.zona", "encima")


def zona_debajo(e: Ejecucion) -> float:
    return _fuera(e, "tecla.zona", "debajo")


def otros_visuales_fuera(e: Ejecucion) -> float:
    propios = {
        "tecla.zona",
        "ataque.desvio_pct",
        "desfase_manos.ms",
        "cambio_tempo.pct",
    }
    ds = [
        d
        for d in e["desviaciones"]
        if d["rasgo"] not in propios and d["modalidad"] == "V" and d["posicion"] != "sin-banda"
    ]
    return _fraccion(sum(d["posicion"] != "dentro" for d in ds), len(ds))


def desfase_fuera(e: Ejecucion) -> float:
    return _fuera(e, "desfase_manos.ms")


def una_nota_atras(e: Ejecucion) -> float:
    ev = _evaluados(e)
    return _fraccion(sum(x["desfase"] == "una-nota-atras" for x in ev), len(ev))


def tecla_vs_nota(e: Ejecucion) -> float:
    """Entre modalidades: la tecla que vio la cámara y la nota que oyó el micrófono no coinciden."""
    ambos = [x for x in _evaluados(e) if x["nota_midi"] is not None and x["tecla_midi"] is not None]
    return _fraccion(sum(x["nota_midi"] != x["tecla_midi"] for x in ambos), len(ambos))


def una_sola_modalidad(e: Ejecucion) -> float:
    """Entre modalidades: eventos que solo pudo medir la visión o solo el audio."""
    ev = _evaluados(e)
    return _fraccion(sum(x.get("modalidad") in ("V", "A") for x in ev), len(ev))


def no_evaluables(e: Ejecucion) -> float:
    return _fraccion(sum(x["estado"] != "evaluado" for x in e["eventos"]), len(e["eventos"]))


# Nombre → (modalidad, función). El orden fija las columnas del dataset.
RASGOS: dict[str, tuple[str, Callable[[Ejecucion], float]]] = {
    "a_nota_error": ("A", nota_error),
    "a_nota_dudosa": ("A", nota_dudosa),
    "a_ataque_fuera": ("A", ataque_fuera),
    "a_ataque_max": ("A", ataque_max),
    "a_cambio_tempo": ("A", cambio_tempo),
    "a_sin_tempo": ("A", sin_tempo),
    "v_dedo_error": ("V", dedo_error),
    "v_zona_encima": ("V", zona_encima),
    "v_zona_debajo": ("V", zona_debajo),
    "v_otros_fuera": ("V", otros_visuales_fuera),
    "va_desfase_fuera": ("VA", desfase_fuera),
    "va_una_nota_atras": ("VA", una_nota_atras),
    "va_tecla_vs_nota": ("VA", tecla_vs_nota),
    "va_una_sola_modalidad": ("VA", una_sola_modalidad),
    "va_no_evaluables": ("VA", no_evaluables),
}


def rasgos_de(e: Ejecucion) -> dict[str, float]:
    return {nombre: f(e) for nombre, (_, f) in RASGOS.items()}


def columnas_de_modo(modo: str) -> list[str]:
    """Ablación: V solo visión, A solo audio y VA todo, incluidos los rasgos entre modalidades."""
    if modo == "VA":
        return list(RASGOS)
    return [n for n, (m, _) in RASGOS.items() if m == modo]

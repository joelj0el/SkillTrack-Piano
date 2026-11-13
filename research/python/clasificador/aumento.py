"""Aumento sintético: ejecuciones nuevas a partir de las reales, con semilla registrada.

Cada ejecución sintética parte de una real y le aplica:
- perturbaciones de los valores medidos, dentro del rango que se observó en las reales;
- a veces, un error inyectado (tecla equivocada, dedo incorrecto o cambio de tempo), con la
  etiqueta de esa clase en "presente";
- una variación del cambio de tempo dentro del rango observado.

Las filas salen con origen "sintetico", el sujeto de la fila real y su `fila_origen`. No llevan
diagnóstico de las reglas ni juicios de etiquetadores: no se inventa lo que no se midió.
"""

import copy
import random
from collections import defaultdict

# Fracción del rango observado que se usa como desviación de la perturbación.
ESCALA_PERTURBACION = 0.1
PROBABILIDAD_ERROR = 0.5
ERRORES = ("ER-A", "ER-B", "ER-C")


def _rangos(reales: list[dict]) -> dict[str, tuple[float, float]]:
    valores: dict[str, list[float]] = defaultdict(list)
    for e in reales:
        for d in e["desviaciones"]:
            valores[d["rasgo"]].append(d["valor"])
    return {r: (min(v), max(v)) for r, v in valores.items()}


def _posicion(valor: float, inferior: float | None, superior: float | None) -> str:
    if inferior is None or superior is None:
        return "sin-banda"
    if valor > superior:
        return "encima"
    if valor < inferior:
        return "debajo"
    return "dentro"


def _perturbar(e: dict, rangos: dict[str, tuple[float, float]], azar: random.Random) -> None:
    for d in e["desviaciones"]:
        minimo, maximo = rangos[d["rasgo"]]
        ruido = azar.gauss(0, ESCALA_PERTURBACION * (maximo - minimo))
        d["valor"] = min(maximo, max(minimo, d["valor"] + ruido))
        d["posicion"] = _posicion(d["valor"], d["inferior"], d["superior"])


def _inyectar(e: dict, clase: str, rangos: dict[str, tuple[float, float]], azar: random.Random):
    evaluados = [x for x in e["eventos"] if x["estado"] == "evaluado"]
    if clase == "ER-A":
        candidatos = [x for x in evaluados if x["nota"] == "correcta"]
        if not candidatos:
            return False
        x = azar.choice(candidatos)
        x["nota"] = "incorrecta"
        if x["nota_midi"] is not None:
            x["nota_midi"] += 1
    elif clase == "ER-C":
        candidatos = [x for x in evaluados if x["dedo"] == "correcto"]
        if not candidatos:
            return False
        azar.choice(candidatos)["dedo"] = "incorrecto"
    else:
        tempo = [d for d in e["desviaciones"] if d["rasgo"] == "cambio_tempo.pct"]
        if not tempo or tempo[0]["superior"] is None or tempo[0]["inferior"] is None:
            return False
        d = tempo[0]
        # Medio ancho de banda por encima del límite: fuera de la banda, sin valores extremos.
        d["valor"] = d["superior"] + 0.5 * (d["superior"] - d["inferior"])
        d["posicion"] = "encima"
        e["cambio_tempo_pct"] = d["valor"]
    e["etiquetas"][clase] = True
    return True


def _variar_tempo(e: dict, rangos: dict[str, tuple[float, float]], azar: random.Random) -> None:
    if e.get("cambio_tempo_pct") is None or "cambio_tempo.pct" not in rangos:
        return
    minimo, maximo = rangos["cambio_tempo.pct"]
    e["cambio_tempo_pct"] = azar.uniform(minimo, maximo)
    for d in e["desviaciones"]:
        if d["rasgo"] == "cambio_tempo.pct":
            d["valor"] = e["cambio_tempo_pct"]
            d["posicion"] = _posicion(d["valor"], d["inferior"], d["superior"])


def aumentar(ejecuciones: list[dict], por_cada_real: int, semilla: int) -> tuple[list[dict], dict]:
    """Devuelve las ejecuciones sintéticas y el registro (semilla, parámetros, conteos)."""
    reales = sorted(
        (e for e in ejecuciones if e["origen"] == "real"),
        key=lambda e: e["codigo_toma"],
    )
    if not reales:
        raise ValueError("No hay ejecuciones reales de las que partir")
    azar = random.Random(semilla)
    rangos = _rangos(reales)
    sinteticas: list[dict] = []
    inyectados: dict[str, int] = defaultdict(int)
    for base in reales:
        for k in range(por_cada_real):
            e = copy.deepcopy(base)
            e["codigo_toma"] = f"SINT-{semilla}-{base['codigo_toma']}-{k + 1:02d}"
            e["origen"] = "sintetico"
            e["fila_origen"] = base["codigo_toma"]
            e["reglas"] = None
            e["juicios_dobles"] = {}
            _perturbar(e, rangos, azar)
            if azar.random() < PROBABILIDAD_ERROR:
                clase = azar.choice(ERRORES)
                if _inyectar(e, clase, rangos, azar):
                    inyectados[clase] += 1
            else:
                _variar_tempo(e, rangos, azar)
            sinteticas.append(e)
    registro = {
        "semilla": semilla,
        "por_cada_real": por_cada_real,
        "escala_perturbacion": ESCALA_PERTURBACION,
        "probabilidad_error": PROBABILIDAD_ERROR,
        "reales": len(reales),
        "sinteticas": len(sinteticas),
        "errores_inyectados": dict(sorted(inyectados.items())),
    }
    return sinteticas, registro

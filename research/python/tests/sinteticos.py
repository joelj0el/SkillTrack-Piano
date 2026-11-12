"""Ejecuciones SINTÉTICAS para las pruebas, con la forma de `pnpm dataset:exportar`.

No vienen de ninguna grabación: cada una se arma con los errores que se le piden.
"""

import random

CLASES = ("ER-A", "ER-B", "ER-C", "ER-D", "ER-E", "ER-F")


def ejecucion(
    codigo: str,
    sujeto: str,
    origen: str = "real",
    *,
    nota_mal: int = 0,
    dedo_mal: int = 0,
    zona_baja: int = 0,
    cambio_tempo: float | None = 2.0,
    eventos: int = 10,
    etiquetas: dict[str, bool | None] | None = None,
    reglas: list[str] | None = None,
    dobles: dict[str, list[bool]] | None = None,
) -> dict:
    evs, desv = [], []
    for i in range(eventos):
        nota = "incorrecta" if i < nota_mal else "correcta"
        midi = 60 + i
        evs.append(
            {
                "idx": i,
                "mano": "MD",
                "estado": "evaluado",
                "modalidad": "VA",
                "nota": nota,
                "nota_midi": midi + (1 if nota == "incorrecta" else 0),
                "tecla_midi": midi,
                "dedo": "incorrecto" if i < dedo_mal else "correcto",
                "desfase": None,
            }
        )
        zona = 0.05 if i < zona_baja else 0.4
        desv.append(
            {
                "rasgo": "tecla.zona",
                "unidad": f"e{i}",
                "valor": zona,
                "posicion": "debajo" if zona < 0.2 else "dentro",
                "modalidad": "V",
                "inferior": 0.2,
                "superior": 0.6,
            }
        )
        desv.append(
            {
                "rasgo": "ataque.desvio_pct",
                "unidad": f"e{i}",
                "valor": 3.0,
                "posicion": "dentro",
                "modalidad": "A",
                "inferior": -15.0,
                "superior": 15.0,
            }
        )
    if cambio_tempo is not None:
        desv.append(
            {
                "rasgo": "cambio_tempo.pct",
                "unidad": "ejecucion",
                "valor": cambio_tempo,
                "posicion": "encima" if cambio_tempo > 10 else "dentro",
                "modalidad": "A",
                "inferior": -10.0,
                "superior": 10.0,
            }
        )
    presentes = {
        "ER-A": nota_mal > 0,
        "ER-B": cambio_tempo is not None and cambio_tempo > 10,
        "ER-C": dedo_mal > 0,
        "ER-D": zona_baja > 0,
    }
    return {
        "codigo_toma": codigo,
        "sujeto": sujeto,
        "origen": origen,
        "version_ejercicio": "EJ-01@1",
        "fila_origen": None,
        "eventos": evs,
        "desviaciones": desv,
        "cambio_tempo_pct": cambio_tempo,
        "reglas": {
            "version": 1,
            "referencia": 1,
            "modo": "VA",
            "clases": reglas if reglas is not None else [c for c, p in presentes.items() if p],
        },
        "etiquetas": etiquetas if etiquetas is not None else presentes,
        "juicios_dobles": dobles or {},
    }


def poblacion(sujetos: int, por_sujeto: int, semilla: int, origen: str = "real") -> list[dict]:
    """Varias ejecuciones por sujeto, con errores al azar y etiquetas coherentes con ellos."""
    azar = random.Random(semilla)
    salida = []
    for s in range(sujetos):
        for k in range(por_sujeto):
            salida.append(
                ejecucion(
                    f"S{s:02d}-{origen[:3].upper()}-R{k + 1}",
                    f"S{s:02d}",
                    origen,
                    nota_mal=azar.choice([0, 0, 1, 3]),
                    dedo_mal=azar.choice([0, 0, 2]),
                    zona_baja=azar.choice([0, 0, 0, 2]),
                    cambio_tempo=azar.choice([2.0, -3.0, 25.0]),
                )
            )
    return salida


def resumen(total: int, validas: int) -> dict:
    return {
        "version_ejercicio": "EJ-01@1",
        "referencia": 1,
        "reglas": 1,
        "tomas": {"real": {"total": total, "validas": validas, "sin_reprocesar": 0}},
    }

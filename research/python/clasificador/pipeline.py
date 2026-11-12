"""HU-34: entrenamiento y evaluación según el protocolo congelado (docs/iteraciones/it-5).

Partición por sujeto, modelos simples, líneas base (reglas congeladas y clase mayoritaria),
ablación V / A / VA y métricas separadas por el origen de las filas de prueba.
"""

import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np
from sklearn.dummy import DummyClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier

from clasificador.dataset import CLASES
from clasificador.rasgos import columnas_de_modo

SEMILLA = 20261112
RAIZ = Path(__file__).resolve().parents[3]
PROTOCOLO = Path("docs/iteraciones/it-5/protocolo.md")
REGISTRO_PROTOCOLO = Path("docs/iteraciones/it-5/protocolo.congelado.json")
ESCENARIOS = {
    "solo_reales": ("real",),
    "reales_actuados": ("real", "actuado"),
    "con_sinteticos": ("real", "actuado", "sintetico"),
}
MODOS = ("V", "A", "VA")
MODELOS_ENTRENADOS = ("logistica", "arbol")
MAX_PLIEGUES = 5
# G-2 (suficiencia de datos), medida con las filas reales.
G2_ESTUDIANTES = 20
G2_SUJETOS_POR_CLASE = 8
G2_KAPPA = 0.60
G2_TOMAS_VALIDAS = 0.85


def verificar_protocolo(raiz: Path) -> str:
    """El pipeline no entrena si el protocolo cambió después de congelarlo."""
    registro = json.loads((raiz / REGISTRO_PROTOCOLO).read_text("utf-8"))
    texto = (raiz / PROTOCOLO).read_bytes().replace(b"\r\n", b"\n")
    actual = hashlib.sha256(texto).hexdigest()
    if actual != registro["sha256"]:
        raise RuntimeError(
            f"El protocolo cambió después de congelarlo ({registro['congelado_en']}): "
            f"sha256 {actual} ≠ {registro['sha256']}"
        )
    return actual


def modelo(nombre: str):
    if nombre == "logistica":
        return make_pipeline(
            StandardScaler(),
            LogisticRegression(C=1.0, class_weight="balanced", max_iter=1000, random_state=SEMILLA),
        )
    if nombre == "arbol":
        return DecisionTreeClassifier(max_depth=3, class_weight="balanced", random_state=SEMILLA)
    if nombre == "mayoritaria":
        return DummyClassifier(strategy="most_frequent")
    raise ValueError(nombre)


def kappa_fleiss(juicios: list[str]) -> float | None:
    """κ de Fleiss con dos juicios por ejecución ("10", "11", ...)."""
    items = [[c == "1" for c in j] for j in juicios if len(j) == 2]
    if not items:
        return None
    acuerdo = sum(1.0 if a == b else 0.0 for a, b in items) / len(items)
    p = sum(a + b for a, b in items) / (2 * len(items))
    esperado = p**2 + (1 - p) ** 2
    return None if esperado == 1 else (acuerdo - esperado) / (1 - esperado)


@dataclass
class Condicion:
    nombre: str
    valor: float | None
    umbral: float
    cumple: bool


def suficiencia(filas: list[dict], manifiesto: dict) -> list[Condicion]:
    reales = [f for f in filas if f["origen"] == "real"]
    condiciones = [
        Condicion(
            "Estudiantes",
            len({f["sujeto"] for f in reales}),
            G2_ESTUDIANTES,
            len({f["sujeto"] for f in reales}) >= G2_ESTUDIANTES,
        )
    ]
    for clase in CLASES:
        n = len({f["sujeto"] for f in reales if f[f"etiqueta_{clase}"] == "1"})
        condiciones.append(
            Condicion(
                f"Sujetos con {clase}",
                n,
                G2_SUJETOS_POR_CLASE,
                n >= G2_SUJETOS_POR_CLASE,
            )
        )
        k = kappa_fleiss([f[f"doble_{clase}"] for f in reales if f[f"doble_{clase}"]])
        condiciones.append(
            Condicion(
                f"κ entre etiquetadores {clase}",
                k,
                G2_KAPPA,
                k is not None and k >= G2_KAPPA,
            )
        )
    tomas = manifiesto["exportacion"]["tomas"].get("real", {"total": 0, "validas": 0})
    validas = tomas["validas"] / tomas["total"] if tomas["total"] else None
    condiciones.append(
        Condicion(
            "Tomas válidas",
            validas,
            G2_TOMAS_VALIDAS,
            validas is not None and validas >= G2_TOMAS_VALIDAS,
        )
    )
    return condiciones


def clases_incluidas(filas: list[dict]) -> tuple[list[str], dict[str, int]]:
    """DP-06: una clase con menos de 8 sujetos reales que la presenten queda fuera."""
    incluidas, excluidas = [], {}
    for clase in CLASES:
        n = len(
            {f["sujeto"] for f in filas if f["origen"] == "real" and f[f"etiqueta_{clase}"] == "1"}
        )
        if n >= G2_SUJETOS_POR_CLASE:
            incluidas.append(clase)
        else:
            excluidas[clase] = n
    return incluidas, excluidas


@dataclass
class Prediccion:
    escenario: str
    modo: str
    modelo: str
    clase: str
    codigo_toma: str
    origen: str
    real: int
    predicha: int


@dataclass
class Resultado:
    predicciones: list[Prediccion] = field(default_factory=list)
    pliegues: int = 0
    sujetos_compartidos: int = 0
    sin_evaluar: dict[str, str] = field(default_factory=dict)


def evaluar(filas: list[dict], clases: list[str], modos: tuple[str, ...] = MODOS) -> Resultado:
    res = Resultado()
    for escenario, origenes in ESCENARIOS.items():
        del_escenario = [f for f in filas if f["origen"] in origenes]
        for clase in clases:
            etiquetadas = [f for f in del_escenario if f[f"etiqueta_{clase}"] in ("0", "1")]
            sujetos = np.array([f["sujeto"] for f in etiquetadas])
            n_sujetos = len(set(sujetos))
            if n_sujetos < 2:
                res.sin_evaluar[f"{escenario} {clase}"] = (
                    f"{n_sujetos} sujeto(s): no se puede partir"
                )
                continue
            y = np.array([int(f[f"etiqueta_{clase}"]) for f in etiquetadas])
            pliegues = GroupKFold(n_splits=min(MAX_PLIEGUES, n_sujetos))
            for entrena, prueba in pliegues.split(np.zeros(len(y)), y, sujetos):
                res.pliegues += 1
                res.sujetos_compartidos += len(set(sujetos[entrena]) & set(sujetos[prueba]))
                for modo in modos:
                    cols = columnas_de_modo(modo)
                    x = np.array([[float(f[c]) for c in cols] for f in etiquetadas])
                    for nombre in (*MODELOS_ENTRENADOS, "mayoritaria"):
                        if nombre == "mayoritaria" and modo != "VA":
                            continue
                        # Con una sola clase en entrenamiento, el modelo solo puede repetirla.
                        m = modelo(nombre if len(set(y[entrena])) > 1 else "mayoritaria")
                        m.fit(x[entrena], y[entrena])
                        for i, p in zip(prueba, m.predict(x[prueba]), strict=True):
                            f = etiquetadas[i]
                            res.predicciones.append(
                                Prediccion(
                                    escenario,
                                    modo,
                                    nombre,
                                    clase,
                                    f["codigo_toma"],
                                    f["origen"],
                                    int(y[i]),
                                    int(p),
                                )
                            )
                for i in prueba:
                    f = etiquetadas[i]
                    if f[f"reglas_{clase}"] in ("0", "1"):
                        res.predicciones.append(
                            Prediccion(
                                escenario,
                                "VA",
                                "reglas",
                                clase,
                                f["codigo_toma"],
                                f["origen"],
                                int(y[i]),
                                int(f[f"reglas_{clase}"]),
                            )
                        )
    return res


def entrenar_final(filas: list[dict], clases: list[str], escenario: str, nombre: str):
    """Modelo por clase con todas las filas del escenario (para exportarlo)."""
    cols = columnas_de_modo("VA")
    modelos = {}
    for clase in clases:
        etiquetadas = [
            f
            for f in filas
            if f["origen"] in ESCENARIOS[escenario] and f[f"etiqueta_{clase}"] in ("0", "1")
        ]
        x = np.array([[float(f[c]) for c in cols] for f in etiquetadas], dtype=np.float32)
        y = np.array([int(f[f"etiqueta_{clase}"]) for f in etiquetadas])
        m = modelo(nombre if len(set(y)) > 1 else "mayoritaria")
        m.fit(x, y)
        modelos[clase] = m
    return cols, modelos
